// app/api/pubguard/report/generate/route.ts
// Generate PDF security report from scan results

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { 
  FullScanReport, 
  GitHubRepoAnalysis, 
  CVEScanResult, 
  NewsScanResult, 
  ExposureScanResult,
  RiskLevel 
} from '../../types';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Calculate overall risk from multiple scans
function calculateOverallRisk(scans: {
  github?: GitHubRepoAnalysis[];
  cve?: CVEScanResult[];
  exposures?: ExposureScanResult[];
}): { level: RiskLevel; score: number } {
  const scores: number[] = [];
  
  scans.github?.forEach(g => scores.push(g.analysis.riskScore));
  
  scans.cve?.forEach(c => {
    c.vulnerabilities.forEach(v => {
      switch (v.severity) {
        case 'CRITICAL': scores.push(90); break;
        case 'HIGH': scores.push(70); break;
        case 'MEDIUM': scores.push(50); break;
        case 'LOW': scores.push(25); break;
      }
    });
  });
  
  scans.exposures?.forEach(e => scores.push(e.exposure.riskScore));
  
  if (scores.length === 0) return { level: 'low', score: 0 };
  
  const sortedScores = scores.sort((a, b) => b - a);
  const topScores = sortedScores.slice(0, 5);
  const avgScore = topScores.reduce((a, b) => a + b, 0) / topScores.length;
  
  let level: RiskLevel;
  if (avgScore >= 70) level = 'critical';
  else if (avgScore >= 50) level = 'high';
  else if (avgScore >= 25) level = 'medium';
  else level = 'low';
  
  return { level, score: Math.round(avgScore) };
}

// Count findings by severity
function countFindings(scans: {
  github?: GitHubRepoAnalysis[];
  cve?: CVEScanResult[];
  exposures?: ExposureScanResult[];
}): { critical: number; high: number; medium: number; low: number } {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  
  scans.github?.forEach(g => counts[g.analysis.riskLevel]++);
  
  scans.cve?.forEach(c => {
    c.vulnerabilities.forEach(v => {
      const level = v.severity.toLowerCase() as RiskLevel;
      counts[level]++;
    });
  });
  
  scans.exposures?.forEach(e => counts[e.exposure.riskLevel]++);
  
  return counts;
}

// Aggregate recommendations
function aggregateRecommendations(scans: {
  github?: GitHubRepoAnalysis[];
  cve?: CVEScanResult[];
  exposures?: ExposureScanResult[];
}): string[] {
  const recommendations = new Set<string>();
  
  scans.github?.forEach(g => {
    g.analysis.recommendations.forEach(r => recommendations.add(r));
  });
  
  scans.cve?.forEach(c => {
    c.vulnerabilities.forEach(v => {
      if (v.severity === 'CRITICAL' || v.severity === 'HIGH') {
        recommendations.add(`Address ${v.id}: ${v.description.slice(0, 100)}...`);
      }
    });
  });
  
  scans.exposures?.forEach(e => {
    e.exposure.riskFactors.forEach(r => recommendations.add(r));
  });
  
  return Array.from(recommendations).slice(0, 20);
}

