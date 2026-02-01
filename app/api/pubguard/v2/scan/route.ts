// app/api/pubguard/v2/scan/route.ts
// PubGuard v2 - Comprehensive Security Scanner API
// With Supabase integration for scan persistence

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import type {
  PubGuardReport,
  ScanRequest,
  SourceCheck,
  Finding
} from '../types';

import { analyzeGitHubRepo } from '../analyzers/github';
import { analyzeNews, analyzeSocialSignals } from '../analyzers/news';
import { analyzeCVEs } from '../analyzers/cve';
import {
  calculateArchitectureRisk,
  calculateVulnerabilityRisk,
  calculateMediaRisk,
  calculateMaintainerResponse,
  calculateVelocityRisk,
  calculateOverallScore,
  determineTrafficLight,
  determineRecommendation,
  generateWriterGuidance,
  categorizeFindings,
} from '../scoring';

// Supabase integration
import { saveScanToSupabase } from '@/lib/pubguard/supabase';

// Valid user types for PubGuard
type UserType = 'writer' | 'developer' | 'user' | 'analyst';

// Parse GitHub URL to extract project name and alternatives
function parseTarget(url: string): {
  name: string;
  owner: string;
  url: string;
  alternateNames: string[];
} {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }

  const owner = match[1];
  const name = match[2].replace(/\.git$/, '');

  // Known alternate names for popular projects
  const knownAlternates: Record<string, string[]> = {
    'openclaw': ['clawdbot', 'moltbot', 'clawd'],
    'moltbot': ['clawdbot', 'openclaw', 'clawd'],
  };

  const alternateNames = knownAlternates[name.toLowerCase()] || [];

  return { name, owner, url, alternateNames };
}

