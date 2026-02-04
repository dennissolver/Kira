// app/api/pubguard/webhook/route.ts
// ElevenLabs ConvAI webhook handler for PubGuard voice agent
// User-type-aware responses for: writer | developer | user | analyst
// FIXED: Now passes userId and sessionId through to scan endpoints

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

type UserType = 'writer' | 'developer' | 'user' | 'analyst';

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
  // Custom data passed from the client
  custom_data?: {
    userType?: UserType;
    userId?: string;
    sessionId?: string;
  };
}

// ============================================================================
// USER TYPE CONFIGURATION FOR VOICE RESPONSES
// ============================================================================

const USER_TYPE_VOICE_CONFIG: Record<UserType, {
  greeting: string;
  focusAreas: string[];
  terminology: 'simple' | 'technical' | 'balanced';
  emphasize: string[];
  deemphasize: string[];
}> = {
  writer: {
    greeting: "Hi! I'm Kira, your security research assistant. I'll help you vet this tool so you can write about it responsibly. Let me check if it's safe to recommend to your readers.",
    focusAreas: ['liability risk', 'reader safety', 'disclosure requirements', 'reputation risk'],
    terminology: 'balanced',
    emphasize: ['what to disclose', 'can you recommend', 'reader impact', 'viral growth concerns'],
    deemphasize: ['technical CVE details', 'code-level fixes', 'CVSS scores'],
  },
  developer: {
    greeting: "Hey! I'm Kira, your security analyst. Let me audit this codebase and give you actionable fixes before you ship. I'll focus on what you need to patch.",
    focusAreas: ['vulnerabilities to fix', 'security best practices', 'dependency issues', 'config problems'],
    terminology: 'technical',
    emphasize: ['how to fix', 'security checklist', 'CI/CD integration', 'dependency updates'],
    deemphasize: ['liability concerns', 'writer disclaimers', 'reader safety'],
  },
  user: {
    greeting: "Hi there! I'm Kira. I'll help you figure out if this software is safe to install. I'll explain any risks in plain English so you can make an informed decision.",
    focusAreas: ['is it safe', 'what permissions it needs', 'privacy concerns', 'trusted or not'],
    terminology: 'simple',
    emphasize: ['safe to install', 'what it accesses', 'privacy', 'trust indicators'],
    deemphasize: ['CVE IDs', 'technical vulnerabilities', 'code-level details', 'CVSS scores'],
  },
  analyst: {
    greeting: "Kira here, ready for a full security assessment. I'll give you the technical details - CVEs, attack surface, exposure data, and IOCs. Let's dive in.",
    focusAreas: ['CVE details', 'attack vectors', 'exposure analysis', 'IOCs', 'CVSS scores'],
    terminology: 'technical',
    emphasize: ['CVE IDs', 'CVSS scores', 'attack surface', 'IOCs', 'technical mitigations'],
    deemphasize: ['simplified explanations', 'writer guidance', 'basic safety tips'],
  },
};

// ============================================================================
// CONVERSATION STATE (in-memory, replace with Redis/DB for production)
// ============================================================================

const conversationState = new Map<string, {
  userType: UserType;
  userId?: string;
  sessionId?: string;
  scanResults: any[];
  startedAt: string;
}>();

// ============================================================================
// API CONFIGURATION
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================================================
// SCAN EXECUTION - FIXED: Now accepts and passes userId/sessionId
// ============================================================================

async function executeScan(
  toolName: string,
  params: Record<string, any>,
  conversationId: string,
  agentId: string,
  userType: UserType,
  userId?: string,
  sessionId?: string
): Promise<any> {
  let endpoint: string;
  let body: Record<string, any>;

  switch (toolName) {
    case 'scan_github_repo':
    case 'analyze_repository':
    case 'full_security_scan':
      // Use v2 scan endpoint with userType and userId
      endpoint = '/api/pubguard/v2/scan';
      body = {
        url: params.url || params.repo_url,
        userType,
        sessionId: sessionId || conversationId,
        userId,
        agentId,
        conversationId,
      };
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
        conversationId,
        userType,
        userId,
        title: params.title || 'Security Assessment',
        format: 'json',
      };
      break;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

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

  // Store scan result in conversation state
  const state = conversationState.get(conversationId);
  if (state) {
    state.scanResults.push({ toolName, result, timestamp: new Date().toISOString() });
  }

  return result;
}

