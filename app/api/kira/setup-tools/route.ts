// app/api/kira/setup-tools/route.ts
// Handles Kira Setup agent's tool calls (set_journey_type, save_user_context, create_operational_kira)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getKiraPrompt, generateAgentName } from '@/lib/kira/prompts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const KIRA_VOICE_ID = process.env.KIRA_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

// In-memory session storage (in production, use Redis or database)
// Key: conversation_id, Value: session data
const setupSessions: Map<string, SetupSession> = new Map();

interface SetupSession {
  conversationId: string;
  journeyType?: 'personal' | 'business';
  journeyConfidence?: 'confirmed' | 'inferred';
  contexts: Array<{
    type: string;
    content: string;
    importance: number;
  }>;
  userName?: string;
  createdAt: Date;
}

function getOrCreateSession(conversationId: string): SetupSession {
  if (!setupSessions.has(conversationId)) {
    setupSessions.set(conversationId, {
      conversationId,
      contexts: [],
      createdAt: new Date(),
    });
  }
  return setupSessions.get(conversationId)!;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_name } = body;

    // Get conversation ID from header (ElevenLabs sends this)
    const conversationId = request.headers.get('x-conversation-id') || 'unknown';

    console.log(`[setup-tools] Tool: ${tool_name}, Conversation: ${conversationId}`);

    switch (tool_name) {
      case 'set_journey_type':
        return handleSetJourneyType(conversationId, body);
      case 'save_user_context':
        return handleSaveUserContext(conversationId, body);
      case 'create_operational_kira':
        return handleCreateOperationalKira(conversationId, body);
      default:
        return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }

  } catch (error) {
    console.error('[setup-tools] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// SET JOURNEY TYPE
// =============================================================================

function handleSetJourneyType(
  conversationId: string,
  body: { journey_type: 'personal' | 'business'; confidence: 'confirmed' | 'inferred'; signal?: string }
) {
  const session = getOrCreateSession(conversationId);

  session.journeyType = body.journey_type;
  session.journeyConfidence = body.confidence;

  console.log(`[set_journey_type] Set to ${body.journey_type} (${body.confidence})`);
  if (body.signal) {
    console.log(`[set_journey_type] Signal: "${body.signal}"`);
  }

  return NextResponse.json({
    result: {
      success: true,
      journey_type: body.journey_type,
      message: body.journey_type === 'personal'
        ? "Got it — this is about life stuff. I'll focus my questions there."
        : "Got it — this is about work stuff. I'll focus my questions there.",
    }
  });
}

// =============================================================================
// SAVE USER CONTEXT
// =============================================================================

function handleSaveUserContext(
  conversationId: string,
  body: { context_type: string; content: string; importance?: number }
) {
  const session = getOrCreateSession(conversationId);

  // Check if it's their name
  if (body.context_type === 'name') {
    session.userName = body.content;
  }

  session.contexts.push({
    type: body.context_type,
    content: body.content,
    importance: body.importance || 5,
  });

  console.log(`[save_user_context] Saved ${body.context_type}: "${body.content.substring(0, 50)}..."`);
  console.log(`[save_user_context] Session now has ${session.contexts.length} context pieces`);

  return NextResponse.json({
    result: {
      success: true,
      contexts_saved: session.contexts.length,
      message: "Got it, I'll remember that.",
    }
  });
}

// =============================================================================
// CREATE OPERATIONAL KIRA
// =============================================================================

async function handleCreateOperationalKira(
  conversationId: string,
  body: {
    user_name?: string;
    journey_type: 'personal' | 'business';
    primary_goal: string;
    key_context: string[];
    conversation_summary?: string;
  }
) {
  const session = getOrCreateSession(conversationId);
  const supabase = createServiceClient();

  // Use provided data or fall back to session data
  const userName = body.user_name || session.userName || 'Friend';
  const journeyType = body.journey_type || session.journeyType || 'personal';

  console.log(`[create_operational_kira] Creating for ${userName}, journey: ${journeyType}`);
  console.log(`[create_operational_kira] Goal: ${body.primary_goal}`);
  console.log(`[create_operational_kira] Context points: ${body.key_context.length}`);

  try {
    // 1. Create or get user (we may not have email yet - use a placeholder)
    // In a real flow, you'd collect email during setup or after
    const tempEmail = `setup_${conversationId}@temp.kira.ai`;

    let { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', tempEmail)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: tempEmail,
          first_name: userName,
        })
        .select()
        .single();

      if (userError || !newUser) {
        console.error('[create_operational_kira] Failed to create user:', userError);
        return NextResponse.json({
          result: {
            success: false,
            message: "I had trouble setting up your account. Let's try again.",
          }
        });
      }
      userId = newUser.id;
    }

    // 2. Generate personalized prompt with gathered context
    const existingMemory = [
      `Primary goal: ${body.primary_goal}`,
      ...body.key_context,
      ...(body.conversation_summary ? [`Setup conversation: ${body.conversation_summary}`] : []),
    ];

    const { systemPrompt, firstMessage } = getKiraPrompt({
      framework: {
        userName: userName,
        firstName: userName,
        location: 'Unknown',
        journeyType: journeyType,
        primaryObjective: body.primary_goal,
        keyContext: body.key_context,
      },
      existingMemory,
    });

    // 3. Create the ElevenLabs agent with CORRECT API structure
    const agentName = generateAgentName(journeyType, userName, body.primary_goal || 'General', userId);

    const customFirstMessage = `Hey ${userName}! I've got the context from our setup chat. ${body.primary_goal ? `So we're working on: ${body.primary_goal}. ` : ''}Let's dive in — what's on your mind?`;

    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          name: agentName,
          conversation_config: {
            agent: {
              prompt: {
                prompt: systemPrompt,
                llm: 'gpt-4o-mini',
                temperature: 0.7,
              },
              first_message: customFirstMessage,
              language: 'en',
            },
            tts: {
              voice_id: KIRA_VOICE_ID,
              model_id: 'eleven_turbo_v2_5',
            },
          },
          platform_settings: {
            webhook: {
              url: `${APP_URL}/api/webhooks/elevenlabs-router`,
              events: ['conversation.transcript', 'conversation.ended'],
            },
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('[create_operational_kira] ElevenLabs error:', errText);
      return NextResponse.json({
        result: {
          success: false,
          message: "Something went wrong creating your Kira. Let's try again.",
          error: errText,
        }
      });
    }

    const elevenData = await elevenRes.json();
    const agentId = elevenData.agent_id;

    console.log(`[create_operational_kira] Created agent: ${agentId}`);

    // 4. Save agent to database
    const { data: savedAgent, error: agentError } = await supabase
      .from('kira_agents')
      .insert({
        user_id: userId,
        agent_name: agentName,
        journey_type: journeyType,
        elevenlabs_agent_id: agentId,
      })
      .select()
      .single();

    if (agentError) {
      console.error('[create_operational_kira] Failed to save agent:', agentError);
    }

    // 5. Save gathered context as initial memories
    for (const ctx of session.contexts) {
      await supabase.from('kira_memory').insert({
        user_id: userId,
        kira_agent_id: savedAgent?.id,
        memory_type: mapContextTypeToMemoryType(ctx.type),
        content: ctx.content,
        importance: ctx.importance,
      });
    }

    // 6. Clean up session
    setupSessions.delete(conversationId);

    console.log(`[create_operational_kira] Success! Agent ID: ${agentId}`);

    return NextResponse.json({
      result: {
        success: true,
        agent_id: agentId,
        redirect_url: `/chat/${agentId}`,
        message: "Perfect! Your Kira is ready. Redirecting you now...",
      }
    });

  } catch (error) {
    console.error('[create_operational_kira] Error:', error);
    return NextResponse.json({
      result: {
        success: false,
        message: "Something went wrong setting up your Kira. Let's try again.",
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    });
  }
}

// Helper to map context types to memory types
function mapContextTypeToMemoryType(contextType: string): string {
  const mapping: Record<string, string> = {
    'name': 'context',
    'goal': 'goal',
    'challenge': 'context',
    'constraint': 'context',
    'background': 'context',
    'preference': 'preference',
    'tried_before': 'context',
    'success_looks_like': 'goal',
    'other': 'context',
  };
  return mapping[contextType] || 'context';
}