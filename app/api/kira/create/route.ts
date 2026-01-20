// app/api/kira/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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
  const requestId = randomUUID();
  const supabase = createServiceClient();
  const { log } = createLogger(supabase, requestId);

  try {
    await log('init', 'start');

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

    const body = await req.json();
    const { draftId, email } = body;
    await log('request_parsed', 'success', undefined, { draftId, email });

    /* -------------------- LOAD DRAFT -------------------- */
    await log('draft_load', 'start');

    const { data: drafts, error: draftErr } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId);

    if (draftErr || !drafts || drafts.length !== 1) {
      await log('draft_load', 'error', 'Draft fetch failed', {
        error: draftErr,
        count: drafts?.length,
      });
      return NextResponse.json(
        { step: 'draft_load', requestId },
        { status: 500 }
      );
    }

    const draft = drafts[0];
    await log('draft_load', 'success', undefined, { status: draft.status });

    if (draft.status === 'used') {
      await log('draft_status', 'error', 'Draft already used');
      return NextResponse.json(
        { step: 'draft_status', requestId },
        { status: 400 }
      );
    }

    /* -------------------- USER -------------------- */
    await log('user_lookup', 'start');

    let { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase());

    let user = users?.[0];

    if (!user) {
      await log('user_create', 'start');
      const firstName = extractFirstName(draft.user_name);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
        })
        .select()
        .single();

      if (error || !newUser) {
        await log('user_create', 'error', 'User creation failed', error);
        return NextResponse.json(
          { step: 'user_create', requestId },
          { status: 500 }
        );
      }

      user = newUser;
      await log('user_create', 'success', undefined, { userId: user.id });
    } else {
      await log('user_lookup', 'success', undefined, { userId: user.id });
    }

    /* -------------------- DUPLICATE AGENT CHECK -------------------- */
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

    /* -------------------- PROMPT -------------------- */
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

    await log('prompt_build', 'success', undefined, { agentName });

    /* -------------------- ELEVENLABS -------------------- */
    await log('elevenlabs_create', 'start');

    let elevenJson;
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
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
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text);
      }

      elevenJson = JSON.parse(text);
    } catch (err) {
      await log('elevenlabs_create', 'error', 'ElevenLabs failed', err);
      return NextResponse.json(
        { step: 'elevenlabs_create', requestId },
        { status: 500 }
      );
    }

    if (!elevenJson.agent_id) {
      await log('elevenlabs_parse', 'error', 'Missing agent_id', elevenJson);
      return NextResponse.json(
        { step: 'elevenlabs_parse', requestId },
        { status: 500 }
      );
    }

    await log('elevenlabs_create', 'success', undefined, {
      agentId: elevenJson.agent_id,
    });

    /* -------------------- SAVE AGENT -------------------- */
    await log('agent_insert', 'start');

    const { error: insertErr } = await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: elevenJson.agent_id,
      framework,
      draft_id: draftId,
      status: 'active',
    });

    if (insertErr) {
      await log('agent_insert', 'error', 'DB insert failed', insertErr);
      return NextResponse.json(
        { step: 'agent_insert', requestId },
        { status: 500 }
      );
    }

    await log('agent_insert', 'success');

    await supabase
      .from('kira_drafts')
      .update({ status: 'used' })
      .eq('id', draftId);

    await log('complete', 'success');

    return NextResponse.json({
      success: true,
      agentId: elevenJson.agent_id,
      requestId,
    });
  } catch (err) {
    await log('fatal', 'error', 'Unhandled exception', err);
    return NextResponse.json(
      { step: 'fatal', requestId },
      { status: 500 }
    );
  }
}