// ============================================================================
// USER-TYPE-AWARE VOICE FORMATTING
// ============================================================================

function formatForVoice(toolName: string, result: any, userType: UserType): string {
  const config = USER_TYPE_VOICE_CONFIG[userType];

  // Full scan response (v2)
  if (toolName === 'scan_github_repo' || toolName === 'analyze_repository' || toolName === 'full_security_scan') {
    return formatFullScanForVoice(result, userType, config);
  }

  // CVE response
  if (toolName === 'check_cve' || toolName === 'search_vulnerabilities') {
    return formatCveForVoice(result, userType, config);
  }

  // News response
  if (toolName === 'search_security_news' || toolName === 'check_news') {
    return formatNewsForVoice(result, userType, config);
  }

  // Infrastructure/exposure response
  if (toolName === 'scan_infrastructure' || toolName === 'check_exposures') {
    return formatExposureForVoice(result, userType, config);
  }

  // Report generation
  if (toolName === 'generate_report') {
    return formatReportForVoice(result, userType, config);
  }

  return 'Scan complete.';
}

function formatFullScanForVoice(result: any, userType: UserType, config: typeof USER_TYPE_VOICE_CONFIG.writer): string {
  const trafficLight = result.trafficLight || 'amber';
  const score = result.overallRiskScore || 50;
  const name = result.target?.name || 'this repository';

  let response = '';

  switch (userType) {
    case 'writer':
      if (trafficLight === 'green') {
        response = `Good news! ${name} gets a green light with a risk score of ${score} out of 100. `;
        response += `You can recommend this to your readers, but I'd suggest mentioning `;
        if (result.writerGuidance?.mustDisclose?.length > 0) {
          response += `these points: ${result.writerGuidance.mustDisclose.slice(0, 2).join(', and ')}. `;
        } else {
          response += `that users should still download from official sources. `;
        }
      } else if (trafficLight === 'amber') {
        response = `Caution flag on ${name}. Risk score is ${score} out of 100. `;
        response += `You can write about it, but you must disclose the risks to protect yourself and your readers. `;
        if (result.writerGuidance?.mustDisclose?.length > 0) {
          response += `Key disclosures: ${result.writerGuidance.mustDisclose.slice(0, 2).join(', and ')}. `;
        }
        response += `I've prepared a disclaimer you can copy. `;
      } else {
        response = `Red flag on ${name}. Risk score is ${score} out of 100. `;
        response += `I'd recommend not featuring this in your publication. The liability risk is too high. `;
        const criticalCount = result.findings?.critical?.length || 0;
        if (criticalCount > 0) {
          response += `There are ${criticalCount} critical security issues. `;
        }
      }
      break;

    case 'developer':
      response = `Security audit complete for ${name}. Risk score: ${score} out of 100, rated ${trafficLight}. `;
      const criticals = result.findings?.critical?.length || 0;
      const highs = result.findings?.high?.length || 0;
      if (criticals > 0 || highs > 0) {
        response += `Found ${criticals} critical and ${highs} high severity issues that need fixing before release. `;
        if (result.findings?.critical?.[0]) {
          response += `Top priority: ${result.findings.critical[0].title}. `;
        }
      } else {
        response += `No critical issues found. `;
      }
      if (!result.github?.hasSecurityPolicy) {
        response += `You're missing a SECURITY.md file - I'd add that for responsible disclosure. `;
      }
      break;

    case 'user':
      if (trafficLight === 'green') {
        response = `This software looks safe to install! Risk score is ${score} out of 100. `;
        response += `Just make sure you download it from the official source. `;
      } else if (trafficLight === 'amber') {
        response = `This software has some risks. Score is ${score} out of 100. `;
        if (result.github?.permissions?.shellAccess) {
          response += `It can run commands on your computer, so only install if you trust the developer. `;
        }
        if (result.github?.permissions?.credentialStorage) {
          response += `It stores passwords or API keys, so check how it protects them. `;
        }
        response += `It's probably okay if you're careful, but read the warnings. `;
      } else {
        response = `I'd be careful with this one. Risk score is ${score} out of 100. `;
        response += `There are some serious security concerns. Consider finding an alternative. `;
      }
      break;

    case 'analyst':
      response = `Assessment complete for ${name}. Traffic light: ${trafficLight}. Overall risk score: ${score} out of 100. `;
      response += `Breaking down the risk categories: `;
      if (result.riskCategories?.length > 0) {
        const topRisks = result.riskCategories
          .filter((c: any) => c.score >= 50)
          .slice(0, 2);
        if (topRisks.length > 0) {
          response += topRisks.map((c: any) => `${c.name} at ${c.score}`).join(', ') + '. ';
        }
      }
      const cveCount = result.cve?.totalFound || 0;
      response += `CVE database returned ${cveCount} known vulnerabilities. `;
      const findings = result.findings;
      if (findings) {
        response += `Findings breakdown: ${findings.critical?.length || 0} critical, ${findings.high?.length || 0} high, ${findings.medium?.length || 0} medium. `;
      }
      response += `Full technical data is available in the JSON export. `;
      break;
  }

  return response;
}

