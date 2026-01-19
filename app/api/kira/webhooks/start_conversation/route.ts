// app/api/kira/webhooks/start_conversation/route.ts
// Called when a user starts talking to their Kira - creates/resumes conversation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface StartConversationPayload {
  elevenlabs_conversation_id: string;
  elevenlabs_agent_id: string;
  user_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: StartConversationPayload = await request.json();
    
    console.log('[start_conversation] Received:', body);

    const { elevenlabs_conversation_id, elevenlabs_agent_id, user_id } = body;

    if (!elevenlabs_conversation_id || !elevenlabs_agent_id || !user_id) {
      return NextResponse.json({
        result: {
          success: false,
          message: 'Missing required fields'
        }
      }, { status: 400 });
    }

    // Get the kira_agent record (include total_conversations for incrementing)
    const { data: agent, error: agentError } = await supabase
      .from('kira_agents')
      .select('id, agent_name, total_conversations')
      .eq('elevenlabs_agent_id', elevenlabs_agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({
        result: {
          success: false,
          message: 'Agent not found'
        }
      }, { status: 404 });
    }

    // Check for existing active conversation (to resume)
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, last_message_at, last_topic, message_count')
      .eq('kira_agent_id', agent.id)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // Get conversation context for return greeting
    const { data: context } = await supabase
      .rpc('get_conversation_context', {
        p_agent_id: agent.id,
        p_user_id: user_id,
        p_message_limit: 10
      });

    // Create new conversation record (or link to existing)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id,
        kira_agent_id: agent.id,
        elevenlabs_conversation_id,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (convError) {
      console.error('[start_conversation] Error creating conversation:', convError);
      return NextResponse.json({
        result: {
          success: false,
          message: 'Failed to create conversation'
        }
      }, { status: 500 });
    }

    // Update agent's last conversation timestamp
    await supabase
      .from('kira_agents')
      .update({ 
        last_conversation_at: new Date().toISOString(),
        total_conversations: (agent.total_conversations || 0) + 1
      })
      .eq('id', agent.id);

    console.log('[start_conversation] Created conversation:', conversation.id);

    return NextResponse.json({
      result: {
        success: true,
        conversation_id: conversation.id,
        context: context || { has_history: false },
        is_returning_user: context?.has_history || false,
        time_gap_category: context?.time_gap_category || 'new'
      }
    });

  } catch (error) {
    console.error('[start_conversation] Error:', error);
    return NextResponse.json({
      result: {
        success: false,
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}
