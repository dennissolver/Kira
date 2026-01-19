// lib/jina/reranker.ts
// Jina AI Reranker v3 - State-of-the-art semantic reranking
// Get your API key at https://jina.ai/reranker (free tier: 1M tokens/month)

export interface RerankedResult {
  index: number;
  relevanceScore: number;
  document?: string;
}

export interface JinaRerankerOptions {
  model?: 'jina-reranker-v3' | 'jina-reranker-v2-base-multilingual';
  topN?: number;
  returnDocuments?: boolean;
}

/**
 * Jina Reranker Client
 * Reranks documents by semantic relevance to a query
 */
export class JinaReranker {
  private apiKey: string;
  private baseUrl = 'https://api.jina.ai/v1/rerank';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.JINA_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[JinaReranker] No API key found. Set JINA_API_KEY environment variable.');
    }
  }

  /**
   * Rerank documents by relevance to a query
   */
  async rerank(
    query: string,
    documents: string[],
    options: JinaRerankerOptions = {}
  ): Promise<RerankedResult[]> {
    if (!this.apiKey) {
      throw new Error('Jina API key not configured');
    }

    if (!documents.length) {
      return [];
    }

    const {
      model = 'jina-reranker-v3',
      topN = documents.length,
      returnDocuments = false,
    } = options;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          query,
          documents,
          top_n: topN,
          return_documents: returnDocuments,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jina API error (${response.status}): ${error}`);
      }

      const data = await response.json();

      return data.results.map((result: any) => ({
        index: result.index,
        relevanceScore: result.relevance_score,
        document: result.document?.text,
      }));

    } catch (error) {
      console.error('[JinaReranker] Error:', error);
      throw error;
    }
  }
}

// =============================================================================
// SIMPLE HELPER FUNCTIONS
// =============================================================================

const defaultReranker = new JinaReranker();

/**
 * Rerank search results by semantic relevance
 *
 * @example
 * const results = await searchKnowledge(userId, "pricing");
 * const reranked = await rerankResults("SaaS pricing strategies", results, { topN: 5 });
 */
export async function rerankResults<T extends { summary: string }>(
  query: string,
  results: T[],
  options: { topN?: number } = {}
): Promise<Array<T & { relevanceScore: number }>> {
  if (!results.length) return [];

  try {
    const documents = results.map(r => r.summary);
    const reranked = await defaultReranker.rerank(query, documents, {
      topN: options.topN || results.length,
    });

    // Map reranked indices back to original results with scores
    return reranked.map(r => ({
      ...results[r.index],
      relevanceScore: r.relevanceScore,
    }));

  } catch (error) {
    console.error('[rerankResults] Reranking failed, returning original order:', error);
    // Fallback: return original results without reranking
    return results.map(r => ({ ...r, relevanceScore: 0 }));
  }
}

/**
 * Check if Jina Reranker is configured
 */
export function isRerankerConfigured(): boolean {
  return !!(process.env.JINA_API_KEY);
}