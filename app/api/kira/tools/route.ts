// app/api/kira/tools/route.ts
// Handles Kira's tool calls from ElevenLabs (recall_memory, save_memory)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

type MemoryType = 'preference' | 'context' | 'goal' | 'decision' | 'followup' | 'correction' | 'insight';

interface ToolRequest {
  tool_name: string;
  // recall_memory
  query?: string;
  memory_type?: MemoryType | 'all';
  // save_memory
  content?: string;
  importance?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ToolRequest;
    const { tool_name } = body;

    // Get agent ID from header (ElevenLabs sends this)
    const agentId = request.headers.get('x-agent-id');
    
    if (!agentId) {
      console.warn('[kira/tools] No agent ID in request');
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up the agent to get user_id
    const { data: agent } = await supabase
      .from('kira_agents')
      .select('id, user_id')
      .eq('elevenlabs_agent_id', agentId)
      .single();

    if (!agent) {
      console.warn(`[kira/tools] Agent not found: ${agentId}`);
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Route to appropriate handler
    switch (tool_name) {
      case 'recall_memory':
        return handleRecallMemory(supabase, agent, body);
      case 'save_memory':
        return handleSaveMemory(supabase, agent, body);
      default:
        return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }

  } catch (error) {
    console.error('[kira/tools] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// RECALL MEMORY
// =============================================================================

async function handleRecallMemory(
  supabase: ReturnType<typeof createServiceClient>,
  agent: { id: string; user_id: string },
  body: ToolRequest
) {
  const { query, memory_type } = body;

  if (!query) {
    return NextResponse.json({ 
      result: "I need to know what to search for. What should I recall?" 
    });
  }

  console.log(`[recall_memory] Searching for: "${query}" (type: ${memory_type || 'all'})`);

  // Build query
  let dbQuery = supabase
    .from('kira_memory')
    .select('*')
    .eq('user_id', agent.user_id)
    .eq('kira_agent_id', agent.id)
    .eq('active', true)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);

  // Filter by type if specified
  if (memory_type && memory_type !== 'all') {
    dbQuery = dbQuery.eq('memory_type', memory_type);
  }

  // Text search on content (simple ILIKE for now)
  // For production, consider full-text search or vector embeddings
  dbQuery = dbQuery.ilike('content', `%${query}%`);

  const { data: memories, error } = await dbQuery;

  if (error) {
    console.error('[recall_memory] DB error:', error);
    return NextResponse.json({ 
      result: "I had trouble searching my memory. Let's continue without it for now." 
    });
  }

  if (!memories || memories.length === 0) {
    return NextResponse.json({ 
      result: `I don't have any memories about "${query}" yet. This might be our first time discussing this.` 
    });
  }

  // Update last_recalled_at for found memories
  const memoryIds = memories.map(m => m.id);
  await supabase
    .from('kira_memory')
    .update({ last_recalled_at: new Date().toISOString() })
    .in('id', memoryIds);

  // Format response
  const formattedMemories = memories.map(m => ({
    type: m.memory_type,
    content: m.content,
    importance: m.importance,
    when: m.created_at,
  }));

  console.log(`[recall_memory] Found ${memories.length} memories`);

  return NextResponse.json({
    result: {
      found: memories.length,
      memories: formattedMemories,
      summary: memories.length === 1 
        ? memories[0].content 
        : `Found ${memories.length} relevant memories.`,
    }
  });
}

// =============================================================================
// SAVE MEMORY
// =============================================================================

async function handleSaveMemory(
  supabase: ReturnType<typeof createServiceClient>,
  agent: { id: string; user_id: string },
  body: ToolRequest
) {
  const { content, memory_type, importance } = body;

  if (!content) {
    return NextResponse.json({ 
      result: "I need to know what to remember. What should I save?" 
    });
  }

  if (!memory_type) {
    return NextResponse.json({ 
      result: "I need to know what type of memory this is (preference, context, goal, decision, followup, correction, or insight)." 
    });
  }

  const validTypes: MemoryType[] = ['preference', 'context', 'goal', 'decision', 'followup', 'correction', 'insight'];
  if (!validTypes.includes(memory_type as MemoryType)) {
    return NextResponse.json({ 
      result: `Invalid memory type. Use one of: ${validTypes.join(', ')}` 
    });
  }

  console.log(`[save_memory] Saving ${memory_type}: "${content.substring(0, 50)}..."`);

  const { data: memory, error } = await supabase
    .from('kira_memory')
    .insert({
      user_id: agent.user_id,
      kira_agent_id: agent.id,
      memory_type,
      content,
      importance: importance || 5,
      tags: [],
    })
    .select()
    .single();

  if (error) {
    console.error('[save_memory] DB error:', error);
    return NextResponse.json({ 
      result: "I had trouble saving that to memory, but I'll keep it in mind for this conversation." 
    });
  }

  console.log(`[save_memory] Saved memory: ${memory.id}`);

  return NextResponse.json({
    result: {
      saved: true,
      memory_id: memory.id,
      message: "Got it, I'll remember that.",
    }
  });
}
