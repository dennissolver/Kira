// app/api/kira/webhooks/save_message/route.ts
// Webhook called by ElevenLabs to save each message in the conversation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface SaveMessagePayload {
  conversation_id: string; // ElevenLabs conversation ID
  role: 'user' | 'assistant';
  content: string;
  audio_url?: string;
  duration_ms?: number;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: SaveMessagePayload = await request.json();
    
    console.log('[save_message] Received:', {
      conversation_id: body.conversation_id,
      role: body.role,
      content_length: body.content?.length
    });

    const { conversation_id, role, content, audio_url, duration_ms } = body;

    if (!conversation_id || !role || !content) {
      return NextResponse.json({
        result: {
          success: false,
          message: 'Missing required fields: conversation_id, role, content'
        }
      }, { status: 400 });
    }

    // Find the conversation by ElevenLabs conversation ID
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id, kira_agent_id, message_count')
      .eq('elevenlabs_conversation_id', conversation_id)
      .single();

    if (convError || !conversation) {
      // Conversation doesn't exist yet - might need to create it
      console.log('[save_message] Conversation not found, may need to create');
      return NextResponse.json({
        result: {
          success: false,
          message: 'Conversation not found. Create conversation first.'
        }
      }, { status: 404 });
    }

    // Calculate message index
    const messageIndex = (conversation.message_count || 0) + 1;

    // Save the message
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        user_id: conversation.user_id,
        kira_agent_id: conversation.kira_agent_id,
        role,
        content,
        audio_url,
        duration_ms,
        message_index: messageIndex,
        timestamp: body.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) {
      console.error('[save_message] Error saving message:', msgError);
      return NextResponse.json({
        result: {
          success: false,
          message: 'Failed to save message'
        }
      }, { status: 500 });
    }

    // Extract topic if this is a user message (simple keyword extraction)
    if (role === 'user' && content.length > 10) {
      await updateConversationTopic(supabase, conversation.id, content);
    }

    console.log('[save_message] Saved message:', message.id);

    return NextResponse.json({
      result: {
        success: true,
        message_id: message.id,
        message_index: messageIndex
      }
    });

  } catch (error) {
    console.error('[save_message] Error:', error);
    return NextResponse.json({
      result: {
        success: false,
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

// Simple topic extraction - can be enhanced with AI later
async function updateConversationTopic(supabase: ReturnType<typeof createServiceClient>, conversationId: string, userMessage: string) {
  try {
    // Extract first ~50 chars as a simple topic hint
    const topicHint = userMessage.slice(0, 100).replace(/[^\w\s]/g, '').trim();
    
    if (topicHint.length > 5) {
      await supabase
        .from('conversations')
        .update({ 
          last_topic: topicHint,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    }
  } catch (error) {
    console.error('[save_message] Error updating topic:', error);
    // Non-critical, don't fail the request
  }
}
