// app/api/kira/create/route.ts
// Creates an Operational Kira from an approved draft framework
//
// FLOW:
// 1. User completes setup with Setup Kira → draft saved to kira_drafts
// 2. User reviews/edits draft on /setup/draft/[draftId]
// 3. User submits → this endpoint is called with draftId
// 4. We fetch the draft, create ElevenLabs agent, save to kira_agents
// 5. User redirected to /chat/[agentId]

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createKiraAgent, createKiraTools } from '@/lib/elevenlabs/client';
import { getKiraPrompt, generateAgentName, extractFirstName, KiraFramework, JourneyType } from '@/lib/kira/prompts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Expected request body
interface CreateKiraRequest {
  draftId: string;
  email: string;
}

// Draft structure from kira_drafts table
interface KiraDraft {
  id: string;
  session_id: string;
  user_name: string;
  location: string;
  journey_type: JourneyType;
  primary_objective: string;
  key_context: string[];
  success_definition?: string;
  constraints?: string[];
  status: 'pending' | 'approved' | 'used';
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, email } = body as CreateKiraRequest;

    // ==========================================================================
    // 1. Validate input
    // ==========================================================================
    if (!draftId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: draftId and email are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // ==========================================================================
    // 2. Fetch the draft framework
    // ==========================================================================
    const { data: draft, error: draftError } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      console.error('[kira/create] Draft not found:', draftError);
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const typedDraft = draft as KiraDraft;

    // Check draft hasn't already been used
    if (typedDraft.status === 'used') {
      console.error('[kira/create] Draft already used:', draftId);
      return NextResponse.json(
        { error: 'This draft has already been used to create a Kira' },
        { status: 400 }
      );
    }

    // Validate journey type
    if (!['personal', 'business'].includes(typedDraft.journey_type)) {
      return NextResponse.json(
        { error: 'Invalid journey type in draft' },
        { status: 400 }
      );
    }

    console.log(`[kira/create] Processing draft: ${draftId} for ${typedDraft.user_name}`);

    // ==========================================================================
    // 3. Check if user exists, create if not
    // ==========================================================================
    const firstName = extractFirstName(typedDraft.user_name);
    const nameParts = typedDraft.user_name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    let { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[kira/create] Existing user: ${userId}`);

      // Update user's name if different (they may have provided more info in setup)
      if (existingUser.first_name !== firstName) {
        await supabase
          .from('users')
          .update({
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } else {
      // Create new user
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error('[kira/create] Failed to create user:', userError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      userId = newUser.id;
      console.log(`[kira/create] Created user: ${userId}`);
    }

    // ==========================================================================
    // 4. Check if user already has a Kira for this journey type
    // ==========================================================================
    const { data: existingAgent } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('user_id', userId)
      .eq('journey_type', typedDraft.journey_type)
      .eq('status', 'active')
      .single();

    if (existingAgent) {
      console.log(`[kira/create] User already has ${typedDraft.journey_type} Kira: ${existingAgent.elevenlabs_agent_id}`);

      // Mark draft as used anyway
      await supabase
        .from('kira_drafts')
        .update({ status: 'used', updated_at: new Date().toISOString() })
        .eq('id', draftId);

      return NextResponse.json({
        success: true,
        agentId: existingAgent.elevenlabs_agent_id,
        isExisting: true,
        message: 'You already have a Kira for this journey type',
      });
    }

    // ==========================================================================
    // 5. Build the KiraFramework from the draft
    // ==========================================================================
    const framework: KiraFramework = {
      userName: typedDraft.user_name,
      firstName: firstName,
      location: typedDraft.location,
      journeyType: typedDraft.journey_type,
      primaryObjective: typedDraft.primary_objective,
      keyContext: typedDraft.key_context || [],
      successDefinition: typedDraft.success_definition,
      constraints: typedDraft.constraints,
    };

    console.log(`[kira/create] Built framework for ${framework.firstName} (${framework.journeyType})`);

    // ==========================================================================
    // 6. Create ElevenLabs tools for this agent
    // ==========================================================================
    console.log(`[kira/create] Creating tools...`);
    const toolIds = await createKiraTools(APP_URL);
    console.log(`[kira/create] Created ${toolIds.length} tools`);

    // ==========================================================================
    // 7. Generate Kira's prompt from the framework
    // ==========================================================================
    const { systemPrompt, firstMessage } = getKiraPrompt({
      framework,
      // These can be added later:
      // uploadedKnowledge: undefined,
      // existingMemory: undefined,
    });

    // ==========================================================================
    // 8. Create the ElevenLabs agent
    // ==========================================================================
    const agentName = generateAgentName(typedDraft.journey_type, firstName, userId);

    console.log(`[kira/create] Creating agent: ${agentName}`);

    const agent = await createKiraAgent({
      name: agentName,
      systemPrompt,
      firstMessage,
      toolIds,
      webhookUrl: APP_URL,
    });

    console.log(`[kira/create] Created ElevenLabs agent: ${agent.agent_id}`);

    // ==========================================================================
    // 9. Save agent to database
    // ==========================================================================
    const { data: savedAgent, error: agentError } = await supabase
      .from('kira_agents')
      .insert({
        user_id: userId,
        agent_name: agentName,
        journey_type: typedDraft.journey_type,
        elevenlabs_agent_id: agent.agent_id,
        elevenlabs_tool_ids: toolIds,
        framework: framework, // Store the framework for reference
        draft_id: draftId,    // Link back to the draft
      })
      .select()
      .single();

    if (agentError) {
      console.error('[kira/create] Failed to save agent:', agentError);
      // TODO: Consider cleaning up the ElevenLabs agent if DB save fails
      return NextResponse.json(
        { error: 'Failed to save Kira configuration' },
        { status: 500 }
      );
    }

    console.log(`[kira/create] Saved agent to DB: ${savedAgent.id}`);

    // ==========================================================================
    // 10. Mark draft as used
    // ==========================================================================
    await supabase
      .from('kira_drafts')
      .update({
        status: 'used',
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId);

    console.log(`[kira/create] Marked draft ${draftId} as used`);

    // ==========================================================================
    // 11. Return success
    // ==========================================================================
    return NextResponse.json({
      success: true,
      agentId: agent.agent_id,
      agentName,
      journeyType: typedDraft.journey_type,
      userName: typedDraft.user_name,
      isExisting: false,
    });

  } catch (error) {
    console.error('[kira/create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}