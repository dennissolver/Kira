// app/api/pubguard/v2/scan/route.ts
// PubGuard v2 - Comprehensive Security Scanner API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
import { runSecurityTests } from '../analyzers/security-tests';
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

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Save scan results to Supabase
async function saveScanToSupabase(
  report: PubGuardReport,
  durationMs: number,
  userId?: string,
  sessionId?: string,
  userType?: string
): Promise<{ id: string } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('[PubGuard] Supabase not configured, skipping save');
    return null;
  }

  const { data, error } = await supabase
    .from('pubguard_scans')
    .insert({
      user_id: userId || null,
      session_id: sessionId || null,
      user_type: userType || null,
      target_url: report.target.url,
      target_name: report.target.name,
      target_owner: report.target.owner,
      traffic_light: report.trafficLight,
      risk_score: report.overallRiskScore,
      is_private_repo: report.target.isPrivate || false,
      findings: report.findings,
      github_analysis: report.github,
      cve_analysis: report.cve,
      news_analysis: report.news,
      security_tests: report.securityTests || null,
      writer_guidance: report.writerGuidance,
      sources_checked: report.sourcesChecked,
      scan_duration_ms: durationMs,
      report_hash: report.reportHash,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[PubGuard] Supabase insert error:', error);
    return null;
  }

  return data;
}

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

  // Known alternate names for popular projects
  const knownAlternates: Record<string, string[]> = {
    'openclaw': ['clawdbot', 'moltbot', 'clawd'],
    'moltbot': ['clawdbot', 'openclaw', 'clawd'],
  };

  const alternateNames = knownAlternates[name.toLowerCase()] || [];

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
    const body: ScanRequest = await request.json();
    const { url, includeCodebaseAnalysis = true, includeSocialSignals = true } = body;

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
    let isPrivateRepo = false;

    // 1. GitHub Analysis
    console.log(`[PubGuard] Analyzing GitHub repo: ${owner}/${name}`);
    let githubAnalysis = null;
    let githubFindings: Finding[] = [];
    
    try {
      const result = await analyzeGitHubRepo(url);
      githubAnalysis = result.analysis;
      githubFindings = result.findings;
      isPrivateRepo = result.isPrivate;
      allFindings.push(...githubFindings);
      
      if (isPrivateRepo) {
        console.log(`[PubGuard] Private repo detected - running limited analysis`);
        sourcesChecked.push({
          name: 'GitHub API',
          searched: [`${owner}/${name}`],
          found: 0,
          status: 'skipped',
          timestamp: new Date().toISOString(),
          note: 'Private repository - cannot access source code',
        });
      } else {
        // Add alternate names from GitHub analysis
        if (githubAnalysis?.previousNames && githubAnalysis.previousNames.length > 0) {
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
      }
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

    // 5. Automated Security Tests (expert methodology)
    // Skip most tests if private repo - we can't read the files
    console.log(`[PubGuard] Running automated security tests`);
    let securityTestResults = null;
    
    if (isPrivateRepo) {
      console.log(`[PubGuard] Skipping code-based security tests (private repo)`);
      sourcesChecked.push({
        name: 'Automated Security Tests',
        searched: [
          'Credential Storage',
          'Permission Scope',
          'Prompt Injection Risk',
          'Supply Chain',
          'Config Defaults',
          'Identity Stability',
          'Maintainer Response'
        ],
        found: 0,
        status: 'skipped',
        timestamp: new Date().toISOString(),
        note: 'Private repository - cannot analyze source code',
      });
    } else {
      try {
        const readmeContent = githubAnalysis?.readme || '';
        const securityMdContent = githubAnalysis?.securityMdContent || undefined;
        
        securityTestResults = await runSecurityTests(
          owner,
          name,
          readmeContent,
          securityMdContent,
          alternateNames
        );
        
        allFindings.push(...securityTestResults.findings);
        
        sourcesChecked.push({
          name: 'Automated Security Tests',
          searched: [
            'Credential Storage',
            'Permission Scope',
            'Prompt Injection Risk',
            'Supply Chain',
            'Config Defaults',
            'Exposure Scan',
            'Identity Stability',
            'Maintainer Response'
          ],
          found: securityTestResults.testsFailed,
          status: securityTestResults.testsFailed === 0 ? 'success' : 
                  securityTestResults.testsFailed <= 2 ? 'partial' : 'failed',
          timestamp: new Date().toISOString(),
        });
        
        console.log(`[PubGuard] Security tests: ${securityTestResults.testsPassed}/${securityTestResults.testsRun} passed`);
      } catch (err) {
        console.error('[PubGuard] Security tests failed:', err);
        sourcesChecked.push({
          name: 'Automated Security Tests',
          searched: ['Security tests'],
          found: 0,
          status: 'failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 6. Calculate Risk Scores
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

    const duration = Date.now() - startTime;
    console.log(`[PubGuard] Scan complete in ${duration}ms - ${trafficLight.toUpperCase()} (${overallRiskScore}/100)`);

    // Save to Supabase
    try {
      const saved = await saveScanToSupabase(report, duration, body.userId, body.sessionId, body.userType);
      if (saved) {
        console.log(`[PubGuard] Saved scan to Supabase: ${saved.id}`);
        report.scanId = saved.id;
      }
    } catch (saveError) {
      console.error('[PubGuard] Failed to save to Supabase:', saveError);
      // Don't fail the request, just log the error
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
        version: '2.0',
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
