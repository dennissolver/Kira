// app/api/pubguard/v2/scan/route.ts
// PubGuard v2 - Comprehensive Security Scanner API
// ALL TESTS ARE REAL - No Simulations
// FIXED: Now saves scan results to Supabase with user_id

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
import { runAllSecurityTests } from '../analyzers/security-tests';
import type { SecurityTestsAnalysis } from '../types';
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
import { saveScanToSupabase } from '@/lib/pubguard/supabase';

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SHODAN_API_KEY = process.env.SHODAN_API_KEY;

// Parse GitHub URL to extract project name and alternatives
function parseTarget(url: string): {
  name: string;
  owner: string;
  alternateNames: string[];
} {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }

  const owner = match[1];
  const name = match[2].replace(/\.git$/, '');

  // Generate alternate search names
  const alternateNames: string[] = [];

  // Add hyphen variations
  if (name.includes('-')) {
    alternateNames.push(name.replace(/-/g, ''));
    alternateNames.push(name.replace(/-/g, '_'));
  }
  if (name.includes('_')) {
    alternateNames.push(name.replace(/_/g, '-'));
    alternateNames.push(name.replace(/_/g, ''));
  }

  return { name, owner, alternateNames };
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ScanRequest & {
      userType?: string;
      userId?: string;
      sessionId?: string;
      agentId?: string;
      conversationId?: string;
    } = await request.json();

    const {
      url,
      includeSocialSignals = true,
      userType,
      userId,
      sessionId,
      agentId,
      conversationId,
    } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Parse target
    const { name, owner, alternateNames } = parseTarget(url);
    const allSearchTerms = [name, ...alternateNames];

    // Track sources checked
    const sourcesChecked: SourceCheck[] = [];
    const allFindings: Finding[] = [];

    // ==========================================================================
    // PHASE 1: Data Collection (Real API Calls)
    // ==========================================================================

    // 1. GitHub Analysis (REAL - GitHub API)
    console.log(`[PubGuard] Analyzing GitHub repo: ${owner}/${name}`);
    let githubAnalysis = null;
    let githubFindings: Finding[] = [];

    try {
      const result = await analyzeGitHubRepo(url);
      githubAnalysis = result.analysis;
      githubFindings = result.findings;
      allFindings.push(...githubFindings);

      // Add alternate names from GitHub analysis
      if ((githubAnalysis?.previousNames?.length ?? 0) > 0) {
        for (const prevName of githubAnalysis!.previousNames) {
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

    // 2. CVE Analysis (REAL - NVD API)
    console.log(`[PubGuard] Checking CVE database for: ${allSearchTerms.join(', ')}`);
    let cveAnalysis = null;

    try {
      const result = await analyzeCVEs(name, owner, alternateNames);
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

    // 3. News Analysis (REAL - Serper API, requires key)
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

    // 4. Social Signals (REAL - Serper API, requires key)
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

    // ==========================================================================
    // PHASE 2: Security Tests (REAL - Multiple APIs)
    // ==========================================================================

    console.log(`[PubGuard] Running security tests...`);
    let securityTestResults: SecurityTestsAnalysis | null = null;

    try {
      securityTestResults = await runAllSecurityTests(owner, name, name, {
        githubToken: GITHUB_TOKEN,
        shodanApiKey: SHODAN_API_KEY,
      });

      // Add security test findings (now comes from securityTestResults.findings)
      if (securityTestResults.findings) {
        allFindings.push(...securityTestResults.findings);
      }

      // Add to sources checked
      for (const test of securityTestResults.results) {
        sourcesChecked.push({
          name: test.testName,
          searched: [test.category],
          found: test.passed ? 0 : 1,
          status: test.passed ? 'success' : 'partial',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[PubGuard] Security tests failed:', err);
    }

    // ==========================================================================
    // PHASE 3: Risk Scoring & Report Generation
    // ==========================================================================

    console.log(`[PubGuard] Calculating risk scores`);

    const architectureRisk = calculateArchitectureRisk(githubAnalysis);
    const vulnerabilityRisk = calculateVulnerabilityRisk(cveAnalysis, githubAnalysis);
    const mediaRisk = calculateMediaRisk(newsAnalysis, socialAnalysis);
    const maintainerRisk = calculateMaintainerResponse(githubAnalysis);
    const velocityRisk = calculateVelocityRisk(githubAnalysis);

    // Add security test score if available
    let securityTestRisk = {
      name: 'Security Tests',
      description: 'Automated security scanning results',
      score: 0,
      weight: 20,
      weightedScore: 0,
      factors: [] as string[],
    };

    if (securityTestResults) {
      securityTestRisk.score = securityTestResults.overallRisk;
      securityTestRisk.weightedScore = securityTestRisk.score * (securityTestRisk.weight / 100);
      securityTestRisk.factors = securityTestResults.results
        .map(t => `${t.testName}: ${t.passed ? '\u2714' : '\u2718'}`);
    }

    const riskCategories = [
      architectureRisk,
      vulnerabilityRisk,
      mediaRisk,
      maintainerRisk,
      velocityRisk,
      securityTestRisk,
    ];

    const overallRiskScore = calculateOverallScore(riskCategories);
    const trafficLight = determineTrafficLight(overallRiskScore);
    const recommendation = determineRecommendation(trafficLight);

    // Generate Writer Guidance
    const writerGuidance = generateWriterGuidance(
      trafficLight,
      allFindings,
      githubAnalysis,
      newsAnalysis
    );

    // Build final report
    const generatedAt = new Date().toISOString();

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
      codebase: null,
      securityTests: securityTestResults,

      writerGuidance,

      disclaimer: `This report was generated automatically by PubGuard v2.1 on ${generatedAt}. ` +
        `All security tests are real and query live APIs (NVD, OSV.dev, GitHub, Shodan). ` +
        `It represents a point-in-time security assessment and should not be considered exhaustive. ` +
        `Security conditions may change. Always verify current status before making recommendations. ` +
        `This report is for informational purposes only and does not constitute legal advice.`,

      reportHash: '',
    };

    report.reportHash = generateReportHash(report);

    const duration = Date.now() - startTime;
    console.log(`[PubGuard] Scan complete in ${duration}ms - ${trafficLight.toUpperCase()} (${overallRiskScore}/100)`);

    // ==========================================================================
    // PHASE 4: Save to Supabase
    // ==========================================================================

    try {
      const saved = await saveScanToSupabase(
        report,
        duration,
        userId || undefined,
        sessionId || undefined,
        (userType as 'writer' | 'developer' | 'user' | 'analyst') || 'user',
        agentId || undefined,
        conversationId || undefined
      );
      if (saved) {
        console.log(`[PubGuard] Saved to Supabase: ${saved.id}`);
        (report as any).dbScanId = saved.id;
      }
    } catch (saveErr) {
      // Don't fail the scan response if the DB save fails
      console.error('[PubGuard] Failed to save to Supabase:', saveErr);
    }

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

  if (!url) {
    return NextResponse.json(
      {
        error: 'URL parameter required',
        usage: '/api/pubguard/v2/scan?url=https://github.com/owner/repo',
        version: '2.1',
        realTests: [
          'GitHub Analysis (GitHub API)',
          'CVE Database (NVD API)',
          'Security News (Serper API - optional)',
          'Social Signals (Serper API - optional)',
          'Dependency Vulnerabilities (OSV.dev API)',
          'Secrets Detection (GitHub Code Search)',
          'Maintainer Activity (GitHub API)',
          'License Compliance (GitHub API)',
          'Typosquatting Check (Local analysis)',
          'Internet Exposure (Shodan API - optional)',
        ],
      },
      { status: 400 }
    );
  }

  // Forward to POST handler
  const fakeRequest = {
    json: async () => ({ url }),
  } as NextRequest;

  return POST(fakeRequest);
}