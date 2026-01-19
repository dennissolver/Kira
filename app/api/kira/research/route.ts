// app/api/kira/research/route.ts
// Handles Kira's collaborative research tools
// With Serper search + pgvector embeddings + Jina reranking

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { searchWeb, searchNews } from '@/lib/serper/client';
import { searchKnowledge, embedKnowledgeEntry } from '@/lib/kira/knowledge-search';

// =============================================================================
// CONSTANTS & LIMITS
// =============================================================================

const LIMITS = {
  MAX_SEARCHES_PER_SESSION: 3,
  MAX_URLS_PER_SESSION: 5,
  MAX_TOKENS_PER_SESSION: 10000,
  MAX_TOKENS_PER_URL: 2000,
  SESSION_TIMEOUT_MINUTES: 5,
  MAX_RESULTS_PER_SEARCH: 5,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '... [truncated]';
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_name } = body;

    const conversationId = request.headers.get('x-conversation-id') || 'unknown';
    const userId = body.user_id || request.headers.get('x-user-id');

    console.log(`[research] Tool: ${tool_name}, Conversation: ${conversationId}`);

    switch (tool_name) {
      case 'start_research_session':
        return handleStartResearch(body, userId);
      case 'search_web':
        return handleSearchWeb(body, userId);
      case 'fetch_url':
        return handleFetchUrl(body, userId);
      case 'save_finding':
        return handleSaveFinding(body, userId);
      case 'search_knowledge':
        return handleSearchKnowledge(body, userId);
      case 'complete_research':
        return handleCompleteResearch(body, userId);
      default:
        return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }

  } catch (error) {
    console.error('[research] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// START RESEARCH SESSION
// =============================================================================

async function handleStartResearch(
  body: {
    topic: string;
    user_id: string;
    kira_agent_id?: string;
    research_angles?: string[];
  },
  headerUserId?: string | null
) {
  const supabase = createServiceClient();
  const userId = body.user_id || headerUserId;

  if (!userId) {
    return NextResponse.json({
      result: { success: false, message: "I need to know who you are to start research." }
    });
  }

  // Check for existing active session
  const { data: existingSession } = await supabase
    .from('kira_research_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (existingSession) {
    return NextResponse.json({
      result: {
        success: true,
        session_id: existingSession.id,
        message: `We already have an active research session on "${existingSession.topic}". Let's continue with that, or I can close it and start fresh.`,
        existing: true,
        limits: {
          searches_remaining: existingSession.max_searches - existingSession.searches_used,
          tokens_remaining: existingSession.max_tokens - existingSession.tokens_used,
        }
      }
    });
  }

  // Create new session
  const expiresAt = new Date(Date.now() + LIMITS.SESSION_TIMEOUT_MINUTES * 60 * 1000);

  const { data: session, error } = await supabase
    .from('kira_research_sessions')
    .insert({
      user_id: userId,
      kira_agent_id: body.kira_agent_id || null,
      topic: body.topic,
      status: 'active',
      max_searches: LIMITS.MAX_SEARCHES_PER_SESSION,
      max_tokens: LIMITS.MAX_TOKENS_PER_SESSION,
      max_urls: LIMITS.MAX_URLS_PER_SESSION,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[start_research] Error:', error);
    return NextResponse.json({
      result: { success: false, message: "Couldn't start the research session. Let's try again." }
    });
  }

  const anglesText = body.research_angles?.length
    ? `\n\nI'll focus on: ${body.research_angles.join(', ')}`
    : '';

  return NextResponse.json({
    result: {
      success: true,
      session_id: session.id,
      topic: body.topic,
      expires_at: expiresAt.toISOString(),
      limits: {
        max_searches: LIMITS.MAX_SEARCHES_PER_SESSION,
        max_urls: LIMITS.MAX_URLS_PER_SESSION,
        timeout_minutes: LIMITS.SESSION_TIMEOUT_MINUTES,
      },
      message: `Great, let's research "${body.topic}" together! I have ${LIMITS.MAX_SEARCHES_PER_SESSION} searches and ${LIMITS.SESSION_TIMEOUT_MINUTES} minutes.${anglesText}\n\nYou look for what matters from your perspective — insider knowledge, specific examples, things only you'd know to search for. I'll search for broader context and established information. Let's reconvene and combine what we find.`
    }
  });
}

// =============================================================================
// SEARCH WEB (using Serper API)
// =============================================================================

async function handleSearchWeb(
  body: {
    session_id: string;
    query: string;
    reason: string;
    search_type?: 'web' | 'news';
    user_id: string;
  },
  headerUserId?: string | null
) {
  const supabase = createServiceClient();

  if (!body.session_id || !body.query) {
    return NextResponse.json({
      result: { success: false, message: "I need a research session and search query." }
    });
  }

  // Check session limits
  const { data: session } = await supabase
    .from('kira_research_sessions')
    .select('*')
    .eq('id', body.session_id)
    .single();

  if (!session) {
    return NextResponse.json({
      result: { success: false, message: "Couldn't find that research session. Want to start a new one?" }
    });
  }

  if (session.status !== 'active' || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({
      result: { success: false, message: "That research session has ended. Want to start a new one?" }
    });
  }

  if (session.searches_used >= session.max_searches) {
    return NextResponse.json({
      result: {
        success: false,
        message: `I've used all ${session.max_searches} searches for this session. Let me work with what I've found.`,
        searches_remaining: 0,
      }
    });
  }

  console.log(`[search_web] Searching for: "${body.query}"`);

  try {
    let searchResults;

    if (body.search_type === 'news') {
      searchResults = await searchNews(body.query, { maxResults: LIMITS.MAX_RESULTS_PER_SEARCH });
    } else {
      searchResults = await searchWeb(body.query, { maxResults: LIMITS.MAX_RESULTS_PER_SEARCH });
    }

    // Update session counters
    await supabase
      .from('kira_research_sessions')
      .update({ searches_used: session.searches_used + 1 })
      .eq('id', body.session_id);

    const searchesRemaining = session.max_searches - session.searches_used - 1;

    return NextResponse.json({
      result: {
        success: true,
        query: body.query,
        results: searchResults,
        results_count: searchResults.length,
        searches_remaining: searchesRemaining,
        message: searchResults.length > 0
          ? `Found ${searchResults.length} results. ${searchesRemaining > 0 ? `${searchesRemaining} search${searchesRemaining === 1 ? '' : 'es'} left.` : "That was my last search."}`
          : `No results for "${body.query}". Let me try a different approach.`,
      }
    });

  } catch (error) {
    console.error('[search_web] Error:', error);
    return NextResponse.json({
      result: {
        success: false,
        message: "Search hit a snag. Let me try a different approach.",
      }
    });
  }
}

// =============================================================================
// FETCH URL
// =============================================================================

async function handleFetchUrl(
  body: {
    session_id?: string;
    url: string;
    reason: string;
    user_id: string;
  },
  headerUserId?: string | null
) {
  const supabase = createServiceClient();

  if (!body.url) {
    return NextResponse.json({
      result: { success: false, message: "I need a URL to fetch." }
    });
  }

  // Check session limits if provided
  let session = null;
  if (body.session_id) {
    const { data } = await supabase
      .from('kira_research_sessions')
      .select('*')
      .eq('id', body.session_id)
      .single();
    session = data;

    if (session?.urls_fetched >= session?.max_urls) {
      return NextResponse.json({
        result: { success: false, message: `I've fetched the maximum URLs for this session.` }
      });
    }
  }

  try {
    const response = await fetch(body.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KiraBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let text = await response.text();

    // Strip HTML
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const truncatedContent = truncateToTokens(text, LIMITS.MAX_TOKENS_PER_URL);
    const tokenCount = estimateTokens(truncatedContent);

    // Update session if applicable
    if (session) {
      await supabase
        .from('kira_research_sessions')
        .update({
          urls_fetched: session.urls_fetched + 1,
          tokens_used: session.tokens_used + tokenCount,
        })
        .eq('id', body.session_id);
    }

    return NextResponse.json({
      result: {
        success: true,
        url: body.url,
        content: truncatedContent,
        token_count: tokenCount,
        message: `Fetched content from ${new URL(body.url).hostname} (${tokenCount} tokens).`,
      }
    });

  } catch (error) {
    console.error('[fetch_url] Error:', error);
    return NextResponse.json({
      result: { success: false, message: "Couldn't access that URL. Let me try a different source." }
    });
  }
}

// =============================================================================
// SAVE FINDING (with embedding generation)
// =============================================================================

async function handleSaveFinding(
  body: {
    session_id?: string;
    user_id: string;
    kira_agent_id?: string;
    title: string;
    url?: string;
    summary: string;
    key_points?: string[];
    relevance_note: string;
    source_type?: 'kira_research' | 'user_upload' | 'user_url' | 'user_note';
    tags?: string[];
    topic?: string;
    raw_content?: string;
  },
  headerUserId?: string | null
) {
  const supabase = createServiceClient();
  const userId = body.user_id || headerUserId;

  if (!userId || !body.title || !body.summary) {
    return NextResponse.json({
      result: { success: false, message: "I need at least a title and summary to save this finding." }
    });
  }

  // Get session for topic and limits
  let session = null;
  if (body.session_id) {
    const { data } = await supabase
      .from('kira_research_sessions')
      .select('*')
      .eq('id', body.session_id)
      .single();
    session = data;
  }

  const tokenCount = estimateTokens(`${body.title} ${body.summary} ${body.key_points?.join(' ') || ''}`);
  const truncatedRawContent = body.raw_content
    ? truncateToTokens(body.raw_content, LIMITS.MAX_TOKENS_PER_URL)
    : null;

  // Save to knowledge base
  const { data: knowledge, error } = await supabase
    .from('kira_knowledge')
    .insert({
      user_id: userId,
      kira_agent_id: body.kira_agent_id || null,
      source_type: body.source_type || 'kira_research',
      title: body.title,
      url: body.url || null,
      summary: body.summary,
      key_points: body.key_points || [],
      relevance_note: body.relevance_note,
      raw_content: truncatedRawContent,
      tags: body.tags || [],
      topic: body.topic || session?.topic || null,
      token_count: tokenCount,
      search_session_id: body.session_id || null,
      created_by: 'kira',
    })
    .select()
    .single();

  if (error) {
    console.error('[save_finding] Error:', error);
    return NextResponse.json({
      result: { success: false, message: "Couldn't save that finding. Let me try again." }
    });
  }

  // Generate and store embedding asynchronously (don't block response)
  embedKnowledgeEntry(knowledge.id, {
    title: body.title,
    summary: body.summary,
    keyPoints: body.key_points,
  }).catch(err => console.error('[save_finding] Embedding error:', err));

  // Update session if applicable
  if (session) {
    await supabase
      .from('kira_research_sessions')
      .update({
        tokens_used: session.tokens_used + tokenCount,
        kira_findings_count: session.kira_findings_count + 1,
      })
      .eq('id', body.session_id);
  }

  return NextResponse.json({
    result: {
      success: true,
      knowledge_id: knowledge.id,
      tokens_used: tokenCount,
      message: `Saved: "${body.title}"`,
    }
  });
}

// =============================================================================
// SEARCH KNOWLEDGE (using hybrid search + reranking)
// =============================================================================

async function handleSearchKnowledge(
  body: {
    user_id: string;
    query: string;
    limit?: number;
    topic?: string;
  },
  headerUserId?: string | null
) {
  const userId = body.user_id || headerUserId;

  if (!userId || !body.query) {
    return NextResponse.json({
      result: { success: false, message: "I need to know what to search for in your knowledge base." }
    });
  }

  try {
    // Use the cutting-edge hybrid search with reranking
    const results = await searchKnowledge(userId, body.query, {
      limit: body.limit || 10,
      topic: body.topic,
      useReranker: true,
    });

    return NextResponse.json({
      result: {
        success: true,
        results: results,
        count: results.length,
        message: results.length
          ? `Found ${results.length} relevant items in your knowledge base.`
          : "Nothing in your knowledge base matches that yet. Want to research this topic together?",
      }
    });

  } catch (error) {
    console.error('[search_knowledge] Error:', error);
    return NextResponse.json({
      result: { success: false, message: "Search hit a snag. Let me try again." }
    });
  }
}

// =============================================================================
// COMPLETE RESEARCH SESSION
// =============================================================================

async function handleCompleteResearch(
  body: {
    session_id: string;
    user_id: string;
    synthesis?: string;
  },
  headerUserId?: string | null
) {
  const supabase = createServiceClient();

  if (!body.session_id) {
    return NextResponse.json({
      result: { success: false, message: "Which research session should I wrap up?" }
    });
  }

  const { data: session } = await supabase
    .from('kira_research_sessions')
    .select('*')
    .eq('id', body.session_id)
    .single();

  if (!session) {
    return NextResponse.json({
      result: { success: false, message: "Couldn't find that research session." }
    });
  }

  // Get findings
  const { data: findings } = await supabase
    .from('kira_knowledge')
    .select('title, summary, key_points, url, created_by')
    .eq('search_session_id', body.session_id)
    .order('created_at', { ascending: true });

  // Mark complete
  await supabase
    .from('kira_research_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      synthesis: body.synthesis || null,
    })
    .eq('id', body.session_id);

  const kiraFindings = findings?.filter(f => f.created_by === 'kira') || [];
  const userFindings = findings?.filter(f => f.created_by === 'user') || [];

  return NextResponse.json({
    result: {
      success: true,
      session_id: body.session_id,
      topic: session.topic,
      stats: {
        total_findings: findings?.length || 0,
        kira_findings: kiraFindings.length,
        user_findings: userFindings.length,
        searches_used: session.searches_used,
      },
      findings: findings || [],
      message: `Research session complete! We gathered ${findings?.length || 0} findings on "${session.topic}". This is now saved in your knowledge base with semantic search enabled.`,
    }
  });
}