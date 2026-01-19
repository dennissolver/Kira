// app/api/kira/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/elevenlabs/client';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId } = body as { agentId: string };

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Verify this agent exists in our database
    const supabase = createServiceClient();
    const { data: agent } = await supabase
      .from('kira_agents')
      .select('*')
      .eq('elevenlabs_agent_id', agentId)
      .eq('status', 'active')
      .single();

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get signed URL from ElevenLabs
    const signedUrl = await getSignedUrl(agentId);

    // Create a conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: agent.user_id,
        kira_agent_id: agent.id,
        status: 'active',
      })
      .select()
      .single();

    if (convError) {
      console.warn('[kira/start] Failed to create conversation record:', convError);
      // Don't fail the request - conversation tracking is secondary
    }

    // Update agent's last conversation timestamp
    await supabase
      .from('kira_agents')
      .update({ 
        last_conversation_at: new Date().toISOString(),
        total_conversations: agent.total_conversations + 1,
      })
      .eq('id', agent.id);

    return NextResponse.json({
      success: true,
      signedUrl,
      conversationId: conversation?.id,
    });

  } catch (error) {
    console.error('[kira/start] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