// Generate HTML report
function generateHTMLReport(report: FullScanReport): string {
  const riskColors: Record<RiskLevel, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };

  const githubSection = report.scans.github?.length ? `
    <div class="section">
      <h2>🔍 GitHub Repository Analysis</h2>
      ${report.scans.github.map(g => `
        <div class="finding">
          <div class="finding-header">
            <span class="finding-title">${g.owner}/${g.name}</span>
            <span class="severity-badge severity-${g.analysis.riskLevel}">${g.analysis.riskLevel.toUpperCase()}</span>
          </div>
          <p>Stars: ${g.analysis.popularity.stars} | Forks: ${g.analysis.popularity.forks} | Last commit: ${g.analysis.age.daysSinceLastCommit} days ago</p>
          <p><strong>Issues:</strong></p>
          <ul>
            ${g.analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  ` : '';

  const cveSection = report.scans.cve?.length ? `
    <div class="section">
      <h2>🛡️ CVE Vulnerabilities</h2>
      ${report.scans.cve.flatMap(c => c.vulnerabilities.slice(0, 10).map(v => `
        <div class="finding">
          <div class="finding-header">
            <span class="finding-title">${v.id}</span>
            <span class="severity-badge severity-${v.severity.toLowerCase()}">${v.severity} ${v.cvssScore ? `(${v.cvssScore})` : ''}</span>
          </div>
          <p>${v.description.slice(0, 200)}${v.description.length > 200 ? '...' : ''}</p>
          ${v.affectedProducts.length ? `<p><small>Affects: ${v.affectedProducts.slice(0, 3).join(', ')}</small></p>` : ''}
        </div>
      `)).join('')}
    </div>
  ` : '';

  const exposureSection = report.scans.exposures?.length ? `
    <div class="section">
      <h2>🌐 Infrastructure Exposures</h2>
      ${report.scans.exposures.map(e => `
        <div class="finding">
          <div class="finding-header">
            <span class="finding-title">${e.target}</span>
            <span class="severity-badge severity-${e.exposure.riskLevel}">${e.exposure.riskLevel.toUpperCase()}</span>
          </div>
          ${e.exposure.riskFactors.length ? `
            <ul>
              ${e.exposure.riskFactors.map(r => `<li>${r}</li>`).join('')}
            </ul>
          ` : '<p>No significant exposures detected.</p>'}
        </div>
      `).join('')}
    </div>
  ` : '';

  const newsSection = report.scans.news?.length ? `
    <div class="section">
      <h2>📰 Related Security News</h2>
      ${report.scans.news.flatMap(n => n.articles.slice(0, 5).map(a => `
        <div class="finding">
          <div class="finding-header">
            <span class="finding-title">${a.title}</span>
            <span class="severity-badge severity-medium">${a.source}</span>
          </div>
          <p>${a.snippet}</p>
          <p><small><a href="${a.url}" target="_blank">Read more →</a></small></p>
        </div>
      `)).join('')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Security Report - ${report.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
    h1 { font-size: 28px; margin: 10px 0; }
    .date { color: #6b7280; font-size: 14px; }
    
    .summary {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .summary h2 { font-size: 18px; margin-bottom: 16px; }
    .risk-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 18px;
      text-transform: uppercase;
      color: white;
      background: ${riskColors[report.summary.overallRisk]};
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 20px;
    }
    .metric {
      text-align: center;
      padding: 16px;
      background: white;
      border-radius: 8px;
    }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .metric.critical .metric-value { color: ${riskColors.critical}; }
    .metric.high .metric-value { color: ${riskColors.high}; }
    .metric.medium .metric-value { color: ${riskColors.medium}; }
    .metric.low .metric-value { color: ${riskColors.low}; }
    
    .section { margin-bottom: 32px; }
    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .finding {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .finding-title { font-weight: 600; }
    .finding ul { margin-left: 20px; margin-top: 8px; }
    .finding li { margin-bottom: 4px; }
    .severity-badge {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
    .severity-critical { background: #fef2f2; color: ${riskColors.critical}; }
    .severity-high { background: #fff7ed; color: ${riskColors.high}; }
    .severity-medium { background: #fefce8; color: ${riskColors.medium}; }
    .severity-low { background: #f0fdf4; color: ${riskColors.low}; }
    
    .recommendations {
      background: #eff6ff;
      border-radius: 8px;
      padding: 20px;
    }
    .recommendations h3 { color: #1d4ed8; margin-bottom: 12px; }
    .recommendations ul { margin-left: 20px; }
    .recommendations li { margin-bottom: 8px; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    a { color: #2563eb; }
    
    @media print {
      body { padding: 20px; }
      .finding { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🛡️ PubGuard</div>
    <h1>${report.title}</h1>
    <div class="date">Generated: ${new Date(report.generatedAt).toLocaleString()}</div>
  </div>

  <div class="summary">
    <h2>Executive Summary</h2>
    <p>Overall Risk Level: <span class="risk-badge">${report.summary.overallRisk}</span></p>
    <p style="margin-top: 8px;">Risk Score: ${report.summary.overallScore}/100</p>
    
    <div class="metrics">
      <div class="metric critical">
        <div class="metric-value">${report.summary.criticalFindings}</div>
        <div class="metric-label">Critical</div>
      </div>
      <div class="metric high">
        <div class="metric-value">${report.summary.highFindings}</div>
        <div class="metric-label">High</div>
      </div>
      <div class="metric medium">
        <div class="metric-value">${report.summary.mediumFindings}</div>
        <div class="metric-label">Medium</div>
      </div>
      <div class="metric low">
        <div class="metric-value">${report.summary.lowFindings}</div>
        <div class="metric-label">Low</div>
      </div>
    </div>
  </div>

  ${githubSection}
  ${cveSection}
  ${exposureSection}
  ${newsSection}

  ${report.recommendations.length ? `
  <div class="recommendations">
    <h3>🎯 Key Recommendations</h3>
    <ul>
      ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="footer">
    <p>Report generated by PubGuard Security Scanner</p>
    <p>This report is for informational purposes only.</p>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title = 'Security Assessment Report',
      scanIds,        // Array of scan IDs to include
      agentId,        // Or fetch all scans for an agent
      format = 'html' // 'html' or 'json'
    } = body;

    if (!scanIds && !agentId) {
      return NextResponse.json(
        { error: 'Either scanIds or agentId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch scans
    let query = supabase.from('pubguard_scans').select('*');
    
    if (scanIds?.length) {
      query = query.in('id', scanIds);
    } else if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: scanRows, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Organize scans by type
    const scans: FullScanReport['scans'] = {
      github: [],
      cve: [],
      news: [],
      exposures: [],
    };

    (scanRows || []).forEach(row => {
      const result = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
      
      switch (row.type) {
        case 'github':
          scans.github!.push(result);
          break;
        case 'cve':
          scans.cve!.push(result);
          break;
        case 'news':
          scans.news!.push(result);
          break;
        case 'exposure':
          scans.exposures!.push(result);
          break;
      }
    });

    // Calculate summary
    const { level, score } = calculateOverallRisk(scans);
    const counts = countFindings(scans);
    const recommendations = aggregateRecommendations(scans);

    const report: FullScanReport = {
      id: `report_${Date.now()}`,
      title,
      generatedAt: new Date().toISOString(),
      summary: {
        overallRisk: level,
        overallScore: score,
        criticalFindings: counts.critical,
        highFindings: counts.high,
        mediumFindings: counts.medium,
        lowFindings: counts.low,
      },
      scans,
      recommendations,
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    // Return HTML
    const html = generateHTMLReport(report);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${report.id}.html"`,
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');
  const scanIds = request.nextUrl.searchParams.get('scanIds')?.split(',');
  const format = request.nextUrl.searchParams.get('format') || 'html';
  const title = request.nextUrl.searchParams.get('title');

  if (!scanIds && !agentId) {
    return NextResponse.json(
      { error: 'Either scanIds or agentId parameter is required' },
      { status: 400 }
    );
  }

  const fakeRequest = {
    json: async () => ({ title, scanIds, agentId, format }),
  } as NextRequest;

  return POST(fakeRequest);
}
