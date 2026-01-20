// app/api/kira/webhook/route.ts
// Handles ElevenLabs post-call webhooks (conversation transcription, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET!;

// ElevenLabs post-call webhook payload structure
// Matches the GET /v1/convai/conversations/:conversation_id response
interface ElevenLabsWebhookPayload {
  type: string; // e.g., "post_call_transcription"
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
      deletion_settings?: unknown;
      feedback?: unknown;
      authorization_method?: string;
      charging?: unknown;
      termination_reason?: string;
    };
    analysis?: {
      evaluation_criteria_results?: Record<string, unknown>;
      data_collection_results?: Record<string, unknown>;
      call_successful?: string;
      transcript_summary?: string;
    };
    has_audio?: boolean;
    has_user_audio?: boolean;
    has_response_audio?: boolean;
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

  // Parse signature: t=timestamp,v0=hash
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const hash = parts.find(p => p.startsWith('v0='))?.slice(3);

  if (!timestamp || !hash) {
    console.warn('[kira/webhook] Invalid signature format');
    return false;
  }

  // Verify timestamp is recent (within 5 minutes)
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (timestampAge > 300) {
    console.warn('[kira/webhook] Signature timestamp too old');
    return false;
  }

  // Compute expected hash: HMAC-SHA256 of "timestamp.payload"
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
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('elevenlabs-signature');

    // Verify HMAC signature
    if (!verifySignature(rawBody, signature)) {
      console.warn('[kira/webhook] Invalid webhook signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as ElevenLabsWebhookPayload;

    // Log the full payload structure for debugging
    console.log(`[kira/webhook] Received event type: ${payload.type}`);
    console.log(`[kira/webhook] Payload keys: ${Object.keys(payload).join(', ')}`);

    // Extract data from the correct location
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

    // Find the agent in our database - include all fields we need
    const { data: agent, error: agentError } = await supabase
      .from('kira_agents')
      .select('id, user_id, agent_name, total_conversations, total_minutes')
      .eq('elevenlabs_agent_id', agent_id)
      .single();

    if (agentError || !agent) {
      console.warn(`[kira/webhook] Agent not found: ${agent_id}`);
      // Still return 200 to prevent webhook from being disabled
      return NextResponse.json({ received: true, warning: 'Agent not found' });
    }

    console.log(`[kira/webhook] Found agent: ${agent.agent_name} (${agent.id})`);

    // Handle different webhook types
    if (type === 'post_call_transcription') {
      // Build transcript text from transcript array
      const transcriptText = transcript
        ?.map(t => `${t.role === 'user' ? 'User' : 'Kira'}: ${t.message}`)
        .join('\n') || '';

      // Extract topics from transcript
      const topics = extractTopics(transcript || []);

      // Get user_id from dynamic variables if available
      const dynamicUserId = conversation_initiation_client_data?.dynamic_variables?.user_id;

      // Upsert conversation record
      const conversationData = {
        elevenlabs_conversation_id: conversation_id,
        kira_agent_id: agent.id,
        user_id: dynamicUserId || agent.user_id,
        status: status === 'done' ? 'completed' : status,
        started_at: metadata?.start_time_unix_secs
          ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
          : new Date().toISOString(),
        ended_at: metadata?.end_time_unix_secs
          ? new Date(metadata.end_time_unix_secs * 1000).toISOString()
          : new Date().toISOString(),
        duration_seconds: metadata?.call_duration_secs || 0,
        transcript_text: transcriptText,
        transcript_json: transcript,
        topics: topics.length > 0 ? topics : null,
        summary: analysis?.transcript_summary || null,
        metadata: {
          cost: metadata?.cost,
          termination_reason: metadata?.termination_reason,
          analysis: analysis,
        },
      };

      const { error: upsertError } = await supabase
        .from('kira_conversations')
        .upsert(conversationData, {
          onConflict: 'elevenlabs_conversation_id',
        });

      if (upsertError) {
        console.error('[kira/webhook] Error saving conversation:', upsertError);
      } else {
        console.log(`[kira/webhook] Conversation saved: ${conversation_id} (${metadata?.call_duration_secs}s)`);
      }

      // Update agent stats
      const currentConversations = agent.total_conversations || 0;
      const currentMinutes = agent.total_minutes || 0;

      await supabase
        .from('kira_agents')
        .update({
          total_conversations: currentConversations + 1,
          total_minutes: currentMinutes + Math.ceil((metadata?.call_duration_secs || 0) / 60),
          last_conversation_at: new Date().toISOString(),
        })
        .eq('id', agent.id);

      // Save individual messages to kira_messages table
      if (transcript && transcript.length > 0) {
        const messages = transcript.map((t, index) => ({
          kira_conversation_id: conversation_id, // Will need to update after getting actual conversation ID
          role: t.role,
          content: t.message,
          timestamp_in_call: t.time_in_call_secs,
          sequence_number: index,
        }));

        // Note: You may need to adjust this based on your kira_messages table structure
        // const { error: messagesError } = await supabase
        //   .from('kira_messages')
        //   .insert(messages);

        console.log(`[kira/webhook] Would save ${messages.length} messages`);
      }
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

// Simple topic extraction from transcript
function extractTopics(transcript: Array<{ role: string; message: string }>): string[] {
  const topics: Set<string> = new Set();

  // Common topic indicators
  const topicPatterns = [
    /planning (?:a |my )?(trip|event|wedding|party|meal|move)/gi,
    /help (?:me |with )?(decide|decision|choose|choosing)/gi,
    /write (?:a |an )?(email|message|letter|post)/gi,
    /(job|career|work|business|project|strategy)/gi,
    /(relationship|family|friend)/gi,
    /(travel|flight|hotel|vacation)/gi,
    /(learn|study|course|skill)/gi,
    /(health|fitness|exercise|diet)/gi,
    /(finance|money|budget|invest)/gi,
  ];

  for (const entry of transcript) {
    if (entry.role === 'user') {
      for (const pattern of topicPatterns) {
        const matches = entry.message.match(pattern);
        if (matches) {
          matches.forEach(m => topics.add(m.toLowerCase().trim()));
        }
      }
    }
  }

  return Array.from(topics).slice(0, 5); // Max 5 topics
}