function formatCveForVoice(result: any, userType: UserType, config: typeof USER_TYPE_VOICE_CONFIG.writer): string {
  const count = result.vulnerabilities?.length || 0;
  const query = result.query || 'the target';

  if (count === 0) {
    if (userType === 'analyst') {
      return `NVD database query for ${query} returned zero CVEs. Clean from a known vulnerability standpoint.`;
    }
    return `No known vulnerabilities found for ${query}. That's a good sign.`;
  }

  const critical = result.vulnerabilities?.filter((v: any) => v.severity === 'CRITICAL').length || 0;
  const high = result.vulnerabilities?.filter((v: any) => v.severity === 'HIGH').length || 0;

  switch (userType) {
    case 'analyst':
      let response = `CVE query returned ${count} results. ${critical} critical, ${high} high severity. `;
      if (result.vulnerabilities?.[0]) {
        const cve = result.vulnerabilities[0];
        response += `Most severe: ${cve.id}, CVSS ${cve.cvssScore || 'N/A'}. ${cve.description?.slice(0, 80)}. `;
      }
      return response;

    case 'developer':
      return `Found ${count} CVEs. ${critical} critical and ${high} high need patching. ` +
        `Check if your dependencies are up to date.`;

    case 'writer':
      if (critical > 0) {
        return `Warning: ${critical} critical vulnerabilities found. This is a major disclosure item if you write about this tool.`;
      }
      return `Found ${count} vulnerabilities, ${high} are high severity. Worth mentioning in your article.`;

    case 'user':
      if (critical > 0) {
        return `Heads up - there are ${critical} serious security flaws in this software. Be careful.`;
      }
      return count > 5
        ? `There are some known security issues. Make sure you have the latest version.`
        : `A few minor issues were found, but nothing too serious.`;

    default:
      return `Found ${count} vulnerabilities.`;
  }
}

