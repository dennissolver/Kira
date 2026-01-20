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
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    /* ------------------------------------------------------------------ */
    /* Env check                                                           */
    /* ------------------------------------------------------------------ */

    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY missing' },
        { status: 500 }
      );
    }

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

    /* ------------------------------------------------------------------ */
    /* Load draft                                                          */
    /* ------------------------------------------------------------------ */

    const { data: draft, error: draftError } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    /* ------------------------------------------------------------------ */
    /* User lookup / create                                                */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* Build Kira prompt                                                   */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* 🔥 CREATE ELEVENLABS AGENT — CORRECT WAY                             */
    /* ------------------------------------------------------------------ */

    const agentConfig = {
      name: agentName,

      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
          },
          first_message: firstMessage,
          language: 'en',
        },

        tts: {
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
          model_id: 'eleven_turbo_v2_5',
        },

        stt: {
          provider: 'elevenlabs',
        },

        turn: {
          mode: 'turn_based',
        },
      },

      platform_settings: {
        webhook: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/elevenlabs-router`,
          events: ['conversation.transcript', 'conversation.ended'],
        },
      },
    };

    const createRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentConfig),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('[kira/create] ElevenLabs error:', err);
      return NextResponse.json(
        { error: 'ElevenLabs agent creation failed', details: err },
        { status: 500 }
      );
    }

    const agent = await createRes.json();
    const elevenlabsAgentId = agent.agent_id;

    /* ------------------------------------------------------------------ */
    /* Save agent                                                          */
    /* ------------------------------------------------------------------ */

    await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: elevenlabsAgentId,
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
      agentId: elevenlabsAgentId,
      agentName,
      requestId,
    });

  } catch (error: any) {
    console.error('[kira/create] Fatal:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
