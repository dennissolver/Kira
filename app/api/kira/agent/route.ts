// app/api/kira/agent/route.ts
// Get agent info by ElevenLabs agent ID

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Look up agent by ElevenLabs agent ID
    const { data: agent, error } = await supabase
      .from('kira_agents')
      .select('id, user_id, agent_name, journey_type, status, elevenlabs_agent_id')
      .eq('elevenlabs_agent_id', agentId)
      .single();

    if (error || !agent) {
      console.error('[kira/agent] Agent not found:', error);
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: agent.id,
      user_id: agent.user_id,
      agent_name: agent.agent_name,
      journey_type: agent.journey_type,
      status: agent.status,
      elevenlabs_agent_id: agent.elevenlabs_agent_id,
    });

  } catch (error) {
    console.error('[kira/agent] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}