function formatNewsForVoice(result: any, userType: UserType, config: typeof USER_TYPE_VOICE_CONFIG.writer): string {
  const count = result.articles?.length || 0;
  const query = result.query || 'the target';

  if (count === 0) {
    return `No recent security news found about ${query}.`;
  }

  const warnings = result.articles?.filter((a: any) => a.isSecurityWarning) || [];

  switch (userType) {
    case 'writer':
      if (warnings.length > 0) {
        return `Alert: Found ${warnings.length} security warnings in the news. ` +
          `"${warnings[0].title}" from ${warnings[0].source}. You'll want to address this in your coverage.`;
      }
      return `Found ${count} news articles. No major security warnings, but I'd still mention the media coverage.`;

    case 'analyst':
      return `News scan returned ${count} articles, ${warnings.length} flagged as security warnings. ` +
        `Sources include: ${result.articles?.slice(0, 3).map((a: any) => a.source).join(', ')}.`;

    case 'developer':
      if (warnings.length > 0) {
        return `${warnings.length} security warnings in the news about this project. ` +
          `Check if these issues have been addressed.`;
      }
      return `${count} articles found, no major security concerns in the coverage.`;

    case 'user':
      if (warnings.length > 0) {
        return `There's been some negative security news about this software. ` +
          `You might want to wait until the issues are resolved.`;
      }
      return `The news coverage looks normal, no red flags.`;

    default:
      return `Found ${count} news articles.`;
  }
}

function formatExposureForVoice(result: any, userType: UserType, config: typeof USER_TYPE_VOICE_CONFIG.writer): string {
  const riskLevel = result.exposure?.riskLevel || 'unknown';
  const target = result.target || 'the target';

  switch (userType) {
    case 'analyst':
      return `Shodan scan for ${target}: Risk level ${riskLevel}. ` +
        `${result.exposure?.exposedPorts?.length || 0} exposed ports. ` +
        `${result.exposure?.riskFactors?.slice(0, 2).join('. ') || 'No major exposures'}.`;

    case 'developer':
      if (riskLevel === 'high' || riskLevel === 'critical') {
        return `Your infrastructure has exposed services! Risk level: ${riskLevel}. ` +
          `Check these issues: ${result.exposure?.riskFactors?.slice(0, 2).join(', ')}.`;
      }
      return `Infrastructure scan looks okay. Risk level: ${riskLevel}.`;

    case 'writer':
      if (riskLevel === 'high' || riskLevel === 'critical') {
        return `Found exposed infrastructure - this is a disclosure item. ` +
          `The tool's servers have security gaps.`;
      }
      return `Infrastructure check passed, no major exposures.`;

    case 'user':
      if (riskLevel === 'high' || riskLevel === 'critical') {
        return `The company's servers have some security issues. ` +
          `Your data might not be as protected as it should be.`;
      }
      return `Their servers look reasonably secure.`;

    default:
      return `Exposure scan complete. Risk level: ${riskLevel}.`;
  }
}

