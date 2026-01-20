// app/api/kira/agent/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, userId, feedback } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get the agent details
    const { data: agent, error: fetchError } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('elevenlabs_agent_id', agentId)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update agent status to 'completed'
    const { error: updateError } = await supabase
      .from('kira_agents')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_feedback: feedback || null,
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('[agent/complete] Update error:', updateError);
      throw updateError;
    }

    // Optionally delete the agent from ElevenLabs to free up resources
    // (or keep it for history - uncomment below to delete)
    /*
    try {
      await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });
    } catch (elevenLabsError) {
      console.error('[agent/complete] ElevenLabs delete error:', elevenLabsError);
      // Don't fail if ElevenLabs delete fails
    }
    */

    // Log the completion for analytics
    console.log('[agent/complete] Project completed:', {
      agentId,
      agentName: agent.agent_name,
      userId,
      journeyType: agent.journey_type,
      feedback: feedback ? 'provided' : 'none',
    });

    return NextResponse.json({
      success: true,
      message: 'Project completed successfully',
      agent: {
        id: agent.id,
        name: agent.agent_name,
        status: 'completed',
      },
    });

  } catch (error) {
    console.error('[agent/complete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete project. Please try again.' },
      { status: 500 }
    );
  }
}