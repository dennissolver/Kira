// app/api/pubguard/scan/github/route.ts
// GitHub Repository Security Scanner API Route

import { NextRequest, NextResponse } from 'next/server';
import type { GitHubRepoAnalysis, RiskLevel } from '../../types';

// Parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?#]+)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }
  return null;
}

// Calculate days between dates
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Determine velocity based on activity
function calculateVelocity(
  stars: number,
  forks: number,
  daysSinceCommit: number,
  openIssues: number
): 'high' | 'medium' | 'low' | 'stale' {
  if (daysSinceCommit > 365) return 'stale';
  if (daysSinceCommit > 180) return 'low';

  const activityScore = stars * 0.3 + forks * 0.5 + (100 - Math.min(openIssues, 100)) * 0.2;

  if (activityScore > 500 && daysSinceCommit < 30) return 'high';
  if (activityScore > 100 && daysSinceCommit < 90) return 'medium';
  return 'low';
}

// Calculate risk score (0-100, higher = more risky)
function calculateRiskScore(analysis: Partial<GitHubRepoAnalysis['analysis']>): {
  score: number;
  level: RiskLevel;
  recommendations: string[];
} {
  let score = 0;
  const recommendations: string[] = [];

  // Age factors
  if (analysis.age?.daysSinceLastCommit && analysis.age.daysSinceLastCommit > 365) {
    score += 25;
    recommendations.push('Repository appears abandoned (no commits in over a year). Consider alternatives.');
  } else if (analysis.age?.daysSinceLastCommit && analysis.age.daysSinceLastCommit > 180) {
    score += 15;
    recommendations.push('Limited recent activity. Monitor for maintenance status.');
  }

  // Security factors
  if (!analysis.security?.hasSecurityPolicy) {
    score += 15;
    recommendations.push('No SECURITY.md file. Vulnerability reporting process unclear.');
  }

  if (!analysis.security?.hasLicense) {
    score += 10;
    recommendations.push('No license detected. Legal usage rights unclear.');
  }

  if (analysis.security?.vulnerabilityAlerts && analysis.security.vulnerabilityAlerts > 0) {
    score += Math.min(analysis.security.vulnerabilityAlerts * 5, 30);
    recommendations.push(`${analysis.security.vulnerabilityAlerts} known vulnerability alert(s). Review and patch immediately.`);
  }

  if (analysis.security?.securityIssuesCount && analysis.security.securityIssuesCount > 0) {
    score += Math.min(analysis.security.securityIssuesCount * 3, 15);
    recommendations.push(`${analysis.security.securityIssuesCount} security-related issue(s) reported.`);
  }

  // Maintenance factors
  if (analysis.maintenance?.isArchived) {
    score += 30;
    recommendations.push('Repository is archived. No further updates expected.');
  }

  if (analysis.maintenance?.contributorCount && analysis.maintenance.contributorCount < 2) {
    score += 10;
    recommendations.push('Single maintainer risk. Bus factor is low.');
  }

  if (analysis.popularity?.velocity === 'stale') {
    score += 15;
    recommendations.push('Project velocity is stale. Community engagement minimal.');
  }

  // Positive factors (reduce risk)
  if (analysis.popularity?.stars && analysis.popularity.stars > 1000) {
    score -= 10;
  }
  if (analysis.security?.dependabotEnabled) {
    score -= 5;
  }
  if (analysis.maintenance?.recentContributors && analysis.maintenance.recentContributors > 5) {
    score -= 5;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: RiskLevel;
  if (score >= 70) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';
  else level = 'low';

  return { score, level, recommendations };
}

// GitHub API helper
async function githubFetch(endpoint: string, token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PubGuard-Scanner',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  
  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit exceeded. Please provide a token or wait.');
      }
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

// Check if file exists in repo
async function checkFileExists(owner: string, repo: string, path: string, token?: string): Promise<boolean> {
  try {
    const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, token);
    return result !== null;
  } catch {
    return false;
  }
}

