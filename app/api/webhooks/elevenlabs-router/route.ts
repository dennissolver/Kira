// app/api/webhooks/elevenlabs-router/route.ts
// Central router for all ElevenLabs tool webhooks

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'kira-webhook-secret';

// Verify HMAC signature from ElevenLabs
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-elevenlabs-signature');

    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && !verifySignature(rawBody, signature)) {
      console.warn('[elevenlabs-router] Invalid signature');
      // Continue anyway for now - can make strict later
    }

    const body = JSON.parse(rawBody);
    console.log('[elevenlabs-router] Received:', JSON.stringify(body, null, 2));

    // Extract tool name and parameters
    const toolName = body.tool_name || body.name || body.type;
    const agentId = body.agent_id || body.agentId;
    const conversationId = body.conversation_id || body.conversationId;

    // Get userId from agent if we have agentId
    let userId: string | null = null;
    if (agentId) {
      const supabase = createServiceClient();
      const { data: agent } = await supabase
        .from('kira_agents')
        .select('user_id')
        .eq('elevenlabs_agent_id', agentId)
        .single();

      if (agent) {
        userId = agent.user_id;
      }
    }

    // Route to appropriate handler
    switch (toolName) {
      case 'recall_memory':
        return handleRecallMemory(body, userId);

      case 'save_memory':
        return handleSaveMemory(body, userId);

      case 'save_message':
        return handleSaveMessage(body, userId, agentId, conversationId);

      case 'update_topic':
        return handleUpdateTopic(body, conversationId);

      case 'search_web':
        return handleSearchWeb(body);

      case 'search_knowledge':
        return handleSearchKnowledge(body, userId);

      case 'save_finding':
        return handleSaveFinding(body, userId);

      // Conversation lifecycle events
      case 'conversation_started':
      case 'conversation.started':
        return handleConversationStarted(body, userId, agentId);

      case 'conversation_ended':
      case 'conversation.ended':
        return handleConversationEnded(body, conversationId);

      default:
        console.log(`[elevenlabs-router] Unknown tool/event: ${toolName}`);
        return NextResponse.json({
          success: true,
          message: `Received: ${toolName}`
        });
    }

  } catch (error) {
    console.error('[elevenlabs-router] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// MEMORY HANDLERS - Using kira_memory table (singular)
// =============================================================================

async function handleRecallMemory(body: any, userId: string | null) {
  if (!userId) {
    return NextResponse.json({ memories: [], message: 'No user context' });
  }

  const { query, memory_type } = body;
  const supabase = createServiceClient();

  let dbQuery = supabase
    .from('kira_memory')  // Correct table name
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(10);

  if (memory_type && memory_type !== 'all') {
    dbQuery = dbQuery.eq('memory_type', memory_type);
  }

  if (query) {
    dbQuery = dbQuery.ilike('content', `%${query}%`);
  }

  const { data: memories, error } = await dbQuery;

  if (error) {
    console.error('[recall_memory] Error:', error);
    return NextResponse.json({ memories: [], error: error.message });
  }

  return NextResponse.json({
    memories: memories || [],
    count: memories?.length || 0,
  });
}

async function handleSaveMemory(body: any, userId: string | null) {
  if (!userId) {
    return NextResponse.json({ success: false, message: 'No user context' });
  }

  const { content, memory_type, importance = 5 } = body;

  if (!content || !memory_type) {
    return NextResponse.json({
      success: false,
      message: 'Missing content or memory_type'
    });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('kira_memory')  // Correct table name
    .insert({
      user_id: userId,
      content,
      memory_type,
      importance: Math.min(10, Math.max(1, importance)),
    })
    .select()
    .single();

  if (error) {
    console.error('[save_memory] Error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({
    success: true,
    memory_id: data.id,
    message: 'Memory saved'
  });
}

// =============================================================================
// CONVERSATION HANDLERS
// =============================================================================

async function handleSaveMessage(
  body: any,
  userId: string | null,
  agentId: string | null,
  conversationId: string | null
) {
  if (!userId) {
    return NextResponse.json({ success: false, message: 'No user context' });
  }

  const { role, content } = body;

  if (!role || !content) {
    return NextResponse.json({
      success: false,
      message: 'Missing role or content'
    });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('kira_messages')
    .insert({
      user_id: userId,
      agent_id: agentId,
      conversation_id: conversationId,
      role,
      content,
    });

  if (error) {
    console.error('[save_message] Error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, message: 'Message saved' });
}

async function handleUpdateTopic(body: any, conversationId: string | null) {
  if (!conversationId) {
    return NextResponse.json({ success: true, message: 'No conversation to update' });
  }

  const { topic } = body;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('kira_conversations')
    .update({
      current_topic: topic,
      updated_at: new Date().toISOString()
    })
    .eq('elevenlabs_conversation_id', conversationId);

  if (error) {
    console.error('[update_topic] Error:', error);
  }

  return NextResponse.json({ success: true });
}

async function handleConversationStarted(
  body: any,
  userId: string | null,
  agentId: string | null
) {
  if (!userId || !agentId) {
    return NextResponse.json({ success: true });
  }

  const conversationId = body.conversation_id || body.conversationId;
  const supabase = createServiceClient();

  // Create or update conversation record
  const { error } = await supabase
    .from('kira_conversations')
    .upsert({
      user_id: userId,
      agent_id: agentId,
      elevenlabs_conversation_id: conversationId,
      started_at: new Date().toISOString(),
      status: 'active',
    }, {
      onConflict: 'elevenlabs_conversation_id'
    });

  if (error) {
    console.error('[conversation_started] Error:', error);
  }

  return NextResponse.json({ success: true });
}

async function handleConversationEnded(body: any, conversationId: string | null) {
  if (!conversationId) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('kira_conversations')
    .update({
      ended_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('elevenlabs_conversation_id', conversationId);

  if (error) {
    console.error('[conversation_ended] Error:', error);
  }

  return NextResponse.json({ success: true });
}

// =============================================================================
// RESEARCH HANDLERS
// =============================================================================

async function handleSearchWeb(body: any) {
  const { query, num_results = 5 } = body;

  if (!query) {
    return NextResponse.json({ results: [], message: 'No query provided' });
  }

  // Use Serper API for web search
  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  if (!SERPER_API_KEY) {
    return NextResponse.json({
      results: [],
      message: 'Web search not configured'
    });
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: num_results,
      }),
    });

    if (!res.ok) {
      throw new Error(`Serper API error: ${res.status}`);
    }

    const data = await res.json();

    const results = (data.organic || []).map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[search_web] Error:', error);
    return NextResponse.json({
      results: [],
      error: 'Search failed'
    });
  }
}

async function handleSearchKnowledge(body: any, userId: string | null) {
  if (!userId) {
    return NextResponse.json({ results: [], message: 'No user context' });
  }

  const { query } = body;
  const supabase = createServiceClient();

  // Simple text search on knowledge base
  const { data, error } = await supabase
    .from('kira_knowledge')
    .select('*')
    .eq('user_id', userId)
    .ilike('content', `%${query}%`)
    .limit(5);

  if (error) {
    console.error('[search_knowledge] Error:', error);
    return NextResponse.json({ results: [], error: error.message });
  }

  return NextResponse.json({
    results: data || [],
    count: data?.length || 0
  });
}

async function handleSaveFinding(body: any, userId: string | null) {
  if (!userId) {
    return NextResponse.json({ success: false, message: 'No user context' });
  }

  const { title, content, source_url } = body;

  if (!title || !content) {
    return NextResponse.json({
      success: false,
      message: 'Missing title or content'
    });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('kira_knowledge')
    .insert({
      user_id: userId,
      title,
      content,
      source_url,
      source_type: 'research',
    });

  if (error) {
    console.error('[save_finding] Error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true, message: 'Finding saved' });
}