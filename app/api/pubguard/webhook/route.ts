// app/api/pubguard/webhook/route.ts
// ElevenLabs ConvAI webhook handler for PubGuard voice agent

import { NextRequest, NextResponse } from 'next/server';

// Types for ElevenLabs webhook payloads
interface ElevenLabsWebhookPayload {
  type: 'tool_call' | 'conversation_started' | 'conversation_ended' | 'message';
  conversation_id: string;
  agent_id: string;
  tool_call?: {
    tool_name: string;
    parameters: Record<string, any>;
  };
  message?: {
    role: 'user' | 'assistant';
    content: string;
  };
}

// Internal API base URL
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Execute a scan based on tool call
async function executeScan(
  toolName: string, 
  params: Record<string, any>,
  conversationId: string,
  agentId: string
): Promise<any> {
  let endpoint: string;
  let body: Record<string, any>;

  switch (toolName) {
    case 'scan_github_repo':
    case 'analyze_repository':
      endpoint = '/api/pubguard/scan/github';
      body = { url: params.url || params.repo_url };
      break;

    case 'check_cve':
    case 'search_vulnerabilities':
      endpoint = '/api/pubguard/scan/cve';
      body = {
        query: params.query,
        cveId: params.cve_id,
        product: params.product,
        vendor: params.vendor,
      };
      break;

    case 'search_security_news':
    case 'check_news':
      endpoint = '/api/pubguard/scan/news';
      body = {
        query: params.query,
        product: params.product,
      };
      break;

    case 'scan_infrastructure':
    case 'check_exposures':
      endpoint = '/api/pubguard/scan/exposures';
      body = { target: params.target || params.domain || params.url };
      break;

    case 'generate_report':
      endpoint = '/api/pubguard/report/generate';
      body = {
        agentId,
        title: params.title || 'Security Assessment',
        format: 'json',
      };
      break;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  // Execute the scan
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Scan failed: ${response.status}`);
  }

  const result = await response.json();

  // Save the scan result (except for reports)
  if (toolName !== 'generate_report') {
    const scanType = toolName.includes('github') ? 'github'
      : toolName.includes('cve') || toolName.includes('vulnerabilities') ? 'cve'
      : toolName.includes('news') ? 'news'
      : 'exposure';

    await fetch(`${API_BASE}/api/pubguard/scan/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: scanType,
        target: body.url || body.query || body.target || 'unknown',
        result,
        agentId,
        conversationId,
      }),
    });
  }

  return result;
}

// Format scan result for voice response
function formatForVoice(toolName: string, result: any): string {
  switch (toolName) {
    case 'scan_github_repo':
    case 'analyze_repository':
      const gh = result;
      return `I've analyzed the ${gh.name} repository by ${gh.owner}. ` +
        `The overall risk level is ${gh.analysis.riskLevel}. ` +
        `It has ${gh.analysis.popularity.stars} stars and was last updated ${gh.analysis.age.daysSinceLastCommit} days ago. ` +
        (gh.analysis.recommendations.length > 0 
          ? `Key concerns: ${gh.analysis.recommendations.slice(0, 2).join('. ')}.`
          : 'No major concerns identified.');

    case 'check_cve':
    case 'search_vulnerabilities':
      const cve = result;
      if (cve.vulnerabilities.length === 0) {
        return `No vulnerabilities found for ${cve.query}.`;
      }
      const critical = cve.vulnerabilities.filter((v: any) => v.severity === 'CRITICAL').length;
      const high = cve.vulnerabilities.filter((v: any) => v.severity === 'HIGH').length;
      return `Found ${cve.totalResults} vulnerabilities for ${cve.query}. ` +
        `${critical} are critical severity and ${high} are high severity. ` +
        (cve.vulnerabilities[0] 
          ? `The most severe is ${cve.vulnerabilities[0].id}: ${cve.vulnerabilities[0].description.slice(0, 100)}.`
          : '');

    case 'search_security_news':
    case 'check_news':
      const news = result;
      if (news.articles.length === 0) {
        return `No recent security news found for ${news.query}.`;
      }
      return `Found ${news.totalFound} relevant security articles. ` +
        `The most relevant: "${news.articles[0].title}" from ${news.articles[0].source}.`;

    case 'scan_infrastructure':
    case 'check_exposures':
      const exp = result;
      return `Infrastructure scan for ${exp.target} complete. ` +
        `Risk level: ${exp.exposure.riskLevel}. ` +
        (exp.exposure.riskFactors.length > 0
          ? `Issues found: ${exp.exposure.riskFactors.slice(0, 2).join('. ')}.`
          : 'No significant exposures detected.');

    case 'generate_report':
      return `I've generated your security report. ` +
        `Overall risk level is ${result.summary.overallRisk} with a score of ${result.summary.overallScore} out of 100. ` +
        `Found ${result.summary.criticalFindings} critical and ${result.summary.highFindings} high severity issues.`;

    default:
      return 'Scan complete.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: ElevenLabsWebhookPayload = await request.json();

    console.log('PubGuard webhook received:', payload.type);

    // Handle different event types
    switch (payload.type) {
      case 'tool_call':
        if (!payload.tool_call) {
          return NextResponse.json({ error: 'Missing tool_call data' }, { status: 400 });
        }

        try {
          const result = await executeScan(
            payload.tool_call.tool_name,
            payload.tool_call.parameters,
            payload.conversation_id,
            payload.agent_id
          );

          const voiceResponse = formatForVoice(payload.tool_call.tool_name, result);

          return NextResponse.json({
            success: true,
            result,
            voice_response: voiceResponse,
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
            voice_response: 'I encountered an error while executing that scan. Please try again.',
          });
        }

      case 'conversation_started':
        console.log(`PubGuard conversation started: ${payload.conversation_id}`);
        return NextResponse.json({ success: true });

      case 'conversation_ended':
        console.log(`PubGuard conversation ended: ${payload.conversation_id}`);
        // Could trigger report generation here
        return NextResponse.json({ success: true });

      case 'message':
        // Log messages for debugging
        console.log(`Message (${payload.message?.role}): ${payload.message?.content?.slice(0, 100)}`);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Verify webhook is accessible
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'PubGuard Security Scanner',
    endpoints: {
      github: '/api/pubguard/scan/github',
      cve: '/api/pubguard/scan/cve',
      news: '/api/pubguard/scan/news',
      exposures: '/api/pubguard/scan/exposures',
      save: '/api/pubguard/scan/save',
      report: '/api/pubguard/report/generate',
    },
    tools: [
      'scan_github_repo',
      'check_cve',
      'search_security_news',
      'scan_infrastructure',
      'generate_report',
    ],
  });
}