// Generate report hash for verification
function generateReportHash(report: Partial<PubGuardReport>): string {
  const data = JSON.stringify({
    target: report.target,
    generatedAt: report.generatedAt,
    overallRiskScore: report.overallRiskScore,
  });
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// Validate user type
function isValidUserType(type: string | null | undefined): type is UserType {
  return type === 'writer' || type === 'developer' || type === 'user' || type === 'analyst';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ScanRequest & {
      userType?: string;
      userId?: string;
      sessionId?: string;
    } = await request.json();

    const {
      url,
      includeCodebaseAnalysis = true,
      includeSocialSignals = true,
      userType: rawUserType,
      userId,
      sessionId,
    } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate and default userType
    const userType: UserType = isValidUserType(rawUserType) ? rawUserType : 'user';
    console.log(`[PubGuard] Scan requested by userType: ${userType}`);

    // Parse target
    const target = parseTarget(url);
    const { name, owner, alternateNames } = target;
    const allSearchTerms = [name, ...alternateNames];

    // Track sources checked
    const sourcesChecked: SourceCheck[] = [];
    const allFindings: Finding[] = [];

    // 1. GitHub Analysis
    console.log(`[PubGuard] Analyzing GitHub repo: ${owner}/${name}`);
    let githubAnalysis = null;
    let githubFindings: Finding[] = [];

    try {
      const result = await analyzeGitHubRepo(url);
      githubAnalysis = result.analysis;
      githubFindings = result.findings;
      allFindings.push(...githubFindings);

      // Add alternate names from GitHub analysis
      if (githubAnalysis && githubAnalysis.previousNames && githubAnalysis.previousNames.length > 0) {
        for (const prevName of githubAnalysis.previousNames) {
          if (!alternateNames.includes(prevName)) {
            alternateNames.push(prevName);
          }
        }
      }

      sourcesChecked.push({
        name: 'GitHub API',
        searched: [`${owner}/${name}`, 'SECURITY.md', 'commits', 'issues'],
        found: 1,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[PubGuard] GitHub analysis failed:', err);
      sourcesChecked.push({
        name: 'GitHub API',
        searched: [`${owner}/${name}`],
        found: 0,
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. CVE Analysis
    console.log(`[PubGuard] Checking CVE database for: ${allSearchTerms.join(', ')}`);
    let cveAnalysis = null;

    try {
      const result = await analyzeCVEs(name, alternateNames);
      cveAnalysis = result.analysis;
      allFindings.push(...result.findings);

      sourcesChecked.push({
        name: 'NVD/CVE Database',
        searched: result.analysis.searchTerms,
        found: result.analysis.totalFound,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[PubGuard] CVE analysis failed:', err);
      sourcesChecked.push({
        name: 'NVD/CVE Database',
        searched: allSearchTerms,
        found: 0,
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. News Analysis
    console.log(`[PubGuard] Scanning security news for: ${allSearchTerms.join(', ')}`);
    let newsAnalysis = null;

    try {
      const result = await analyzeNews(name, alternateNames);
      newsAnalysis = result.analysis;
      allFindings.push(...result.findings);

      sourcesChecked.push({
        name: 'Security News',
        searched: result.analysis.searchTerms.slice(0, 5),
        found: result.analysis.totalFound,
        status: result.analysis.totalFound > 0 ? 'success' : 'partial',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[PubGuard] News analysis failed:', err);
      sourcesChecked.push({
        name: 'Security News',
        searched: allSearchTerms.map(t => `${t} security vulnerability`),
        found: 0,
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Social Signals (optional)
    let socialAnalysis = null;

    if (includeSocialSignals) {
      console.log(`[PubGuard] Analyzing social signals`);
      try {
        const result = await analyzeSocialSignals(name, alternateNames);
        socialAnalysis = result.analysis;
        allFindings.push(...result.findings);

        sourcesChecked.push({
          name: 'Social Media',
          searched: result.analysis.searchTerms,
          found: result.analysis.signals.length,
          status: result.analysis.signals.length > 0 ? 'success' : 'partial',
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[PubGuard] Social analysis failed:', err);
        sourcesChecked.push({
          name: 'Social Media',
          searched: allSearchTerms,
          found: 0,
          status: 'failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 5. Calculate Risk Scores
    console.log(`[PubGuard] Calculating risk scores`);

    const architectureRisk = calculateArchitectureRisk(githubAnalysis);
    const vulnerabilityRisk = calculateVulnerabilityRisk(cveAnalysis, githubAnalysis);
    const mediaRisk = calculateMediaRisk(newsAnalysis, socialAnalysis);
    const maintainerRisk = calculateMaintainerResponse(githubAnalysis);
    const velocityRisk = calculateVelocityRisk(githubAnalysis);

    const riskCategories = [
      architectureRisk,
      vulnerabilityRisk,
      mediaRisk,
      maintainerRisk,
      velocityRisk,
    ];

    const overallRiskScore = calculateOverallScore(riskCategories);
    const trafficLight = determineTrafficLight(overallRiskScore);
    const recommendation = determineRecommendation(trafficLight);

    // 6. Generate Writer Guidance
    const writerGuidance = generateWriterGuidance(
      trafficLight,
      allFindings,
      githubAnalysis,
      newsAnalysis
    );

    // 7. Build final report
    const generatedAt = new Date().toISOString();
    const duration = Date.now() - startTime;

    const report: PubGuardReport = {
      id: `pubguard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: '2.0',
      generatedAt,

      target: {
        url,
        name: `${owner}/${name}`,
        type: 'github_repo',
      },

      trafficLight,
      recommendation,

      overallRiskScore,
      riskCategories,

      sourcesChecked,
      searchTermsUsed: [...new Set(allSearchTerms)],

      findings: categorizeFindings(allFindings),

      github: githubAnalysis,
      cve: cveAnalysis,
      news: newsAnalysis,
      social: socialAnalysis,
      codebase: null, // TODO: Implement codebase analysis

      writerGuidance,

      disclaimer: `This report was generated automatically by PubGuard v2.0 on ${generatedAt}. ` +
        `It represents a point-in-time security assessment and should not be considered exhaustive. ` +
        `Security conditions may change. Always verify current status before making recommendations. ` +
        `This report is for informational purposes only and does not constitute legal advice.`,

      reportHash: '', // Will be set below
    };

    report.reportHash = generateReportHash(report);

    // 8. Save to Supabase (async, don't block response)
    // Signature: saveScanToSupabase(report, durationMs, userId?, sessionId?, userType?)
    saveScanToSupabase(report, duration, userId, sessionId, userType)
      .then(result => {
        if (result) {
          console.log(`[PubGuard] Saved to Supabase: ${result.id}`);
        }
      })
      .catch(err => {
        console.error('[PubGuard] Supabase save failed:', err);
      });

    console.log(`[PubGuard] Scan complete in ${duration}ms - ${trafficLight.toUpperCase()} (${overallRiskScore}/100)`);

    return NextResponse.json(report);

  } catch (error) {
    console.error('[PubGuard] Scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const userType = request.nextUrl.searchParams.get('userType');
  const userId = request.nextUrl.searchParams.get('userId');
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!url) {
    return NextResponse.json(
      {
        error: 'URL parameter required',
        usage: '/api/pubguard/v2/scan?url=https://github.com/owner/repo&userType=writer',
        version: '2.0',
        userTypes: ['writer', 'developer', 'user', 'analyst'],
      },
      { status: 400 }
    );
  }

  // Forward to POST handler with query params
  const fakeRequest = {
    json: async () => ({
      url,
      userType: userType || 'user',
      userId: userId || undefined,
      sessionId: sessionId || undefined,
    }),
  } as NextRequest;

  return POST(fakeRequest);
}