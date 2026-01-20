import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  KiraFramework,
  JourneyType,
} from '@/lib/kira/prompts';

/* -------------------------------------------------------------------------- */
/* Supabase                                                                    */
/* -------------------------------------------------------------------------- */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                     */
/* -------------------------------------------------------------------------- */

async function logStep(
  supabase: ReturnType<typeof getSupabase>,
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

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const supabase = getSupabase();

  try {
    await logStep(supabase, requestId, 'init', 'start');

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('Missing ELEVENLABS_API_KEY');
    }

    const APP_URL =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const { draftId, email } = await req.json();

    await logStep(supabase, requestId, 'request_parsed', 'success', undefined, {
      draftId,
      email,
    });

    /* ------------------------------------------------------------------ */
    /* Draft                                                               */
    /* ------------------------------------------------------------------ */

    const { data: draft } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (!draft) throw new Error('Draft not found');

    /* ------------------------------------------------------------------ */
    /* User                                                                */
    /* ------------------------------------------------------------------ */

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

      if (!res.data) throw new Error('User creation failed');
      user = res.data;
    }

    /* ------------------------------------------------------------------ */
    /* Prompt                                                              */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* ✅ ElevenLabs ConvAI Agent Creation (CORRECT)                        */
    /* ------------------------------------------------------------------ */

    await logStep(supabase, requestId, 'elevenlabs_create', 'start');

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          name: agentName,
          language: 'en',
          model: 'eleven_multilingual_v2',
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
          prompt: {
            system: systemPrompt,
            first_message: firstMessage,
          },
          webhook_url: `${APP_URL}/api/webhooks/elevenlabs-router`,
        }),
      }
    );

    if (!elevenRes.ok) {
      const text = await elevenRes.text();
      await logStep(
        supabase,
        requestId,
        'elevenlabs_create',
        'error',
        'ElevenLabs HTTP error',
        { status: elevenRes.status, response: text }
      );
      throw new Error('ElevenLabs agent creation failed');
    }

    const elevenData = await elevenRes.json();

    await logStep(
      supabase,
      requestId,
      'elevenlabs_create',
      'success',
      undefined,
      { agentId: elevenData.agent_id }
    );

    /* ------------------------------------------------------------------ */
    /* Persist                                                             */
    /* ------------------------------------------------------------------ */

    await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: elevenData.agent_id,
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
      agentId: elevenData.agent_id,
      agentName,
      requestId,
    });
  } catch (err: any) {
    await logStep(
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
