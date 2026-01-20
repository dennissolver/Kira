// app/api/kira/create/route.ts
// Creates an Operational Kira AND a real ElevenLabs ConvAI agent

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  KiraFramework,
  JourneyType,
} from '@/lib/kira/prompts';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

interface CreateKiraRequest {
  draftId: string;
  email: string;
}

interface KiraDraft {
  id: string;
  user_name: string;
  location: string;
  journey_type: JourneyType;
  primary_objective: string;
  key_context: string[];
  success_definition?: string;
  constraints?: string[];
  status: 'pending' | 'approved' | 'used';
}

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'Missing ELEVENLABS_API_KEY' },
        { status: 500 }
      );
    }

    const { draftId, email } =
      (await request.json()) as CreateKiraRequest;

    if (!draftId || !email) {
      return NextResponse.json(
        { error: 'draftId and email required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    /* ------------------------------------------------------------------ */
    /* 1. Load draft                                                       */
    /* ------------------------------------------------------------------ */

    const { data: draft, error: draftError } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const typedDraft = draft as KiraDraft;

    if (typedDraft.status === 'used') {
      return NextResponse.json(
        { error: 'Draft already used' },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------------ */
    /* 2. Resolve / create user                                            */
    /* ------------------------------------------------------------------ */

    const firstName = extractFirstName(typedDraft.user_name);

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
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      user = newUser;
    }

    /* ------------------------------------------------------------------ */
    /* 3. Prevent duplicate Kira                                           */
    /* ------------------------------------------------------------------ */

    const { data: existingAgent } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('journey_type', typedDraft.journey_type)
      .eq('status', 'active')
      .single();

    if (existingAgent) {
      await supabase
        .from('kira_drafts')
        .update({ status: 'used' })
        .eq('id', draftId);

      return NextResponse.json({
        success: true,
        agentId: existingAgent.elevenlabs_agent_id,
        isExisting: true,
      });
    }

    /* ------------------------------------------------------------------ */
    /* 4. Build framework + prompt                                         */
    /* ------------------------------------------------------------------ */

    const framework: KiraFramework = {
      userName: typedDraft.user_name,
      firstName,
      location: typedDraft.location,
      journeyType: typedDraft.journey_type,
      primaryObjective: typedDraft.primary_objective,
      keyContext: typedDraft.key_context || [],
      successDefinition: typedDraft.success_definition,
      constraints: typedDraft.constraints,
    };

    const { systemPrompt, firstMessage } = getKiraPrompt({ framework });

    const agentName = generateAgentName(
      typedDraft.journey_type,
      firstName,
      user.id
    );

    /* ------------------------------------------------------------------ */
    /* 5. CREATE ELEVENLABS CONVAI AGENT (REAL FIX)                         */
    /* ------------------------------------------------------------------ */

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
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
      }
    );

    if (!elevenRes.ok) {
      const err = await elevenRes.text();
      console.error('[kira/create] ElevenLabs error:', err);
      return NextResponse.json(
        { error: 'Failed to create ConvAI agent' },
        { status: 500 }
      );
    }

    const elevenAgent = await elevenRes.json();
    const elevenlabsAgentId = elevenAgent.agent_id;

    /* ------------------------------------------------------------------ */
    /* 6. Save Kira agent                                                   */
    /* ------------------------------------------------------------------ */

    const { error: saveError } = await supabase
      .from('kira_agents')
      .insert({
        user_id: user.id,
        agent_name: agentName,
        journey_type: typedDraft.journey_type,
        elevenlabs_agent_id: elevenlabsAgentId,
        framework,
        draft_id: draftId,
        status: 'active',
      });

    if (saveError) {
      return NextResponse.json(
        { error: 'Failed to save agent' },
        { status: 500 }
      );
    }

    await supabase
      .from('kira_drafts')
      .update({ status: 'used' })
      .eq('id', draftId);

    /* ------------------------------------------------------------------ */
    /* 7. Done                                                             */
    /* ------------------------------------------------------------------ */

    return NextResponse.json({
      success: true,
      agentId: elevenlabsAgentId,
      agentName,
      isExisting: false,
    });
  } catch (err) {
    console.error('[kira/create] Fatal:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
