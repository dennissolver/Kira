// app/api/kira/webhook/route.ts
// Handles ElevenLabs conversation webhooks (conversation end, transcript, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'kira-webhook-secret';

interface WebhookPayload {
  type: 'conversation.started' | 'conversation.ended' | 'conversation.transcript';
  conversation_id: string;
  agent_id: string;
  data?: {
    transcript?: Array<{ role: string; message: string; timestamp: number }>;
    transcript_text?: string;
    duration_seconds?: number;
    status?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const signature = request.headers.get('x-webhook-secret');
    if (signature !== WEBHOOK_SECRET) {
      console.warn('[kira/webhook] Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json() as WebhookPayload;
    const { type, conversation_id, agent_id, data } = payload;

    console.log(`[kira/webhook] Received: ${type} for conversation ${conversation_id}`);

    const supabase = createServiceClient();

    // Find the agent
    const { data: agent } = await supabase
      .from('kira_agents')
      .select('id, user_id')
      .eq('elevenlabs_agent_id', agent_id)
      .single();

    if (!agent) {
      console.warn(`[kira/webhook] Agent not found: ${agent_id}`);
      return NextResponse.json({ received: true });
    }

    switch (type) {
      case 'conversation.started':
        // Create or update conversation record
        await supabase
          .from('conversations')
          .upsert({
            elevenlabs_conversation_id: conversation_id,
            user_id: agent.user_id,
            kira_agent_id: agent.id,
            status: 'active',
            started_at: new Date().toISOString(),
          }, {
            onConflict: 'elevenlabs_conversation_id',
          });
        break;

      case 'conversation.ended':
        // Update conversation with final data
        const updateData: Record<string, unknown> = {
          status: 'completed',
          ended_at: new Date().toISOString(),
        };

        if (data?.duration_seconds) {
          updateData.duration_seconds = data.duration_seconds;
        }

        if (data?.transcript_text) {
          updateData.transcript_text = data.transcript_text;
        }

        if (data?.transcript) {
          updateData.transcript_json = data.transcript;

          // Extract topics from transcript for memory/continuity
          const topics = extractTopics(data.transcript);
          if (topics.length > 0) {
            updateData.topics = topics;
          }
        }

        await supabase
          .from('conversations')
          .update(updateData)
          .eq('elevenlabs_conversation_id', conversation_id);

        console.log(`[kira/webhook] Conversation ${conversation_id} completed (${data?.duration_seconds}s)`);
        break;

      case 'conversation.transcript':
        // Partial transcript update (if needed)
        if (data?.transcript_text) {
          await supabase
            .from('conversations')
            .update({ transcript_text: data.transcript_text })
            .eq('elevenlabs_conversation_id', conversation_id);
        }
        break;

      default:
        console.log(`[kira/webhook] Unhandled event type: ${type}`);
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
