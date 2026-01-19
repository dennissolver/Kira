// lib/kira/knowledge-search.ts
// Cutting-edge hybrid search for Kira's knowledge base
// Combines: pgvector semantic search + keyword matching + Jina reranking

import { createServiceClient } from '@/lib/supabase/server';
import { generateEmbedding, isEmbeddingsConfigured, EMBEDDING_DIMENSIONS } from '@/lib/embeddings/client';
import { rerankResults, isRerankerConfigured } from '@/lib/jina/reranker';

// =============================================================================
// TYPES
// =============================================================================

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  url: string | null;
  sourceType: string;
  relevanceNote: string | null;
  createdBy: string;
  createdAt: string;
  topic: string | null;
  // Search metadata
  searchScore?: number;      // Raw search score
  relevanceScore?: number;   // Reranker score (0-1, higher = more relevant)
  matchType?: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;        // Minimum similarity threshold (0-1)
  topic?: string;           // Filter by topic
  sourceType?: string;      // Filter by source type
  useReranker?: boolean;    // Apply Jina reranking (default: true if configured)
  hybridWeight?: number;    // Weight for keyword vs semantic (0 = all semantic, 1 = all keyword)
}

// =============================================================================
// MAIN SEARCH FUNCTION
// =============================================================================

/**
 * Search Kira's knowledge base using hybrid search + reranking
 *
 * This is the main search function that combines:
 * 1. Semantic search (pgvector cosine similarity)
 * 2. Keyword search (ILIKE fallback)
 * 3. Jina reranking for precision
 *
 * @example
 * const results = await searchKnowledge(userId, "pricing strategy for SaaS", {
 *   limit: 10,
 *   useReranker: true,
 * });
 */
export async function searchKnowledge(
  userId: string,
  query: string,
  options: SearchOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const {
    limit = 10,
    threshold = 0.5,
    topic,
    sourceType,
    useReranker = isRerankerConfigured(),
    hybridWeight = 0.3, // 30% keyword, 70% semantic by default
  } = options;

  const supabase = createServiceClient();

  // Fetch more results than needed for reranking
  const fetchLimit = useReranker ? Math.min(limit * 3, 50) : limit;

  let results: KnowledgeSearchResult[] = [];

  // Try semantic search if embeddings are configured
  if (isEmbeddingsConfigured()) {
    try {
      const semanticResults = await semanticSearch(
        supabase,
        userId,
        query,
        { limit: fetchLimit, threshold, topic, sourceType }
      );
      results = semanticResults;
    } catch (error) {
      console.error('[searchKnowledge] Semantic search failed:', error);
    }
  }

  // If no semantic results or not configured, fall back to keyword search
  if (results.length === 0) {
    const keywordResults = await keywordSearch(
      supabase,
      userId,
      query,
      { limit: fetchLimit, topic, sourceType }
    );
    results = keywordResults;
  }

  // Apply hybrid fusion if we have both types
  // (For now, we're using one or the other, but this can be extended)

  // Apply Jina reranking for precision
  if (useReranker && results.length > 0) {
    try {
      const reranked = await rerankResults(query, results, { topN: limit });
      results = reranked;
    } catch (error) {
      console.error('[searchKnowledge] Reranking failed:', error);
      // Continue with unranked results
      results = results.slice(0, limit);
    }
  } else {
    results = results.slice(0, limit);
  }

  return results;
}

// =============================================================================
// SEMANTIC SEARCH (pgvector)
// =============================================================================

async function semanticSearch(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  query: string,
  options: { limit: number; threshold: number; topic?: string; sourceType?: string }
): Promise<KnowledgeSearchResult[]> {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Call the semantic search function
  const { data, error } = await supabase.rpc('search_knowledge_semantic', {
    p_user_id: userId,
    p_query_embedding: queryEmbedding,
    p_match_threshold: options.threshold,
    p_match_count: options.limit,
    p_topic: options.topic || null,
    p_source_type: options.sourceType || null,
  });

  if (error) {
    console.error('[semanticSearch] Error:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    keyPoints: row.key_points || [],
    url: row.url,
    sourceType: row.source_type,
    relevanceNote: row.relevance_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    topic: row.topic,
    searchScore: row.similarity,
    matchType: 'semantic' as const,
  }));
}

// =============================================================================
// KEYWORD SEARCH (ILIKE fallback)
// =============================================================================

async function keywordSearch(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  query: string,
  options: { limit: number; topic?: string; sourceType?: string }
): Promise<KnowledgeSearchResult[]> {
  let queryBuilder = supabase
    .from('kira_knowledge')
    .select('id, title, summary, key_points, url, source_type, relevance_note, created_by, created_at, topic')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%,relevance_note.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(options.limit);

  if (options.topic) {
    queryBuilder = queryBuilder.eq('topic', options.topic);
  }

  if (options.sourceType) {
    queryBuilder = queryBuilder.eq('source_type', options.sourceType);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[keywordSearch] Error:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    keyPoints: row.key_points || [],
    url: row.url,
    sourceType: row.source_type,
    relevanceNote: row.relevance_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    topic: row.topic,
    matchType: 'keyword' as const,
  }));
}

// =============================================================================
// EMBEDDING MANAGEMENT
// =============================================================================

/**
 * Generate and store embedding for a knowledge entry
 * Call this when saving new knowledge
 */
export async function embedKnowledgeEntry(
  knowledgeId: string,
  content: { title: string; summary: string; keyPoints?: string[] }
): Promise<void> {
  if (!isEmbeddingsConfigured()) {
    console.warn('[embedKnowledgeEntry] Embeddings not configured, skipping');
    return;
  }

  const supabase = createServiceClient();

  // Combine content for embedding
  const textToEmbed = [
    content.title,
    content.summary,
    ...(content.keyPoints || []),
  ].join(' ');

  try {
    const embedding = await generateEmbedding(textToEmbed);

    const { error } = await supabase
      .from('kira_knowledge')
      .update({ embedding })
      .eq('id', knowledgeId);

    if (error) {
      console.error('[embedKnowledgeEntry] Failed to store embedding:', error);
      throw error;
    }

    console.log(`[embedKnowledgeEntry] Stored embedding for ${knowledgeId}`);

  } catch (error) {
    console.error('[embedKnowledgeEntry] Error:', error);
    // Don't throw - embedding is optional enhancement
  }
}

/**
 * Backfill embeddings for existing knowledge entries
 * Run this once to add embeddings to existing data
 */
export async function backfillEmbeddings(
  userId: string,
  batchSize: number = 10
): Promise<{ processed: number; failed: number }> {
  if (!isEmbeddingsConfigured()) {
    throw new Error('Embeddings not configured');
  }

  const supabase = createServiceClient();

  // Get entries without embeddings
  const { data: entries, error } = await supabase
    .from('kira_knowledge')
    .select('id, title, summary, key_points')
    .eq('user_id', userId)
    .is('embedding', null)
    .limit(batchSize);

  if (error) {
    throw error;
  }

  if (!entries?.length) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await embedKnowledgeEntry(entry.id, {
        title: entry.title,
        summary: entry.summary,
        keyPoints: entry.key_points,
      });
      processed++;
    } catch (error) {
      console.error(`[backfillEmbeddings] Failed for ${entry.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get search capabilities status
 */
export function getSearchCapabilities(): {
  semantic: boolean;
  reranking: boolean;
  hybrid: boolean;
} {
  const semantic = isEmbeddingsConfigured();
  const reranking = isRerankerConfigured();

  return {
    semantic,
    reranking,
    hybrid: semantic, // Hybrid requires at least semantic
  };
}