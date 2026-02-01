// app/api/pubguard/v2/analyzers/news.ts
// Security news and social signal analysis

import type { NewsAnalysis, NewsArticle, SocialAnalysis, SocialSignal, Finding } from '../types';

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Trusted security sources (higher credibility)
const SECURITY_SOURCES = {
  high: [
    'bleepingcomputer.com',
    'krebsonsecurity.com',
    'theregister.com',
    'arstechnica.com',
    'wired.com',
    'schneier.com',
    'securityweek.com',
    'darkreading.com',
    'thehackernews.com',
    'techcrunch.com',
    'zdnet.com',
  ],
  medium: [
    'medium.com',
    'dev.to',
    'hackernoon.com',
    'infoworld.com',
    'csoonline.com',
  ],
};

// Known security researchers and experts
const KNOWN_EXPERTS: Record<string, { name: string; title: string; org: string }> = {
  'argvee': { name: 'Heather Adkins', title: 'VP of Security Engineering', org: 'Google' },
  'steipete': { name: 'Peter Steinberger', title: 'Creator', org: 'OpenClaw/Moltbot' },
  'taviso': { name: 'Tavis Ormandy', title: 'Security Researcher', org: 'Google Project Zero' },
  'thegrugq': { name: 'The Grugq', title: 'Security Researcher', org: 'Independent' },
  'swiftonsecurity': { name: 'SwiftOnSecurity', title: 'Security Professional', org: 'Industry' },
};

// Warning keywords that indicate security concerns
const WARNING_KEYWORDS = [
  'vulnerability', 'vulnerabilities', 'exploit', 'breach', 'leak', 'exposed',
  'attack', 'malware', 'backdoor', 'compromised', 'risk', 'danger', 'warning',
  'don\'t run', 'do not run', 'avoid', 'caution', 'threat', 'insecure',
  'plaintext', 'credential theft', 'remote code execution', 'rce', 'injection'
];

// Positive keywords
const POSITIVE_KEYWORDS = [
  'fixed', 'patched', 'secured', 'hardened', 'mitigated', 'resolved',
  'security update', 'security improvement'
];

async function searchSerper(query: string, type: 'search' | 'news' = 'news'): Promise<any> {
  if (!SERPER_API_KEY) {
    console.warn('SERPER_API_KEY not configured');
    return { organic: [], news: [] };
  }

  const endpoint = type === 'news' 
    ? 'https://google.serper.dev/news'
    : 'https://google.serper.dev/search';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: 20,
      tbs: 'qdr:m3', // Last 3 months
    }),
  });

  if (!response.ok) {
    console.error(`Serper API error: ${response.status}`);
    return { organic: [], news: [] };
  }

  return response.json();
}

function analyzeArticleSentiment(article: { title: string; snippet: string }): {
  sentiment: NewsArticle['sentiment'];
  isSecurityWarning: boolean;
} {
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  
  const hasWarning = WARNING_KEYWORDS.some(kw => text.includes(kw));
  const hasPositive = POSITIVE_KEYWORDS.some(kw => text.includes(kw));
  
  let sentiment: NewsArticle['sentiment'] = 'neutral';
  
  if (hasWarning && !hasPositive) {
    sentiment = 'warning';
  } else if (hasWarning && hasPositive) {
    sentiment = 'negative'; // Mixed but concerning
  } else if (hasPositive) {
    sentiment = 'positive';
  }
  
  return {
    sentiment,
    isSecurityWarning: hasWarning,
  };
}

function getSourceCredibility(url: string): 'high' | 'medium' | 'low' {
  const domain = new URL(url).hostname.replace('www.', '');
  
  if (SECURITY_SOURCES.high.some(s => domain.includes(s))) return 'high';
  if (SECURITY_SOURCES.medium.some(s => domain.includes(s))) return 'medium';
  return 'low';
}

