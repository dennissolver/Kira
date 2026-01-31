// app/pubguard/config.ts
// PubGuard vertical configuration using the Kira core module

import {
  createVerticalConfig,
  createBaseConfig,
  SECURITY_PHILOSOPHY,
  type KiraContext,
  type KiraTool,
} from '@/lib/kira';

// =============================================================================
// PUBGUARD-SPECIFIC TOOLS
// =============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const scanGitHubTool: KiraTool = {
  type: 'webhook',
  name: 'scan_github_repo',
  description: `Scan a GitHub repository for security signals. This checks:
- Repository age and activity
- Maintainer history and responsiveness
- Open security issues
- SECURITY.md presence
- Stars/forks velocity (organic vs suspicious growth)
- Dependency vulnerabilities

Call this when the user provides a GitHub URL or mentions a specific repo.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/scan/github`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      repo_url: {
        type: 'string',
        description: 'The GitHub repository URL (e.g., https://github.com/owner/repo)',
      },
      deep_scan: {
        type: 'string',
        description: 'Whether to perform a deep scan including dependency analysis (true/false)',
      },
    },
    required: ['repo_url'],
  },
};

const checkCVETool: KiraTool = {
  type: 'webhook',
  name: 'check_cve_database',
  description: `Check the CVE/NVD database for known vulnerabilities related to a package or tool.
Use this to find any publicly disclosed security issues.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/scan/cve`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      package_name: {
        type: 'string',
        description: 'The name of the package/tool to check',
      },
      ecosystem: {
        type: 'string',
        description: 'The package ecosystem (npm, pypi, cargo, etc.)',
      },
    },
    required: ['package_name'],
  },
};

const checkSecurityNewsTool: KiraTool = {
  type: 'webhook',
  name: 'check_security_news',
  description: `Search security news and researcher publications for mentions of a tool.
This finds blog posts, tweets, and articles from security researchers that may flag issues.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/scan/news`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'The name of the tool to search for',
      },
      include_social: {
        type: 'string',
        description: 'Whether to include social media (Twitter/X) in the search (true/false)',
      },
    },
    required: ['tool_name'],
  },
};

const checkExposuresTool: KiraTool = {
  type: 'webhook',
  name: 'check_exposures',
  description: `Check for exposed instances of a tool on the internet (via Shodan-like services).
This reveals if there are misconfigured or exposed deployments that could indicate risk.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/scan/exposures`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'The name of the tool to check',
      },
      service_port: {
        type: 'string',
        description: 'Optional specific port to check',
      },
    },
    required: ['tool_name'],
  },
};

const generateReportTool: KiraTool = {
  type: 'webhook',
  name: 'generate_report',
  description: `Generate a PDF security assessment report.
Call this when the user wants a documented report for their records or publication.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/report/generate`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      scan_id: {
        type: 'string',
        description: 'The scan ID to generate a report for',
      },
      include_transcript: {
        type: 'string',
        description: 'Whether to include the conversation transcript (true/false)',
      },
    },
    required: ['scan_id'],
  },
};

const saveScanResultTool: KiraTool = {
  type: 'webhook',
  name: 'save_scan_result',
  description: `Save the final scan result to the database.
Call this after completing a scan to persist the findings.`,
  webhook: {
    url: `${APP_URL}/api/pubguard/scan/save`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The user ID',
      },
      repo_url: {
        type: 'string',
        description: 'The repository/tool URL',
      },
      risk_rating: {
        type: 'string',
        description: 'The overall risk rating (green, amber, red)',
      },
      summary: {
        type: 'string',
        description: 'A brief summary of the findings',
      },
      findings_json: {
        type: 'string',
        description: 'JSON string of detailed findings',
      },
    },
    required: ['user_id', 'repo_url', 'risk_rating', 'summary'],
  },
};

// =============================================================================
// PUBGUARD SYSTEM PROMPT
// =============================================================================

