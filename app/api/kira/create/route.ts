// app/api/kira/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/kira/logger';
import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  JourneyType,
  KiraFramework,
} from '@/lib/kira/prompts';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(req: NextRequest) {
  const requestId =
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    console.error('[KIRA] Supabase init failed', e);
    return NextResponse.json(
      { step: 'supabase_init', requestId },
      { status: 500 }
    );
  }

  const { log } = createLogger(supabase, requestId);

  try {
    await log('init', 'start');

    /* ---------------- ENV CHECK ---------------- */
    if (!ELEVENLABS_API_KEY || !APP_URL) {
      await log('env_check', 'error', 'Missing env vars', {
        ELEVENLABS_API_KEY: !!ELEVENLABS_API_KEY,
        APP_URL: !!APP_URL,
      });
      return NextResponse.json(
        { step: 'env_check', requestId },
        { status: 500 }
      );
    }
    await log('env_check', 'success');

    /* ---------------- REQUEST ---------------- */
    const body = await req.json();
    const { draftId, email } = body;

    if (!draftId || !email) {
      await log('request_validation', 'error', 'Missing fields', body);
      return NextResponse.json(
        { step: 'request_validation', requestId },
        { status: 400 }
      );
    }

    await log('request_parsed', 'success', undefined, {
      draftId,
      email,
    });

    /* ---------------- LOAD DRAFT ---------------- */
    await log('draft_load', 'start');

    const { data: drafts, error: draftErr } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId);

    if (draftErr || !drafts || drafts.length !== 1) {
      await log('draft_load', 'error', 'Draft fetch failed', {
        draftErr,
        count: drafts?.length,
      });
      return NextResponse.json(
        { step: 'draft_load', requestId },
        { status: 500 }
      );
    }

    const draft = drafts[0];

    if (draft.status === 'used') {
      await log('draft_status', 'error', 'Draft already used');
      return NextResponse.json(
        { step: 'draft_status', requestId },
        { status: 400 }
      );
    }

    await log('draft_load', 'success', undefined, {
      status: draft.status,
    });

    /* ---------------- USER ---------------- */
    await log('user_lookup', 'start');

    let { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase());

    let user = users?.[0];

    if (!user) {
      await log('user_create', 'start');

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: extractFirstName(draft.user_name),
        })
        .select()
        .single();

      if (error || !newUser) {
        await log('user_create', 'error', 'User create failed', error);
        return NextResponse.json(
          { step: 'user_create', requestId },
          { status: 500 }
        );
      }

      user = newUser;
      await log('user_create', 'success', undefined, {
        userId: user.id,
      });
    } else {
      await log('user_lookup', 'success', undefined, {
        userId: user.id,
      });
    }

    /* ---------------- DUPLICATE AGENT CHECK ---------------- */
    await log('agent_check', 'start');

    const { data: agents } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('journey_type', draft.journey_type)
      .eq('status', 'active');

    if (agents && agents.length > 0) {
      await log('agent_check', 'success', 'Existing agent reused', {
        agentId: agents[0].elevenlabs_agent_id,
      });

      await supabase
        .from('kira_drafts')
        .update({ status: 'used' })
        .eq('id', draftId);

      return NextResponse.json({
        success: true,
        agentId: agents[0].elevenlabs_agent_id,
        isExisting: true,
        requestId,
      });
    }

    /* ---------------- PROMPT ---------------- */
    await log('prompt_build', 'start');

    const framework: KiraFramework = {
      userName: draft.user_name,
      firstName: extractFirstName(draft.user_name),
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
      framework.firstName,
      user.id
    );

    await log('prompt_build', 'success', undefined, {
      agentName,
    });

    /* ---------------- ELEVENLABS CREATE (CORRECT SCHEMA) ---------------- */
    await log('elevenlabs_create', 'start');

    const payload = {
      name: agentName,
      conversation_config: {
        agent: {
          prompt: {
            system: systemPrompt,
            first_message: firstMessage,
          },
          model: 'eleven_multilingual_v2',
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
        },
      },
      webhook_url: `${APP_URL}/api/webhooks/elevenlabs-router`,
    };

    const res = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await res.text();

    if (!res.ok) {
      await log('elevenlabs_create', 'error', 'ElevenLabs HTTP error', {
        status: res.status,
        response: responseText,
        payload,
      });
      return NextResponse.json(
        { step: 'elevenlabs_create', requestId },
        { status: 500 }
      );
    }

    const eleven = JSON.parse(responseText);

    if (!eleven.agent_id) {
      await log('elevenlabs_parse', 'error', 'Missing agent_id', eleven);
      return NextResponse.json(
        { step: 'elevenlabs_parse', requestId },
        { status: 500 }
      );
    }

    await log('elevenlabs_create', 'success', undefined, {
      agentId: eleven.agent_id,
    });

    /* ---------------- SAVE AGENT ---------------- */
    await log('agent_insert', 'start');

    const { error: insertErr } = await supabase
      .from('kira_agents')
      .insert({
        user_id: user.id,
        agent_name: agentName,
        journey_type: draft.journey_type,
        elevenlabs_agent_id: eleven.agent_id,
        framework,
        draft_id: draftId,
        status: 'active',
      });

    if (insertErr) {
      await log('agent_insert', 'error', 'Insert failed', insertErr);
      return NextResponse.json(
        { step: 'agent_insert', requestId },
        { status: 500 }
      );
    }

    await supabase
      .from('kira_drafts')
      .update({ status: 'used' })
      .eq('id', draftId);

    await log('complete', 'success');

    return NextResponse.json({
      success: true,
      agentId: eleven.agent_id,
      requestId,
    });
  } catch (err) {
    await log('fatal', 'error', 'Unhandled exception', {
      message: String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      { step: 'fatal', requestId },
      { status: 500 }
    );
  }
}
