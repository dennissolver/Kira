
// lib/serper/client.ts
// Serper.dev API client for web search
// Get your API key at https://serper.dev (2,500 free queries)

export interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
  date?: string;
  sitelinks?: Array<{ title: string; link: string }>;
  attributes?: Record<string, string>;
}

export interface SerperKnowledgeGraph {
  title?: string;
  type?: string;
  description?: string;
  descriptionSource?: string;
  website?: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

export interface SerperSearchResponse {
  searchParameters: {
    q: string;
    gl?: string;
    hl?: string;
    type?: string;
  };
  organic: SerperSearchResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
  peopleAlsoAsk?: Array<{
    question: string;
    snippet: string;
    title: string;
    link: string;
  }>;
  relatedSearches?: Array<{ query: string }>;
  credits?: number;
}

export interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
}

export interface SerperNewsResponse {
  searchParameters: {
    q: string;
    type: 'news';
  };
  news: SerperNewsResult[];
  credits?: number;
}

// =============================================================================
// SERPER CLIENT CLASS
// =============================================================================

export class SerperClient {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Serper] No API key found. Set SERPER_API_KEY environment variable.');
    }
  }

  // ---------------------------------------------------------------------------
  // SEARCH WEB
  // ---------------------------------------------------------------------------
  async search(
    query: string,
    options?: {
      num?: number;      // Number of results (default 10, max 100)
      gl?: string;       // Country code (e.g., 'us', 'au', 'gb')
      hl?: string;       // Language (e.g., 'en', 'es', 'fr')
      page?: number;     // Page number (default 1)
      autocorrect?: boolean;
    }
  ): Promise<SerperSearchResponse> {
    const response = await this.makeRequest('/search', {
      q: query,
      num: options?.num || 10,
      gl: options?.gl || 'us',
      hl: options?.hl || 'en',
      page: options?.page || 1,
      autocorrect: options?.autocorrect ?? true,
    });

    return response as SerperSearchResponse;
  }

  // ---------------------------------------------------------------------------
  // SEARCH NEWS
  // ---------------------------------------------------------------------------
  async searchNews(
    query: string,
    options?: {
      num?: number;
      gl?: string;
      hl?: string;
      tbs?: string;  // Time filter: 'qdr:h' (hour), 'qdr:d' (day), 'qdr:w' (week), 'qdr:m' (month)
    }
  ): Promise<SerperNewsResponse> {
    const response = await this.makeRequest('/news', {
      q: query,
      num: options?.num || 10,
      gl: options?.gl || 'us',
      hl: options?.hl || 'en',
      tbs: options?.tbs,
    });

    return response as SerperNewsResponse;
  }

  // ---------------------------------------------------------------------------
  // MAKE REQUEST
  // ---------------------------------------------------------------------------
  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('Serper API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Serper API error (${response.status}): ${error}`);
    }

    return response.json();
  }
}

// =============================================================================
// SIMPLIFIED SEARCH FUNCTIONS
// =============================================================================

const defaultClient = new SerperClient();

/**
 * Search the web using Serper API
 * Returns simplified results suitable for Kira's knowledge base
 */
export async function searchWeb(
  query: string,
  options?: {
    maxResults?: number;
    country?: string;
    language?: string;
  }
): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  date?: string;
}>> {
  try {
    const response = await defaultClient.search(query, {
      num: options?.maxResults || 5,
      gl: options?.country || 'us',
      hl: options?.language || 'en',
    });

    return response.organic.map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      date: result.date,
    }));
  } catch (error) {
    console.error('[searchWeb] Error:', error);
    throw error;
  }
}

/**
 * Search news using Serper API
 */
export async function searchNews(
  query: string,
  options?: {
    maxResults?: number;
    country?: string;
    timeframe?: 'hour' | 'day' | 'week' | 'month';
  }
): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  date: string;
  source: string;
}>> {
  const tbsMap = {
    hour: 'qdr:h',
    day: 'qdr:d',
    week: 'qdr:w',
    month: 'qdr:m',
  };

  try {
    const response = await defaultClient.searchNews(query, {
      num: options?.maxResults || 5,
      gl: options?.country || 'us',
      tbs: options?.timeframe ? tbsMap[options.timeframe] : undefined,
    });

    return response.news.map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      date: result.date,
      source: result.source,
    }));
  } catch (error) {
    console.error('[searchNews] Error:', error);
    throw error;
  }
}

/**
 * Get knowledge graph info for a topic (if available)
 */
export async function getKnowledgeGraph(
  query: string
): Promise<SerperKnowledgeGraph | null> {
  try {
    const response = await defaultClient.search(query, { num: 1 });
    return response.knowledgeGraph || null;
  } catch (error) {
    console.error('[getKnowledgeGraph] Error:', error);
    return null;
  }
}