export async function analyzeNews(
  projectName: string,
  alternateNames: string[] = []
): Promise<{
  analysis: NewsAnalysis;
  findings: Finding[];
}> {
  const searchTerms = [
    `${projectName} security vulnerability`,
    `${projectName} security warning`,
    `${projectName} exploit`,
    `${projectName} data breach`,
    `${projectName} security concerns`,
    ...alternateNames.flatMap(name => [
      `${name} security vulnerability`,
      `${name} security warning`,
    ]),
  ];

  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const expertWarnings: NewsAnalysis['expertWarnings'] = [];

  // Search for each term
  for (const term of searchTerms.slice(0, 6)) { // Limit to avoid rate limits
    try {
      const [newsResults, searchResults] = await Promise.all([
        searchSerper(term, 'news'),
        searchSerper(term, 'search'),
      ]);

      const processResults = (items: any[], isNews: boolean) => {
        for (const item of items || []) {
          const url = item.link;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);

          const { sentiment, isSecurityWarning } = analyzeArticleSentiment({
            title: item.title,
            snippet: item.snippet || '',
          });

          allArticles.push({
            title: item.title,
            url,
            source: item.source || new URL(url).hostname.replace('www.', ''),
            publishedAt: item.date || '',
            snippet: item.snippet || '',
            sentiment,
            isSecurityWarning,
            authorCredibility: getSourceCredibility(url),
          });
        }
      };

      processResults(newsResults.news, true);
      processResults(searchResults.organic, false);
    } catch (err) {
      console.error(`News search failed for "${term}":`, err);
    }
  }

  // Sort by credibility and warning status
  allArticles.sort((a, b) => {
    // Security warnings from high-credibility sources first
    const aScore = (a.isSecurityWarning ? 100 : 0) + 
                   (a.authorCredibility === 'high' ? 50 : a.authorCredibility === 'medium' ? 25 : 0);
    const bScore = (b.isSecurityWarning ? 100 : 0) + 
                   (b.authorCredibility === 'high' ? 50 : b.authorCredibility === 'medium' ? 25 : 0);
    return bScore - aScore;
  });

  const securityWarnings = allArticles.filter(a => a.isSecurityWarning);

  // Extract expert warnings from articles
  // This would ideally parse article content, but for now we use known patterns
  const knownWarnings = extractKnownExpertWarnings(projectName, alternateNames);
  expertWarnings.push(...knownWarnings);

  const analysis: NewsAnalysis = {
    searchTerms,
    totalFound: allArticles.length,
    articles: allArticles.slice(0, 20),
    securityWarnings: securityWarnings.slice(0, 10),
    expertWarnings,
  };

  // Generate findings
  const findings: Finding[] = [];

  if (securityWarnings.length > 0) {
    const highCredWarnings = securityWarnings.filter(w => w.authorCredibility === 'high');
    
    if (highCredWarnings.length > 0) {
      findings.push({
        severity: 'critical',
        category: 'Media Warnings',
        title: `${highCredWarnings.length} security warnings from major publications`,
        description: `Security concerns reported by: ${highCredWarnings.slice(0, 3).map(w => w.source).join(', ')}`,
        source: 'News Analysis',
        sourceUrl: highCredWarnings[0].url,
      });
    }

    if (securityWarnings.length > 5) {
      findings.push({
        severity: 'high',
        category: 'Media Coverage',
        title: `Widespread security coverage (${securityWarnings.length} articles)`,
        description: 'Multiple sources are reporting security concerns about this project.',
        source: 'News Analysis',
      });
    }
  }

  if (expertWarnings.length > 0) {
    for (const warning of expertWarnings) {
      findings.push({
        severity: 'critical',
        category: 'Expert Warning',
        title: `${warning.name} (${warning.organization}): Security warning`,
        description: warning.quote,
        source: warning.source,
        date: warning.date,
      });
    }
  }

  return { analysis, findings };
}

