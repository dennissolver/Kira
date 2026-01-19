// lib/embeddings/client.ts
// Embedding generation for semantic search with pgvector
// Supports OpenAI (recommended) and can be extended for other providers

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

/**
 * OpenAI Embeddings Client
 * Generates vector embeddings for text using OpenAI's API
 */
export class OpenAIEmbeddings {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/embeddings';
  private defaultModel = 'text-embedding-3-small';
  private defaultDimensions = 1536;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[OpenAIEmbeddings] No API key found. Set OPENAI_API_KEY environment variable.');
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const embeddings = await this.embedBatch([text], options);
    return embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts (more efficient)
   */
  async embedBatch(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!texts.length) {
      return [];
    }

    const {
      model = this.defaultModel,
      dimensions = this.defaultDimensions,
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
          input: texts,
          dimensions,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }

      const data = await response.json();

      // Sort by index to ensure correct order
      const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
      return sorted.map((item: any) => item.embedding);

    } catch (error) {
      console.error('[OpenAIEmbeddings] Error:', error);
      throw error;
    }
  }
}

// =============================================================================
// SIMPLE HELPER FUNCTIONS
// =============================================================================

const defaultEmbeddings = new OpenAIEmbeddings();

/**
 * Generate embedding for text
 *
 * @example
 * const embedding = await generateEmbedding("SaaS pricing strategies");
 * // Returns: [0.123, -0.456, ...] (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return defaultEmbeddings.embed(text);
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return defaultEmbeddings.embedBatch(texts);
}

/**
 * Check if embeddings are configured
 */
export function isEmbeddingsConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY);
}

/**
 * Embedding dimensions for the default model
 */
export const EMBEDDING_DIMENSIONS = 1536;