// app/api/pubguard/scan/news/route.ts
// Security News Scanner - searches for security-related news and articles

import { NextRequest, NextResponse } from 'next/server';
import type { NewsArticle, NewsScanResult } from '../../types';

// Serper API for Google search
interface SerperResult {
  organic: {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
  }[];
  news?: {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
  }[];
}

// Security-focused news sources for better results
const SECURITY_SOURCES = [
  'bleepingcomputer.com',
  'krebsonsecurity.com',
  'thehackernews.com',
  'securityweek.com',
  'darkreading.com',
  'threatpost.com',
  'csoonline.com',
  'infosecurity-magazine.com',
  'schneier.com',
  'arstechnica.com/security',
];

// Search using Serper API
async function searchSerper(query: string, type: 'search' | 'news' = 'search'): Promise<SerperResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const endpoint = type === 'news'
    ? 'https://google.serper.dev/news'
    : 'https://google.serper.dev/search';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: 20,
      tbs: 'qdr:m', // Last month
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  return response.json();
}

// Calculate relevance score based on source and keywords
function calculateRelevance(article: Omit<NewsArticle, 'relevanceScore'>, query: string): number {
  let score = 50; // Base score

  // Boost trusted security sources
  if (SECURITY_SOURCES.some(s => article.url.includes(s))) {
    score += 20;
  }

  // Boost if title contains query terms
  const queryTerms = query.toLowerCase().split(/\s+/);
  const titleLower = article.title.toLowerCase();
  const snippetLower = article.snippet.toLowerCase();

  queryTerms.forEach(term => {
    if (term.length > 3) {
      if (titleLower.includes(term)) score += 10;
      if (snippetLower.includes(term)) score += 5;
    }
  });

  // Boost security-related keywords
  const securityKeywords = ['vulnerability', 'exploit', 'breach', 'attack', 'cve', 'patch', 'zero-day', 'malware', 'ransomware', 'security'];
  securityKeywords.forEach(kw => {
    if (titleLower.includes(kw) || snippetLower.includes(kw)) {
      score += 5;
    }
  });

  // Recent articles get a boost
  if (article.publishedAt) {
    const pubDate = new Date(article.publishedAt);
    const daysSince = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 7) score += 15;
    else if (daysSince < 14) score += 10;
    else if (daysSince < 30) score += 5;
  }

  return Math.min(100, score);
}

// Parse date from various formats
function parseDate(dateStr?: string): string {
  if (!dateStr) return '';

  try {
    // Handle relative dates like "2 days ago"
    const relativeMatch = dateStr.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
    if (relativeMatch) {
      const num = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const date = new Date();

      switch (unit) {
        case 'hour': date.setHours(date.getHours() - num); break;
        case 'day': date.setDate(date.getDate() - num); break;
        case 'week': date.setDate(date.getDate() - num * 7); break;
        case 'month': date.setMonth(date.getMonth() - num); break;
      }

      return date.toISOString();
    }

    // Try standard date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // Ignore parsing errors
  }

  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,           // Search query (e.g., "react vulnerability", "npm package security")
      product,         // Specific product to search for
      vendor,          // Vendor name
      includeGeneral = true, // Include general security news
      limit = 15,
    } = body;

    if (!query && !product) {
      return NextResponse.json(
        { error: 'Query or product name is required' },
        { status: 400 }
      );
    }

    // Build search queries
    const searches: string[] = [];

    if (query) {
      searches.push(`${query} security vulnerability`);
    }

    if (product) {
      searches.push(`${product} security vulnerability`);
      searches.push(`${product} CVE exploit`);
      if (vendor) {
        searches.push(`${vendor} ${product} security`);
      }
    }

    if (includeGeneral && !query && !product) {
      searches.push('latest security vulnerabilities');
    }

    // Execute searches in parallel
    const allArticles: NewsArticle[] = [];
    const seenUrls = new Set<string>();

    await Promise.all(searches.map(async (searchQuery) => {
      try {
        // Try news search first
        const newsResult = await searchSerper(searchQuery, 'news');

        const newsArticles = (newsResult.news || []).map(item => ({
          title: item.title,
          url: item.link,
          source: item.source || new URL(item.link).hostname.replace('www.', ''),
          publishedAt: parseDate(item.date),
          snippet: item.snippet || '',
        }));

        // Also do regular search for broader coverage
        const searchResult = await searchSerper(searchQuery, 'search');

        const searchArticles = (searchResult.organic || []).map(item => ({
          title: item.title,
          url: item.link,
          source: item.source || new URL(item.link).hostname.replace('www.', ''),
          publishedAt: parseDate(item.date),
          snippet: item.snippet || '',
        }));

        // Deduplicate and add with relevance score
        [...newsArticles, ...searchArticles].forEach(article => {
          if (!seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            const relevanceScore = calculateRelevance(article, searchQuery);
            allArticles.push({
              ...article,
              relevanceScore,
            });
          }
        });
      } catch (err) {
        console.error(`Search failed for "${searchQuery}":`, err);
      }
    }));

    // Sort by relevance and limit
    const sortedArticles = allArticles
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);

    const result: NewsScanResult = {
      query: query || product || '',
      articles: sortedArticles,
      totalFound: allArticles.length,
      scannedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('News scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan security news' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  const product = request.nextUrl.searchParams.get('product');
  const vendor = request.nextUrl.searchParams.get('vendor');
  const limit = request.nextUrl.searchParams.get('limit');

  if (!query && !product) {
    return NextResponse.json(
      { error: 'Query or product parameter is required' },
      { status: 400 }
    );
  }

  const fakeRequest = {
    json: async () => ({
      query,
      product,
      vendor,
      limit: limit ? parseInt(limit) : undefined,
    }),
  } as NextRequest;

  return POST(fakeRequest);
}