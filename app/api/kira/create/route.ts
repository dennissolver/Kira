// app/api/kira/create/route.ts
// Creates an Operational Kira from an approved draft framework
//
// FLOW:
// 1. User completes setup with Setup Kira → draft saved to kira_drafts
// 2. User reviews/edits draft on /setup/draft/[draftId]
// 3. User submits → this endpoint is called with draftId
// 4. We fetch the draft, create ElevenLabs agent, save to kira_agents
// 5. User redirected to /chat/[agentId]
//
// IMPORTANT: Each draft creates a NEW agent. Users can have multiple agents.

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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kira-rho.vercel.app';

// ElevenLabs Voice & Model Configuration
const ELEVENLABS_CONFIG = {
  voice_id: 'EXAVITQu4vr4xnSDxMaL',  // Sarah - warm, friendly female voice
  tts_model: 'eleven_turbo_v2',       // Optimized for real-time conversations
  llm: 'gpt-4o-mini',                 // Fast, cost-effective LLM
  temperature: 0.7,                    // Balanced creativity
  max_duration_seconds: 3600,          // 1 hour max conversation
};

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
  try {
    await supabase.from('kira_logs').insert({
      request_id: requestId,
      step,
      status,
      message,
      details,
    });
  } catch (e) {
    console.error('[kira/create] Log failed:', e);
  }
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

    const { data: draft, error: draftError } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // Check if draft was already used
    if (draft.status === 'used') {
      await log(supabase, requestId, 'draft_load', 'error', 'Draft already used');

      // Find the agent that was created from this draft
      const { data: existingAgent } = await supabase
        .from('kira_agents')
        .select('elevenlabs_agent_id, agent_name')
        .eq('draft_id', draftId)
        .single();

      if (existingAgent) {
        return NextResponse.json({
          success: true,
          agentId: existingAgent.elevenlabs_agent_id,
          agentName: existingAgent.agent_name,
          isExisting: true,
          message: 'This draft was already used to create an agent',
        });
      }

      throw new Error('Draft already used but no agent found');
    }

    await log(supabase, requestId, 'draft_load', 'success', undefined, {
      status: draft.status,
      objective: draft.primary_objective,
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

      if (error || !newUser) {
        await log(supabase, requestId, 'user_lookup', 'error', 'User create failed', { error });
        throw new Error('User create failed');
      }
      user = newUser;
    }

    await log(supabase, requestId, 'user_lookup', 'success', undefined, {
      userId: user.id,
    });

    /* ---------------- Build Framework & Prompt ---------------- */
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

    // Generate agent name with topic for clarity
    // Format: Kira_Dennis_ChocolateCake_7f1c
    const agentName = generateAgentName(
      draft.journey_type,
      firstName,
      draft.primary_objective,
      user.id
    );

    await log(supabase, requestId, 'prompt_build', 'success', undefined, {
      agentName,
      objective: draft.primary_objective,
    });

    /* ---------------- Create ElevenLabs Agent ---------------- */
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
                prompt: systemPrompt,
                llm: ELEVENLABS_CONFIG.llm,
                temperature: ELEVENLABS_CONFIG.temperature,
              },
              first_message: firstMessage,
              language: 'en',
            },
            tts: {
              model_id: ELEVENLABS_CONFIG.tts_model,
              voice_id: ELEVENLABS_CONFIG.voice_id,
            },
            conversation: {
              max_duration_seconds: ELEVENLABS_CONFIG.max_duration_seconds,
            },
          },
          platform_settings: {
            webhook: {
              url: `${APP_URL}/api/kira/webhook`,
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
      throw new Error(`ElevenLabs create failed: ${elevenRes.status}`);
    }

    const elevenData = await elevenRes.json();
    const agentId = elevenData.agent_id;

    await log(supabase, requestId, 'elevenlabs_create', 'success', undefined, {
      agentId,
    });

    /* ---------------- Save Agent to Database ---------------- */
    await log(supabase, requestId, 'agent_save', 'start');

    const { error: agentError } = await supabase.from('kira_agents').insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: agentId,
      framework,
      draft_id: draftId,
      status: 'active',
      voice_id: ELEVENLABS_CONFIG.voice_id,
    });

    if (agentError) {
      await log(supabase, requestId, 'agent_save', 'error', 'Failed to save agent', { error: agentError });
      // Don't throw - agent was created in ElevenLabs, we should still return it
      console.error('[kira/create] Failed to save agent to DB:', agentError);
    } else {
      await log(supabase, requestId, 'agent_save', 'success');
    }

    /* ---------------- Mark Draft as Used ---------------- */
    const { error: draftUpdateError } = await supabase
      .from('kira_drafts')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (draftUpdateError) {
      console.error('[kira/create] Failed to mark draft as used:', draftUpdateError);
    }

    await log(supabase, requestId, 'complete', 'success', undefined, {
      agentId,
      agentName,
    });

    return NextResponse.json({
      success: true,
      agentId,
      agentName,
      requestId,
    });

  } catch (err: any) {
    console.error('[kira/create] Error:', err);

    await log(
      supabase,
      requestId,
      'fatal',
      'error',
      err?.message ?? 'Unknown error'
    );

    return NextResponse.json(
      { error: err?.message || 'Create failed', requestId },
      { status: 500 }
    );
  }
}