// app/api/kira/create/route.ts
// HARDENED: Creates a Kira + ElevenLabs ConvAI agent with FULL ERROR VISIBILITY

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getKiraPrompt,
  generateAgentName,
  extractFirstName,
  KiraFramework,
  JourneyType,
} from '@/lib/kira/prompts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fail(step: string, error: any, status = 500) {
  console.error(`[kira/create][${step}]`, error);
  return NextResponse.json(
    {
      step,
      message: error?.message || String(error),
      details: error?.details || error,
    },
    { status }
  );
}

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  /* ---------------------------------------------------------------------- */
  /* 0. ENV GUARDS                                                           */
  /* ---------------------------------------------------------------------- */

  if (!ELEVENLABS_API_KEY) {
    return fail('env', 'Missing ELEVENLABS_API_KEY');
  }

  if (!APP_URL) {
    return fail('env', 'Missing NEXT_PUBLIC_APP_URL');
  }

  let body: CreateKiraRequest;

  try {
    body = await request.json();
  } catch (err) {
    return fail('request.json', err, 400);
  }

  const { draftId, email } = body;

  if (!draftId || !email) {
    return fail('validation', 'draftId and email required', 400);
  }

  const supabase = createServiceClient();

  /* ---------------------------------------------------------------------- */
  /* 1. LOAD DRAFT (NO .single())                                            */
  /* ---------------------------------------------------------------------- */

  const { data: drafts, error: draftError } = await supabase
    .from('kira_drafts')
    .select('*')
    .eq('id', draftId);

  if (draftError) {
    return fail('load_draft', draftError);
  }

  if (!drafts || drafts.length === 0) {
    return fail('load_draft', 'Draft not found', 404);
  }

  if (drafts.length > 1) {
    return fail('load_draft', 'Multiple drafts found for same id');
  }

  const draft = drafts[0] as KiraDraft;

  if (draft.status === 'used') {
    return fail('draft_status', 'Draft already used', 400);
  }

  /* ---------------------------------------------------------------------- */
  /* 2. RESOLVE / CREATE USER (NO .single())                                 */
  /* ---------------------------------------------------------------------- */

  const firstName = extractFirstName(draft.user_name);

  const { data: users, error: userSelectError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase());

  if (userSelectError) {
    return fail('user_select', userSelectError);
  }

  let user = users?.[0];

  if (!user) {
    const { data: newUsers, error: userInsertError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        first_name: firstName,
      })
      .select();

    if (userInsertError) {
      return fail('user_insert', userInsertError);
    }

    user = newUsers?.[0];

    if (!user) {
      return fail('user_insert', 'User insert returned no row');
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 3. CHECK EXISTING ACTIVE AGENT (NO .single())                           */
  /* ---------------------------------------------------------------------- */

  const { data: agents, error: agentSelectError } = await supabase
    .from('kira_agents')
    .select('*')
    .eq('user_id', user.id)
    .eq('journey_type', draft.journey_type)
    .eq('status', 'active');

  if (agentSelectError) {
    return fail('agent_select', agentSelectError);
  }

  if (agents && agents.length > 0) {
    // Mark draft used but DO NOT fail if this update fails
    await supabase
      .from('kira_drafts')
      .update({ status: 'used' })
      .eq('id', draftId);

    return NextResponse.json({
      success: true,
      agentId: agents[0].elevenlabs_agent_id,
      isExisting: true,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 4. BUILD FRAMEWORK + PROMPT                                             */
  /* ---------------------------------------------------------------------- */

  const framework: KiraFramework = {
    userName: draft.user_name,
    firstName,
    location: draft.location,
    journeyType: draft.journey_type,
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

  /* ---------------------------------------------------------------------- */
  /* 5. CREATE ELEVENLABS CONVAI AGENT (CORRECT PAYLOAD)                     */
  /* ---------------------------------------------------------------------- */

  const elevenPayload = {
    name: agentName,
    conversation_config: {
      system_prompt: systemPrompt,
      first_message: firstMessage,
    },
    webhooks: {
      conversation_start: `${APP_URL}/api/webhooks/elevenlabs-router`,
      message: `${APP_URL}/api/webhooks/elevenlabs-router`,
    },
  };

  let elevenRes: Response;

  try {
    elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify(elevenPayload),
      }
    );
  } catch (err) {
    return fail('eleven_fetch', err);
  }

  if (!elevenRes.ok) {
    const text = await elevenRes.text();
    return fail('eleven_response', text);
  }

  const elevenJson = await elevenRes.json();

  if (!elevenJson?.agent_id) {
    return fail('eleven_parse', elevenJson);
  }

  const elevenlabsAgentId = elevenJson.agent_id;

  /* ---------------------------------------------------------------------- */
  /* 6. SAVE AGENT                                                          */
  /* ---------------------------------------------------------------------- */

  const { error: agentInsertError } = await supabase
    .from('kira_agents')
    .insert({
      user_id: user.id,
      agent_name: agentName,
      journey_type: draft.journey_type,
      elevenlabs_agent_id: elevenlabsAgentId,
      framework,
      draft_id: draftId,
      status: 'active',
    });

  if (agentInsertError) {
    return fail('agent_insert', agentInsertError);
  }

  /* ---------------------------------------------------------------------- */
  /* 7. MARK DRAFT USED (LOG BUT DO NOT FAIL)                                */
  /* ---------------------------------------------------------------------- */

  const { error: draftUpdateError } = await supabase
    .from('kira_drafts')
    .update({ status: 'used' })
    .eq('id', draftId);

  if (draftUpdateError) {
    console.error('[kira/create][draft_update]', draftUpdateError);
  }

  /* ---------------------------------------------------------------------- */
  /* 8. DONE                                                                */
  /* ---------------------------------------------------------------------- */

  return NextResponse.json({
    success: true,
    agentId: elevenlabsAgentId,
    agentName,
    isExisting: false,
  });
}