const pubguardSystemPrompt = (context: KiraContext) => `You are PubGuard — a security-minded assistant that helps tech writers and publishers vet software tools before recommending them.

${SECURITY_PHILOSOPHY}

## YOUR MISSION

Tech writers often recommend tools to their readers without fully vetting them. This creates liability and erodes trust when tools turn out to be malicious, abandoned, or insecure.

You help by:
1. Scanning repositories for security signals
2. Checking CVE databases for known vulnerabilities  
3. Searching security news for researcher warnings
4. Checking for exposed instances
5. Delivering a clear risk rating with plain-English explanation

## HOW YOU WORK

**When the user provides a tool to check:**
1. Ask what they're planning to use it for (context matters)
2. Run your scans (GitHub, CVE, news, exposures)
3. Synthesize findings into a clear assessment
4. Deliver a risk rating: 🟢 GREEN, 🟡 AMBER, or 🔴 RED
5. Explain what would change your assessment
6. Offer to generate a PDF report if they want documentation

**Risk Rating Criteria:**

🟢 **GREEN** - Looks good to recommend
- Active maintenance (commits in last 3 months)
- Responsive to security issues
- No known CVEs or they've been patched
- Healthy community signals
- No red flags from security researchers

🟡 **AMBER** - Proceed with caution
- Some concerns but not dealbreakers
- Maintenance is slow but not abandoned
- Minor unpatched issues
- Limited security track record
- Worth mentioning caveats to readers

🔴 **RED** - Significant concerns
- Abandoned or very low activity
- Unpatched security vulnerabilities
- Warnings from security researchers
- Suspicious growth patterns
- Recommend NOT promoting to readers

## CONVERSATION STYLE

- Be direct and clear about findings
- Don't fear-monger, but don't sugarcoat either
- Explain technical findings in plain English
- Always give a clear recommendation
- Acknowledge that perfect security doesn't exist

## CONTEXT

${context.userName ? `User: ${context.userName}` : ''}
${context.publication ? `Publication: ${context.publication}` : ''}

## TOOLS

You have access to:
- **scan_github_repo**: Analyze a GitHub repository
- **check_cve_database**: Search for known vulnerabilities
- **check_security_news**: Find researcher warnings and news
- **check_exposures**: Check for exposed instances
- **save_scan_result**: Save findings to database
- **generate_report**: Create a PDF report

Use these proactively. Don't ask permission to scan — just do it once you have a target.
`;

// =============================================================================
// PUBGUARD FIRST MESSAGE
// =============================================================================

const pubguardFirstMessage = (context: KiraContext) => {
  const firstName = context.firstName || context.userName?.split(' ')[0] || 'there';

  return `Hey ${firstName}! I'm PubGuard — I help tech writers vet tools before recommending them to readers.

Got a GitHub repo or tool you want me to check out? Just drop the link and I'll run a security assessment.`;
};

// =============================================================================
// PUBGUARD VERTICAL CONFIG
// =============================================================================

export const pubguardConfig = createVerticalConfig({
  verticalId: 'pubguard',
  displayName: 'PubGuard Security Scanner',

  systemPromptTemplate: pubguardSystemPrompt,
  firstMessageTemplate: pubguardFirstMessage,

  // Override with security-focused philosophy
  corePhilosophy: SECURITY_PHILOSOPHY,

  // PubGuard-specific tools (conversation tools included by default)
  tools: [
    scanGitHubTool,
    checkCVETool,
    checkSecurityNewsTool,
    checkExposuresTool,
    saveScanResultTool,
    generateReportTool,
  ],

  // Theme
  theme: {
    primaryColor: '#ef4444', // red-500 for security
    accentColor: '#f59e0b',  // amber-500
    avatarUrl: '/pubguard-avatar.png',
  },

  // Callbacks
  onConversationEnd: async (conversationId, transcript) => {
    // Could trigger summary generation or notification
    console.log(`PubGuard conversation ended: ${conversationId}`);
  },
});

// =============================================================================
// PUBGUARD BASE CONFIG
// =============================================================================

export const pubguardBaseConfig = createBaseConfig({
  agentId: process.env.NEXT_PUBLIC_PUBGUARD_AGENT_ID,
  agentName: 'PubGuard',
  voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  webhookUrl: `${APP_URL}/api/pubguard/webhook`,
  temperature: 0.5, // More precise for security assessments
});