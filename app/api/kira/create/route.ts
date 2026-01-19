// app/api/kira/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createKiraAgent, createKiraTools } from '@/lib/elevenlabs/client';
import { getKiraPrompt, generateAgentName, JourneyType } from '@/lib/kira/prompts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, journeyType } = body as {
      firstName: string;
      lastName?: string;
      email: string;
      journeyType: JourneyType;
    };

    // Validate input
    if (!firstName || !email || !journeyType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['personal', 'business'].includes(journeyType)) {
      return NextResponse.json(
        { error: 'Invalid journey type' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // ==========================================================================
    // 1. Check if user exists, create if not
    // ==========================================================================
    let { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[kira/create] Existing user: ${userId}`);
    } else {
      // Create new user
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName || null,
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
    // 2. Check if user already has a Kira for this journey type
    // ==========================================================================
    const { data: existingAgent } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('user_id', userId)
      .eq('journey_type', journeyType)
      .eq('status', 'active')
      .single();

    if (existingAgent) {
      console.log(`[kira/create] User already has ${journeyType} Kira: ${existingAgent.elevenlabs_agent_id}`);
      return NextResponse.json({
        success: true,
        agentId: existingAgent.elevenlabs_agent_id,
        isExisting: true,
      });
    }

    // ==========================================================================
    // 3. Create ElevenLabs tools for this agent
    // ==========================================================================
    console.log(`[kira/create] Creating tools...`);
    const toolIds = await createKiraTools(APP_URL);
    console.log(`[kira/create] Created ${toolIds.length} tools`);

    // ==========================================================================
    // 4. Generate Kira's prompt based on journey type
    // ==========================================================================
    const { systemPrompt, firstMessage } = getKiraPrompt({
      userName: firstName,
      journeyType,
    });

    // ==========================================================================
    // 5. Create the ElevenLabs agent
    // ==========================================================================
    const agentName = generateAgentName(journeyType, firstName, userId);
    
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
    // 6. Save agent to database
    // ==========================================================================
    const { data: savedAgent, error: agentError } = await supabase
      .from('kira_agents')
      .insert({
        user_id: userId,
        agent_name: agentName,
        journey_type: journeyType,
        elevenlabs_agent_id: agent.agent_id,
        elevenlabs_tool_ids: toolIds,
      })
      .select()
      .single();

    if (agentError) {
      console.error('[kira/create] Failed to save agent:', agentError);
      // Note: Agent was created in ElevenLabs but failed to save - might want to clean up
      return NextResponse.json(
        { error: 'Failed to save Kira configuration' },
        { status: 500 }
      );
    }

    console.log(`[kira/create] Saved agent to DB: ${savedAgent.id}`);

    // ==========================================================================
    // 7. Return success
    // ==========================================================================
    return NextResponse.json({
      success: true,
      agentId: agent.agent_id,
      agentName,
      journeyType,
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