// Known expert warnings (hardcoded for known incidents)
function extractKnownExpertWarnings(
  projectName: string,
  alternateNames: string[]
): NewsAnalysis['expertWarnings'] {
  const warnings: NewsAnalysis['expertWarnings'] = [];
  
  const allNames = [projectName, ...alternateNames].map(n => n.toLowerCase());
  
  // Moltbot/Clawdbot/OpenClaw specific warnings
  if (allNames.some(n => ['moltbot', 'clawdbot', 'openclaw'].includes(n))) {
    warnings.push({
      name: 'Heather Adkins',
      title: 'VP of Security Engineering',
      organization: 'Google Cloud',
      quote: "My threat model is not your threat model, but it should be. Don't run Clawdbot.",
      source: 'Twitter/X',
      date: '2026-01-26',
    });
    
    warnings.push({
      name: 'Token Security Research',
      title: 'Security Research',
      organization: 'Token Security',
      quote: '22% of our customers have employees actively using Clawdbot within their organizations, likely without IT approval.',
      source: 'Token Security Blog',
      date: '2026-01-28',
    });
    
    warnings.push({
      name: 'Jamieson O\'Reilly',
      title: 'Founder',
      organization: 'Dvuln',
      quote: 'Found hundreds of Clawdbot instances exposed to the web with no authentication, leaking API keys, OAuth tokens, and conversation histories.',
      source: 'Security Research',
      date: '2026-01-27',
    });
  }
  
  return warnings;
}

// Social signal analysis
export async function analyzeSocialSignals(
  projectName: string,
  alternateNames: string[] = []
): Promise<{
  analysis: SocialAnalysis;
  findings: Finding[];
}> {
  const searchTerms = [
    `${projectName} security site:twitter.com OR site:x.com`,
    `${projectName} vulnerability site:news.ycombinator.com`,
    ...alternateNames.map(n => `${n} security warning`),
  ];

  const signals: SocialSignal[] = [];
  
  // Search for social signals
  for (const term of searchTerms.slice(0, 4)) {
    try {
      const results = await searchSerper(term, 'search');
      
      for (const item of results.organic || []) {
        let platform: SocialSignal['platform'] = 'twitter';
        if (item.link.includes('news.ycombinator')) platform = 'hackernews';
        else if (item.link.includes('reddit.com')) platform = 'reddit';
        else if (item.link.includes('linkedin.com')) platform = 'linkedin';
        else if (!item.link.includes('twitter.com') && !item.link.includes('x.com')) continue;

        const { sentiment } = analyzeArticleSentiment({
          title: item.title,
          snippet: item.snippet || '',
        });

        // Check for known experts
        let authorCredibility: SocialSignal['authorCredibility'] = 'unknown';
        const author = extractAuthorFromUrl(item.link);
        if (author && KNOWN_EXPERTS[author.toLowerCase()]) {
          authorCredibility = 'security_researcher';
        }

        signals.push({
          platform,
          author: author || 'Unknown',
          authorCredibility,
          content: item.snippet || item.title,
          url: item.link,
          date: item.date || '',
          sentiment: sentiment === 'warning' ? 'warning' : sentiment === 'negative' ? 'negative' : 'neutral',
          engagement: 0, // Would need API access to get real engagement
        });
      }
    } catch (err) {
      console.error(`Social search failed for "${term}":`, err);
    }
  }

  const securityResearcherWarnings = signals.filter(
    s => s.authorCredibility === 'security_researcher' && s.sentiment === 'warning'
  );

  const overallSentiment = signals.filter(s => s.sentiment === 'warning').length > signals.length / 3
    ? 'negative'
    : signals.filter(s => s.sentiment === 'positive').length > signals.length / 2
    ? 'positive'
    : 'mixed';

  const analysis: SocialAnalysis = {
    searchTerms,
    signals: signals.slice(0, 20),
    securityResearcherWarnings,
    overallSentiment,
  };

  const findings: Finding[] = [];

  if (securityResearcherWarnings.length > 0) {
    findings.push({
      severity: 'high',
      category: 'Expert Warnings',
      title: `${securityResearcherWarnings.length} security researcher warning(s)`,
      description: 'Security researchers have publicly warned about this project.',
      source: 'Social Analysis',
      sourceUrl: securityResearcherWarnings[0].url,
    });
  }

  return { analysis, findings };
}

function extractAuthorFromUrl(url: string): string | null {
  // Twitter/X
  const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/([^\/]+)/);
  if (twitterMatch) return twitterMatch[1];
  
  return null;
}
