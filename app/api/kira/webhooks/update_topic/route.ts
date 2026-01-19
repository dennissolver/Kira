// app/api/kira/webhooks/update_topic/route.ts
// Webhook called when Kira detects a topic change in the conversation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface UpdateTopicPayload {
  conversation_id: string; // ElevenLabs conversation ID
  topic: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: UpdateTopicPayload = await request.json();
    
    console.log('[update_topic] Received:', body);

    const { conversation_id, topic } = body;

    if (!conversation_id || !topic) {
      return NextResponse.json({
        result: {
          success: false,
          message: 'Missing required fields: conversation_id, topic'
        }
      }, { status: 400 });
    }

    // Find the conversation by ElevenLabs conversation ID
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, topics')
      .eq('elevenlabs_conversation_id', conversation_id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({
        result: {
          success: false,
          message: 'Conversation not found'
        }
      }, { status: 404 });
    }

    // Update the conversation with new topic
    const existingTopics = conversation.topics || [];
    const updatedTopics = [...new Set([...existingTopics, topic])]; // Avoid duplicates

    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_topic: topic,
        topics: updatedTopics,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

    if (updateError) {
      console.error('[update_topic] Error updating:', updateError);
      return NextResponse.json({
        result: {
          success: false,
          message: 'Failed to update topic'
        }
      }, { status: 500 });
    }

    console.log('[update_topic] Updated to:', topic);

    return NextResponse.json({
      result: {
        success: true,
        topic,
        all_topics: updatedTopics
      }
    });

  } catch (error) {
    console.error('[update_topic] Error:', error);
    return NextResponse.json({
      result: {
        success: false,
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}
