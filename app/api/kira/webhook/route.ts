// app/api/kira/webhook/route.ts
// Handles ElevenLabs post-call webhooks (conversation transcription, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET!;

// ElevenLabs post-call webhook payload structure
interface ElevenLabsWebhookPayload {
  type: string;
  event_timestamp?: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
    transcript: Array<{
      role: 'user' | 'agent';
      message: string;
      tool_call?: unknown;
      tool_result?: unknown;
      time_in_call_secs: number;
      end_time_in_call_secs?: number;
    }>;
    metadata: {
      start_time_unix_secs: number;
      end_time_unix_secs?: number;
      call_duration_secs: number;
      cost?: number;
      termination_reason?: string;
    };
    analysis?: {
      transcript_summary?: string;
      call_successful?: string;
      data_collection_results?: Record<string, unknown>;
    };
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, string>;
    };
  };
}

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !WEBHOOK_SECRET) {
    console.warn('[kira/webhook] Missing signature or secret');
    return false;
  }

  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const hash = parts.find(p => p.startsWith('v0='))?.slice(3);

  if (!timestamp || !hash) {
    console.warn('[kira/webhook] Invalid signature format');
    return false;
  }

  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (timestampAge > 300) {
    console.warn('[kira/webhook] Signature timestamp too old');
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('elevenlabs-signature');

    if (!verifySignature(rawBody, signature)) {
      console.warn('[kira/webhook] Invalid webhook signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as ElevenLabsWebhookPayload;

    console.log(`[kira/webhook] Received event type: ${payload.type}`);

    const { type, data } = payload;

    if (!data) {
      console.warn('[kira/webhook] No data in payload');
      return NextResponse.json({ received: true });
    }

    const {
      agent_id,
      conversation_id,
      status,
      transcript,
      metadata,
      analysis,
      conversation_initiation_client_data
    } = data;

    console.log(`[kira/webhook] Received: ${type} for conversation ${conversation_id}, agent ${agent_id}`);

    const supabase = createServiceClient();

    // Find the agent in our database
    const { data: agent, error: agentError } = await supabase
      .from('kira_agents')
      .select('id, user_id, agent_name, elevenlabs_agent_id, total_conversations, total_minutes')
      .eq('elevenlabs_agent_id', agent_id)
      .single();

    if (agentError || !agent) {
      console.warn(`[kira/webhook] Agent not found: ${agent_id}`);
      return NextResponse.json({ received: true, warning: 'Agent not found' });
    }

    console.log(`[kira/webhook] Found agent: ${agent.agent_name} (${agent.id})`);

    // Handle post_call_transcription
    if (type === 'post_call_transcription') {

      // Get user_id from dynamic variables if available, otherwise use agent's user_id
      const userId = conversation_initiation_client_data?.dynamic_variables?.user_id || agent.user_id;

      // Extract main topic from transcript or analysis
      const currentTopic = analysis?.transcript_summary?.slice(0, 200) ||
                          extractMainTopic(transcript || []) ||
                          'General conversation';

      // 1. Save to kira_conversations
      const conversationData = {
        user_id: userId,
        agent_id: agent.elevenlabs_agent_id,
        elevenlabs_conversation_id: conversation_id,
        current_topic: currentTopic,
        status: status === 'done' ? 'completed' : status,
        started_at: metadata?.start_time_unix_secs
          ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
          : new Date().toISOString(),
        ended_at: metadata?.end_time_unix_secs
          ? new Date(metadata.end_time_unix_secs * 1000).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: savedConversation, error: convError } = await supabase
        .from('kira_conversations')
        .upsert(conversationData, {
          onConflict: 'elevenlabs_conversation_id',
        })
        .select('id')
        .single();

      if (convError) {
        console.error('[kira/webhook] Error saving conversation:', convError);
      } else {
        console.log(`[kira/webhook] Conversation saved: ${conversation_id}`);
      }

      // 2. Save individual messages to kira_messages
      if (transcript && transcript.length > 0) {
        const messages = transcript.map((t) => ({
          user_id: userId,
          agent_id: agent.elevenlabs_agent_id,
          conversation_id: conversation_id,
          role: t.role === 'agent' ? 'assistant' : t.role, // normalize 'agent' to 'assistant'
          content: t.message,
          created_at: metadata?.start_time_unix_secs
            ? new Date((metadata.start_time_unix_secs + t.time_in_call_secs) * 1000).toISOString()
            : new Date().toISOString(),
        }));

        const { error: messagesError } = await supabase
          .from('kira_messages')
          .insert(messages);

        if (messagesError) {
          console.error('[kira/webhook] Error saving messages:', messagesError);
        } else {
          console.log(`[kira/webhook] Saved ${messages.length} messages to kira_messages`);
        }
      }

      // 3. Update agent stats
      const currentConversations = agent.total_conversations || 0;
      const currentMinutes = agent.total_minutes || 0;

      const { error: updateError } = await supabase
        .from('kira_agents')
        .update({
          total_conversations: currentConversations + 1,
          total_minutes: currentMinutes + Math.ceil((metadata?.call_duration_secs || 0) / 60),
          last_conversation_at: new Date().toISOString(),
        })
        .eq('id', agent.id);

      if (updateError) {
        console.error('[kira/webhook] Error updating agent stats:', updateError);
      } else {
        console.log(`[kira/webhook] Updated agent stats: ${currentConversations + 1} conversations, ${currentMinutes + Math.ceil((metadata?.call_duration_secs || 0) / 60)} minutes`);
      }

      // 4. Log to kira_logs for debugging
      await supabase
        .from('kira_logs')
        .insert({
          user_id: userId,
          agent_id: agent.id,
          event_type: 'conversation_completed',
          details: {
            conversation_id,
            duration_secs: metadata?.call_duration_secs,
            message_count: transcript?.length || 0,
            termination_reason: metadata?.termination_reason,
            summary: analysis?.transcript_summary,
          },
        });
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[kira/webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Extract main topic from first few user messages
function extractMainTopic(transcript: Array<{ role: string; message: string }>): string | null {
  const userMessages = transcript
    .filter(t => t.role === 'user')
    .slice(0, 3)
    .map(t => t.message)
    .join(' ');

  if (!userMessages) return null;

  // Return first 200 chars as topic summary
  return userMessages.slice(0, 200);
}