function formatReportForVoice(result: any, userType: UserType, config: typeof USER_TYPE_VOICE_CONFIG.writer): string {
  const overallRisk = result.summary?.overallRisk || 'unknown';
  const score = result.summary?.overallScore || 50;

  switch (userType) {
    case 'writer':
      return `Your PubGuard report is ready. Overall verdict: ${overallRisk}. ` +
        `It includes your disclosure checklist and a copy-paste disclaimer. ` +
        `You can download it as a PDF for your records.`;

    case 'developer':
      return `Security report generated. Risk score: ${score} out of 100. ` +
        `It includes your action items and security checklist. ` +
        `Share this with your team before release.`;

    case 'user':
      return `Your safety report is ready. The verdict is: ${overallRisk}. ` +
        `It explains everything in plain English.`;

    case 'analyst':
      return `Full assessment report generated. Overall risk: ${overallRisk}, score ${score}. ` +
        `Includes IOCs, CVE details, and technical findings. ` +
        `JSON export available for integration.`;

    default:
      return `Report generated. Overall risk: ${overallRisk}.`;
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const payload: ElevenLabsWebhookPayload = await request.json();

    console.log('PubGuard webhook received:', payload.type, payload.conversation_id);

    // Get or set userType from custom_data or default
    let userType: UserType = 'user';

    // Check URL params (passed via widget configuration)
    const url = new URL(request.url);
    const urlUserType = url.searchParams.get('userType');
    if (urlUserType && ['writer', 'developer', 'user', 'analyst'].includes(urlUserType)) {
      userType = urlUserType as UserType;
    }

    // Check custom_data from payload (passed via signed URL or widget)
    if (payload.custom_data?.userType) {
      userType = payload.custom_data.userType;
    }

    // Handle different event types
    switch (payload.type) {
      case 'conversation_started':
        // Initialize conversation state
        conversationState.set(payload.conversation_id, {
          userType,
          userId: payload.custom_data?.userId,
          sessionId: payload.custom_data?.sessionId,
          scanResults: [],
          startedAt: new Date().toISOString(),
        });

        console.log(`PubGuard conversation started: ${payload.conversation_id} (userType: ${userType}, userId: ${payload.custom_data?.userId || 'anonymous'})`);

        // Return the user-type-specific greeting
        const config = USER_TYPE_VOICE_CONFIG[userType];
        return NextResponse.json({
          success: true,
          greeting: config.greeting,
          userType,
        });

      case 'tool_call':
        if (!payload.tool_call) {
          return NextResponse.json({ error: 'Missing tool_call data' }, { status: 400 });
        }

        // Get userType and userId from conversation state
        const state = conversationState.get(payload.conversation_id);
        if (state) {
          userType = state.userType;
        }

        try {
          // FIXED: Now passes userId and sessionId from conversation state
          const result = await executeScan(
            payload.tool_call.tool_name,
            payload.tool_call.parameters,
            payload.conversation_id,
            payload.agent_id,
            userType,
            state?.userId,
            state?.sessionId
          );

          const voiceResponse = formatForVoice(payload.tool_call.tool_name, result, userType);

          return NextResponse.json({
            success: true,
            result,
            voice_response: voiceResponse,
            userType,
          });
        } catch (error) {
          console.error('Tool execution error:', error);

          // User-type-aware error messages
          const errorMessages: Record<UserType, string> = {
            writer: "I ran into a problem running that scan. Let me try again, or you can try a different repository.",
            developer: "Scan failed - check the logs for details. Want me to retry?",
            user: "Oops, something went wrong. Let's try that again.",
            analyst: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retry or check endpoint status.`,
          };

          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
            voice_response: errorMessages[userType],
          });
        }

      case 'conversation_ended':
        console.log(`PubGuard conversation ended: ${payload.conversation_id}`);

        // Clean up conversation state
        const endedState = conversationState.get(payload.conversation_id);
        if (endedState) {
          console.log(`Session had ${endedState.scanResults.length} scans, userType: ${endedState.userType}, userId: ${endedState.userId || 'anonymous'}`);
        }
        conversationState.delete(payload.conversation_id);

        return NextResponse.json({ success: true });

      case 'message':
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

// ============================================================================
// HEALTH CHECK / INFO ENDPOINT
// ============================================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userType = url.searchParams.get('userType') || 'user';

  return NextResponse.json({
    status: 'ok',
    service: 'PubGuard Security Scanner - Kira Voice Agent',
    version: '2.0',
    userTypes: ['writer', 'developer', 'user', 'analyst'],
    currentUserType: userType,
    greeting: USER_TYPE_VOICE_CONFIG[userType as UserType]?.greeting || USER_TYPE_VOICE_CONFIG.user.greeting,
    endpoints: {
      scan: '/api/pubguard/v2/scan',
      github: '/api/pubguard/scan/github',
      cve: '/api/pubguard/scan/cve',
      news: '/api/pubguard/scan/news',
      exposures: '/api/pubguard/scan/exposures',
      report: '/api/pubguard/report/generate',
    },
    tools: [
      'scan_github_repo',
      'full_security_scan',
      'check_cve',
      'search_security_news',
      'scan_infrastructure',
      'generate_report',
    ],
    activeConversations: conversationState.size,
  });
}