// Get security issues count
async function getSecurityIssuesCount(owner: string, repo: string, token?: string): Promise<number> {
  try {
    const result = await githubFetch(
      `/search/issues?q=repo:${owner}/${repo}+label:security+state:open`,
      token
    );
    return result?.total_count || 0;
  } catch {
    return 0;
  }
}

// Get contributors
async function getContributors(owner: string, repo: string, token?: string): Promise<{ total: number; recent: number }> {
  try {
    const contributors = await githubFetch(`/repos/${owner}/${repo}/contributors?per_page=100`, token);
    if (!contributors) return { total: 0, recent: 0 };

    const total = contributors.length;
    
    // Count contributors with significant activity
    const recent = contributors.filter((c: any) => c.contributions > 5).length;
    
    return { total, recent };
  } catch {
    return { total: 0, recent: 0 };
  }
}

// Get vulnerability alerts (requires auth with security scope)
async function getVulnerabilityAlerts(owner: string, repo: string, token?: string): Promise<number> {
  if (!token) return 0;
  
  try {
    const query = `
      query {
        repository(owner: "${owner}", name: "${repo}") {
          vulnerabilityAlerts(first: 100) {
            totalCount
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    return data?.data?.repository?.vulnerabilityAlerts?.totalCount || 0;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, token } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'GitHub URL is required' },
        { status: 400 }
      );
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;
    const githubToken = token || process.env.GITHUB_TOKEN;

    // Fetch main repo data
    const repoData = await githubFetch(`/repos/${owner}/${repo}`, githubToken);
    if (!repoData) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Fetch additional data in parallel
    const [
      hasSecurityPolicy,
      hasCodeOfConduct,
      hasContributing,
      securityIssuesCount,
      contributors,
      vulnerabilityAlerts,
    ] = await Promise.all([
      checkFileExists(owner, repo, 'SECURITY.md', githubToken),
      checkFileExists(owner, repo, 'CODE_OF_CONDUCT.md', githubToken),
      checkFileExists(owner, repo, 'CONTRIBUTING.md', githubToken),
      getSecurityIssuesCount(owner, repo, githubToken),
      getContributors(owner, repo, githubToken),
      getVulnerabilityAlerts(owner, repo, githubToken),
    ]);

    // Calculate metrics
    const now = new Date();
    const pushedAt = new Date(repoData.pushed_at);
    const daysSinceLastCommit = daysBetween(pushedAt, now);

    const velocity = calculateVelocity(
      repoData.stargazers_count,
      repoData.forks_count,
      daysSinceLastCommit,
      repoData.open_issues_count
    );

    // Build analysis object
    const partialAnalysis = {
      age: {
        created: repoData.created_at,
        lastCommit: repoData.pushed_at,
        daysSinceLastCommit,
        isStale: daysSinceLastCommit > 365,
      },
      popularity: {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        openIssues: repoData.open_issues_count,
        velocity,
      },
      security: {
        hasSecurityPolicy,
        hasCodeOfConduct,
        hasContributing,
        hasLicense: !!repoData.license,
        licenseType: repoData.license?.spdx_id || null,
        securityIssuesCount,
        dependabotEnabled: repoData.security_and_analysis?.dependabot_security_updates?.status === 'enabled',
        vulnerabilityAlerts,
      },
      maintenance: {
        contributorCount: contributors.total,
        recentContributors: contributors.recent,
        hasReadme: true,
        defaultBranch: repoData.default_branch,
        isArchived: repoData.archived,
        isFork: repoData.fork,
      },
    };

    // Calculate risk
    const { score, level, recommendations } = calculateRiskScore(partialAnalysis);

    const result: GitHubRepoAnalysis = {
      url: repoData.html_url,
      name: repoData.name,
      owner: repoData.owner.login,
      analysis: {
        ...partialAnalysis,
        riskScore: score,
        riskLevel: level,
        recommendations,
      },
      scannedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan repository' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  const fakeRequest = {
    json: async () => ({ url }),
  } as NextRequest;

  return POST(fakeRequest);
}
