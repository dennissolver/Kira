// app/api/kira/create/route.ts
// Fully instrumented, CORRECT ElevenLabs ConvAI agent creation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  KiraFramework,
  JourneyType,
} from '@/lib/kira/prompts';
import { randomUUID } from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

function log(
  supabase: any,
  requestId: string,
  step: string,
  status: 'start' | 'success' | 'error',
  message?: string,
  details?: any
) {
  return supabase.from('kira_logs').insert({
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
      throw new Error('Missing ELEVENLABS_API_KEY');
    }

    await log(supabase, requestId, 'env_check', 'success');

    const { draftId, email } = await req.json();
    await log(supabase, requestId, 'request_parsed', 'success', null, {
      draftId,
      email,
    });

    /* ---------------- Load draft ---------------- */

    await log(supabase, requestId, 'draft_load', 'start');

    const { data: draft } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (!draft) throw new Error('Draft not found');

    await log(supabase, requestId, 'draft_load', 'success', null, {
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
      const res = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
        })
        .select()
        .single();

      user = res.data;
    }

    await log(supabase, requestId, 'user_lookup', 'success', null, {
      userId: user.id,
    });

    /* ---------------- Prompt ---------------- */

    await log(supabase, requestId, 'prompt_build', 'start');

    const framework: KiraFramework = {
      userName: draft.user_name,
      firstName,
      location: draft.location,
      journeyType: draft.journey_type as JourneyType,
      primaryObjective: draft.primary_objective,
      keyContext: draft.key_context || [],
      successDefinition: draft.success_definition,
      constraints: draft.constraints,
    };

    const { systemPrompt, firstMessage } = getKiraPrompt({ framework });

    const agentName = generateAgentName(
      draft.journey_type,
      firstName,
      user.id
    );

    await log(supabase, requestId, 'prompt_build', 'success', null, {
      agentName,
    });

    /* ---------------- ELEVENLABS (THE FIX) ---------------- */

    await log(supabase, requestId, 'elevenlabs_create', 'start');

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        method: 'PUT', // ✅ THIS WAS THE BUG
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          name: agentName,
          conversation_config: {
            agent: {
              model: 'eleven_multilingual_v2',
              voice_id: 'EXAVITQu4vr4xnSDxMaL',
              prompt: {
                system: systemPrompt,
                first_message: firstMessage,
              },
            },
          },
          webhook_url: `${APP_URL}/api/webhooks/elevenlabs-router`,
        }),
      }
    );

    const responseText = await elevenRes.text();

    if (!elevenRes.ok) {
      await log(
        supabase,
        requestId,
        'elevenlabs_create',
        'error',
        'ElevenLabs HTTP error',
        {
          status: elevenRes.status,
          response: responseText,
        }
      );
      throw new Error('ElevenLabs agent creation failed');
    }

    const agent = JSON.parse(responseText);

    await log(
      supabase,
      requestId,
      'elevenlabs_create',
      'success',
      null,
      { agent_id: agent.agent_id }
    );

    /* ---------------- Save agent ---------------- */

    await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: agent.agent_id,
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
      agentId: agent.agent_id,
      requestId,
    });
  } catch (err: any) {
    await log(
      supabase,
      requestId,
      'fatal',
      'error',
      err.message
    );

    return NextResponse.json(
      { error: err.message, requestId },
      { status: 500 }
    );
  }
}
