import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  KiraFramework,
  JourneyType,
} from '@/lib/kira/prompts';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/* ------------------------------------------------------------------ */
/* Logging helper                                                      */
/* ------------------------------------------------------------------ */
async function log(
  supabase: any,
  requestId: string,
  step: string,
  status: 'start' | 'success' | 'error',
  message?: string,
  details?: Record<string, any>
) {
  await supabase.from('kira_logs').insert({
    request_id: requestId,
    step,
    status,
    message,
    details,
  });
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const supabase = createServiceClient();

  try {
    await log(supabase, requestId, 'init', 'start');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY missing');
    }

    await log(supabase, requestId, 'env_check', 'success');

    const body = await req.json();
    const { draftId, email } = body as { draftId: string; email: string };

    if (!draftId || !email) {
      throw new Error('draftId or email missing');
    }

    await log(supabase, requestId, 'request_parsed', 'success', undefined, {
      draftId,
      email,
    });

    /* ---------------- Draft ---------------- */
    await log(supabase, requestId, 'draft_load', 'start');

    const { data: draft } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (!draft) throw new Error('Draft not found');

    await log(supabase, requestId, 'draft_load', 'success', undefined, {
      status: draft.status,
    });

    /* ---------------- User ---------------- */
    await log(supabase, requestId, 'user_lookup', 'start');

    const firstName = extractFirstName(draft.user_name);

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
        })
        .select()
        .single();

      if (error || !newUser) throw new Error('User create failed');
      user = newUser;
    }

    await log(supabase, requestId, 'user_lookup', 'success', undefined, {
      userId: user.id,
    });

    /* ---------------- Existing agent check ---------------- */
    await log(supabase, requestId, 'agent_check', 'start');

    const { data: existing } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('journey_type', draft.journey_type)
      .eq('status', 'active')
      .single();

    if (existing) {
      await log(supabase, requestId, 'agent_check', 'success', 'existing');
      return NextResponse.json({
        success: true,
        agentId: existing.elevenlabs_agent_id,
        isExisting: true,
      });
    }

    /* ---------------- Prompt ---------------- */
    await log(supabase, requestId, 'prompt_build', 'start');

    const framework: KiraFramework = {
      userName: draft.user_name,
      firstName,
      location: draft.location,
      journeyType: draft.journey_type as JourneyType,
      primaryObjective: draft.primary_objective,
      keyContext: draft.key_context ?? [],
      successDefinition: draft.success_definition,
      constraints: draft.constraints,
    };

    const { systemPrompt, firstMessage } = getKiraPrompt({ framework });
    const agentName = generateAgentName(
      draft.journey_type,
      firstName,
      user.id
    );

    await log(supabase, requestId, 'prompt_build', 'success', undefined, {
      agentName,
    });

    /* ---------------- ELEVENLABS (CORRECTED STRUCTURE) ---------------- */
    await log(supabase, requestId, 'elevenlabs_create', 'start');

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          name: agentName,
          conversation_config: {
            agent: {
              prompt: {
                prompt: systemPrompt,        // ✅ Correct: "prompt" not "system"
                llm: 'gpt-4o-mini',           // ✅ Added LLM specification
                temperature: 0.7,
              },
              first_message: firstMessage,   // ✅ Correct: at agent level, not inside prompt
              language: 'en',
            },
            tts: {
              voice_id: 'EXAVITQu4vr4xnSDxMaL',  // ✅ Correct: voice_id in tts block
              model_id: 'eleven_turbo_v2_5',
            },
          },
          platform_settings: {               // ✅ Correct: webhook in platform_settings
            webhook: {
              url: `${APP_URL}/api/webhooks/elevenlabs-router`,
              events: ['conversation.transcript', 'conversation.ended'],
            },
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const text = await elevenRes.text();
      await log(
        supabase,
        requestId,
        'elevenlabs_create',
        'error',
        'ElevenLabs HTTP error',
        { status: elevenRes.status, response: text }
      );
      throw new Error('ElevenLabs create failed');
    }

    const elevenData = await elevenRes.json();
    const agentId = elevenData.agent_id;

    await log(supabase, requestId, 'elevenlabs_create', 'success', undefined, {
      agentId,
    });

    /* ---------------- Save agent ---------------- */
    await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: agentId,
      framework,
      draft_id: draftId,
      status: 'active',
    });

    await supabase
      .from('kira_drafts')
      .update({ status: 'used' })
      .eq('id', draftId);

    return NextResponse.json({
      success: true,
      agentId,
      agentName,
      requestId,
    });
  } catch (err: any) {
    await log(
      supabase,
      requestId,
      'fatal',
      'error',
      err?.message ?? 'Unknown error'
    );

    return NextResponse.json(
      { error: 'Create failed', requestId },
      { status: 500 }
    );
  }
}