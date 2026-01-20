// app/api/kira/create/route.ts
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
/* Logging helper (NO nulls)                                                   */
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
    message: message ?? undefined,
    details: details ?? undefined,
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

    /* ------------------------------------------------------------------ */
    /* Env check                                                           */
    /* ------------------------------------------------------------------ */

    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('Missing ELEVENLABS_API_KEY');
    }

    await logStep(supabase, requestId, 'env_check', 'success');

    /* ------------------------------------------------------------------ */
    /* Parse request                                                       */
    /* ------------------------------------------------------------------ */

    const { draftId, email } = await req.json();

    if (!draftId || !email) {
      return NextResponse.json(
        { error: 'draftId and email required' },
        { status: 400 }
      );
    }

    await logStep(supabase, requestId, 'request_parsed', 'success', undefined, {
      draftId,
      email,
    });

    /* ------------------------------------------------------------------ */
    /* Load draft                                                          */
    /* ------------------------------------------------------------------ */

    await logStep(supabase, requestId, 'draft_load', 'start');

    const { data: draft, error: draftError } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      throw new Error('Draft not found');
    }

    await logStep(supabase, requestId, 'draft_load', 'success', undefined, {
      status: draft.status,
    });

    /* ------------------------------------------------------------------ */
    /* User lookup / create                                                */
    /* ------------------------------------------------------------------ */

    await logStep(supabase, requestId, 'user_lookup', 'start');

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

      if (error || !newUser) {
        throw new Error('Failed to create user');
      }

      user = newUser;
    }

    await logStep(supabase, requestId, 'user_lookup', 'success', undefined, {
      userId: user.id,
    });

    /* ------------------------------------------------------------------ */
    /* Prompt build                                                        */
    /* ------------------------------------------------------------------ */

    await logStep(supabase, requestId, 'prompt_build', 'start');

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

    await logStep(supabase, requestId, 'prompt_build', 'success', undefined, {
      agentName,
    });

    /* ------------------------------------------------------------------ */
    /* ElevenLabs – CORRECT endpoint                                       */
    /* ------------------------------------------------------------------ */

    await logStep(supabase, requestId, 'elevenlabs_create', 'start');

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
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
          webhook_url:
            `${process.env.NEXT_PUBLIC_APP_URL}` +
            `/api/webhooks/elevenlabs-router`,
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
        {
          status: elevenRes.status,
          response: text,
        }
      );
      throw new Error('ElevenLabs failed');
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
    /* Save agent                                                          */
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
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
