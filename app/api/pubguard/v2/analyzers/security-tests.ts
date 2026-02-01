// app/api/pubguard/v2/analyzers/security-tests.ts
// Automated security tests based on expert methodologies

import type { Finding } from '../types';

export interface SecurityTestResult {
  testName: string;
  category: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  evidence?: string;
  recommendation?: string;
}

export interface SecurityTestsAnalysis {
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  results: SecurityTestResult[];
  findings: Finding[];
  overallRisk: number; // 0-100
}

// =============================================================================
// TEST 1: Credential Storage Analysis
// =============================================================================
async function testCredentialStorage(
  owner: string,
  repo: string,
  readmeContent: string,
  repoFiles?: string[]
): Promise<SecurityTestResult> {
  const insecurePatterns = [
    /api[_-]?key\s*[=:]\s*['"]/i,
    /password\s*[=:]\s*['"]/i,
    /secret\s*[=:]\s*['"]/i,
    /token\s*[=:]\s*['"]/i,
    /\.env\s+file/i,
    /plaintext/i,
    /store.*credentials.*config/i,
    /config\.json.*api/i,
    /hardcoded/i,
  ];

  const securePatterns = [
    /encrypted/i,
    /keychain/i,
    /vault/i,
    /secret.*manager/i,
    /environment.*variable/i,
    /\.env\.example/i,
    /never.*commit.*credentials/i,
  ];

  let insecureCount = 0;
  let secureCount = 0;
  const evidence: string[] = [];

  for (const pattern of insecurePatterns) {
    if (pattern.test(readmeContent)) {
      insecureCount++;
      const match = readmeContent.match(pattern);
      if (match) evidence.push(match[0]);
    }
  }

  for (const pattern of securePatterns) {
    if (pattern.test(readmeContent)) {
      secureCount++;
    }
  }

  // Check for sensitive file patterns in repo
  const sensitiveFiles = [
    'config.json', 'secrets.json', '.env', 'credentials.json',
    'api_keys.txt', 'passwords.txt'
  ];
  
  const hasSensitiveFiles = repoFiles?.some(f => 
    sensitiveFiles.some(sf => f.toLowerCase().includes(sf))
  );

  const passed = insecureCount === 0 && !hasSensitiveFiles;

  return {
    testName: 'Credential Storage Analysis',
    category: 'credentials',
    passed,
    severity: passed ? 'info' : (insecureCount > 2 ? 'critical' : 'high'),
    description: passed 
      ? 'No obvious insecure credential storage patterns detected'
      : `Found ${insecureCount} insecure credential storage patterns`,
    evidence: evidence.length > 0 ? evidence.join(', ') : undefined,
    recommendation: passed ? undefined : 'Use environment variables or a secrets manager instead of config files'
  };
}

// =============================================================================
// TEST 2: Permission Scope Audit
// =============================================================================
async function testPermissionScope(
  readmeContent: string,
  securityMdContent?: string
): Promise<SecurityTestResult> {
  const dangerousPermissions = [
    { pattern: /shell\s*access/i, name: 'Shell Access', severity: 'critical' as const },
    { pattern: /execute.*command/i, name: 'Command Execution', severity: 'critical' as const },
    { pattern: /root\s*(access|required|permission)/i, name: 'Root Access', severity: 'critical' as const },
    { pattern: /sudo/i, name: 'Sudo Usage', severity: 'high' as const },
    { pattern: /file\s*system\s*(access|read|write)/i, name: 'File System Access', severity: 'high' as const },
    { pattern: /full\s*disk\s*access/i, name: 'Full Disk Access', severity: 'critical' as const },
    { pattern: /browser\s*(control|automation)/i, name: 'Browser Control', severity: 'medium' as const },
    { pattern: /keylog/i, name: 'Keylogging', severity: 'critical' as const },
    { pattern: /screen\s*(capture|shot|record)/i, name: 'Screen Capture', severity: 'medium' as const },
    { pattern: /network\s*(access|traffic)/i, name: 'Network Access', severity: 'medium' as const },
    { pattern: /admin(istrator)?\s*(rights|access|permission)/i, name: 'Admin Rights', severity: 'high' as const },
  ];

  const content = `${readmeContent} ${securityMdContent || ''}`;
  const foundPermissions: { name: string; severity: string }[] = [];

  for (const perm of dangerousPermissions) {
    if (perm.pattern.test(content)) {
      foundPermissions.push({ name: perm.name, severity: perm.severity });
    }
  }

  const hasCritical = foundPermissions.some(p => p.severity === 'critical');
  const hasHigh = foundPermissions.some(p => p.severity === 'high');
  const passed = foundPermissions.length === 0;

  return {
    testName: 'Permission Scope Audit',
    category: 'permissions',
    passed,
    severity: hasCritical ? 'critical' : (hasHigh ? 'high' : (passed ? 'info' : 'medium')),
    description: passed
      ? 'No dangerous permission requirements detected'
      : `Requires ${foundPermissions.length} potentially dangerous permissions: ${foundPermissions.map(p => p.name).join(', ')}`,
    evidence: foundPermissions.map(p => `${p.name} (${p.severity})`).join(', ') || undefined,
    recommendation: passed ? undefined : 'Review if all requested permissions are necessary. Apply principle of least privilege.'
  };
}

// =============================================================================
// TEST 3: Prompt Injection Vulnerability Indicators
// =============================================================================
async function testPromptInjectionRisk(
  readmeContent: string
): Promise<SecurityTestResult> {
  const riskIndicators = [
    { pattern: /user\s*input.*directly/i, risk: 'Direct user input processing' },
    { pattern: /no.*sanitiz/i, risk: 'Missing sanitization' },
    { pattern: /trust.*user/i, risk: 'Trusting user input' },
    { pattern: /llm.*tool.*call/i, risk: 'LLM with tool calling' },
    { pattern: /agent.*execute/i, risk: 'Agent execution capabilities' },
    { pattern: /mcp.*server/i, risk: 'MCP server (tool exposure)' },
    { pattern: /function.*call/i, risk: 'Function calling enabled' },
    { pattern: /code.*execution/i, risk: 'Code execution capability' },
  ];

  const mitigations = [
    /input.*validation/i,
    /sanitiz/i,
    /escape.*user/i,
    /injection.*protect/i,
    /guard.*rail/i,
    /content.*filter/i,
  ];

  const risksFound: string[] = [];
  const mitigationsFound: string[] = [];

  for (const indicator of riskIndicators) {
    if (indicator.pattern.test(readmeContent)) {
      risksFound.push(indicator.risk);
    }
  }

  for (const mitigation of mitigations) {
    if (mitigation.test(readmeContent)) {
      mitigationsFound.push(mitigation.source);
    }
  }

  // High risk if has agent capabilities but no mitigations mentioned
  const hasAgentCapabilities = risksFound.length > 0;
  const hasMitigations = mitigationsFound.length > 0;
  const passed = !hasAgentCapabilities || hasMitigations;

  return {
    testName: 'Prompt Injection Risk Assessment',
    category: 'injection',
    passed,
    severity: !passed && risksFound.length > 3 ? 'critical' : (!passed ? 'high' : 'info'),
    description: passed
      ? hasAgentCapabilities 
        ? 'Agent capabilities detected with mitigations in place'
        : 'No significant prompt injection risk indicators'
      : `Found ${risksFound.length} risk indicators with no documented mitigations`,
    evidence: risksFound.length > 0 ? risksFound.join(', ') : undefined,
    recommendation: passed ? undefined : 'Implement input validation, output filtering, and prompt injection guardrails'
  };
}

// =============================================================================
// TEST 4: Supply Chain Security
// =============================================================================
async function testSupplyChainSecurity(
  owner: string,
  repo: string,
  readmeContent: string
): Promise<SecurityTestResult> {
  const supplyChainRisks = [
    { pattern: /plugin.*marketplace/i, risk: 'Plugin marketplace (unvetted code)' },
    { pattern: /skill.*hub/i, risk: 'Skills hub (third-party code)' },
    { pattern: /extension.*store/i, risk: 'Extension store' },
    { pattern: /community.*contributed/i, risk: 'Community contributions' },
    { pattern: /third.*party.*integration/i, risk: 'Third-party integrations' },
    { pattern: /install.*from.*url/i, risk: 'Install from URL' },
    { pattern: /curl.*\|.*sh/i, risk: 'Curl pipe to shell' },
    { pattern: /wget.*\|.*bash/i, risk: 'Wget pipe to bash' },
    { pattern: /npm.*install.*-g/i, risk: 'Global npm install' },
    { pattern: /pip.*install.*--user/i, risk: 'User pip install' },
  ];

  const securityMeasures = [
    /signed/i,
    /verified/i,
    /checksum/i,
    /hash.*verification/i,
    /gpg/i,
    /code.*review.*required/i,
    /audit/i,
  ];

  const risksFound: string[] = [];
  let hasSecurityMeasures = false;

  for (const risk of supplyChainRisks) {
    if (risk.pattern.test(readmeContent)) {
      risksFound.push(risk.risk);
    }
  }

  for (const measure of securityMeasures) {
    if (measure.test(readmeContent)) {
      hasSecurityMeasures = true;
      break;
    }
  }

  const passed = risksFound.length === 0 || hasSecurityMeasures;

  return {
    testName: 'Supply Chain Security',
    category: 'supply-chain',
    passed,
    severity: !passed && risksFound.length > 2 ? 'critical' : (!passed ? 'high' : 'info'),
    description: passed
      ? risksFound.length > 0 
        ? 'Supply chain risks present but security measures documented'
        : 'No significant supply chain risks detected'
      : `Found ${risksFound.length} supply chain risks without documented security measures`,
    evidence: risksFound.length > 0 ? risksFound.join(', ') : undefined,
    recommendation: passed ? undefined : 'Implement code signing, checksums, and review processes for third-party code'
  };
}

// =============================================================================
// TEST 5: Configuration Security Defaults
// =============================================================================
async function testConfigurationDefaults(
  readmeContent: string
): Promise<SecurityTestResult> {
  const insecureDefaults = [
    { pattern: /auth.*disabled.*default/i, issue: 'Auth disabled by default' },
    { pattern: /no.*password.*required/i, issue: 'No password required' },
    { pattern: /bind.*0\.0\.0\.0/i, issue: 'Binds to all interfaces' },
    { pattern: /localhost.*:.*\d+/i, issue: 'Exposes local port' },
    { pattern: /debug.*mode.*enabled/i, issue: 'Debug mode enabled' },
    { pattern: /ssl.*disabled/i, issue: 'SSL disabled' },
    { pattern: /http:\/\//i, issue: 'Uses HTTP (not HTTPS)' },
    { pattern: /allow.*all/i, issue: 'Allows all access' },
    { pattern: /cors.*\*/i, issue: 'CORS allows all origins' },
    { pattern: /no.*rate.*limit/i, issue: 'No rate limiting' },
  ];

  const secureDefaults = [
    /secure.*by.*default/i,
    /auth.*required/i,
    /https.*required/i,
    /rate.*limit.*enabled/i,
    /127\.0\.0\.1/i,
    /localhost.*only/i,
  ];

  const issuesFound: string[] = [];
  let hasSecureDefaults = false;

  for (const def of insecureDefaults) {
    if (def.pattern.test(readmeContent)) {
      issuesFound.push(def.issue);
    }
  }

  for (const secure of secureDefaults) {
    if (secure.test(readmeContent)) {
      hasSecureDefaults = true;
      break;
    }
  }

  const passed = issuesFound.length === 0 || hasSecureDefaults;

  return {
    testName: 'Configuration Security Defaults',
    category: 'configuration',
    passed,
    severity: !passed && issuesFound.length > 3 ? 'critical' : (!passed ? 'high' : 'info'),
    description: passed
      ? 'Configuration defaults appear reasonably secure'
      : `Found ${issuesFound.length} potentially insecure default configurations`,
    evidence: issuesFound.length > 0 ? issuesFound.join(', ') : undefined,
    recommendation: passed ? undefined : 'Enable authentication, use HTTPS, bind to localhost only, and enable rate limiting by default'
  };
}

// =============================================================================
// TEST 6: Exposure Risk (Shodan-style)
// =============================================================================
async function testExposureRisk(
  projectName: string,
  alternateNames: string[]
): Promise<SecurityTestResult> {
  // Check Shodan for exposed instances
  // Note: This would require SHODAN_API_KEY in production
  const shodanApiKey = process.env.SHODAN_API_KEY;
  
  if (!shodanApiKey) {
    return {
      testName: 'Internet Exposure Scan',
      category: 'exposure',
      passed: true,
      severity: 'info',
      description: 'Shodan API key not configured - exposure scan skipped',
      recommendation: 'Configure SHODAN_API_KEY for automated exposure scanning'
    };
  }

  try {
    const searchTerms = [projectName, ...alternateNames].filter(Boolean);
    let totalExposed = 0;

    for (const term of searchTerms) {
      const response = await fetch(
        `https://api.shodan.io/shodan/host/count?key=${shodanApiKey}&query=${encodeURIComponent(term)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        totalExposed += data.total || 0;
      }
    }

    const passed = totalExposed < 10;

    return {
      testName: 'Internet Exposure Scan',
      category: 'exposure',
      passed,
      severity: totalExposed > 100 ? 'critical' : (totalExposed > 10 ? 'high' : 'info'),
      description: totalExposed > 0
        ? `Found ${totalExposed} potentially exposed instances on the internet`
        : 'No exposed instances found on Shodan',
      evidence: totalExposed > 0 ? `${totalExposed} instances found via Shodan` : undefined,
      recommendation: passed ? undefined : 'Ensure instances are not publicly exposed. Use VPN or firewall rules.'
    };
  } catch (error) {
    return {
      testName: 'Internet Exposure Scan',
      category: 'exposure',
      passed: true,
      severity: 'info',
      description: 'Exposure scan failed - manual verification recommended',
      recommendation: 'Manually check Shodan.io for exposed instances'
    };
  }
}

// =============================================================================
// TEST 7: Identity/Rebrand Detection
// =============================================================================
async function testIdentityStability(
  owner: string,
  repo: string,
  readmeContent: string,
  alternateNames: string[]
): Promise<SecurityTestResult> {
  const renameIndicators = [
    /formerly\s*(known\s*as|called)/i,
    /previously\s*named/i,
    /renamed\s*(from|to)/i,
    /rebranded/i,
    /successor\s*(to|of)/i,
    /fork\s*of/i,
    /based\s*on/i,
    /evolved\s*from/i,
  ];

  let renameEvidence: string[] = [];

  for (const pattern of renameIndicators) {
    const match = readmeContent.match(pattern);
    if (match) {
      renameEvidence.push(match[0]);
    }
  }

  // Check if known alternate names are mentioned
  for (const altName of alternateNames) {
    if (readmeContent.toLowerCase().includes(altName.toLowerCase())) {
      renameEvidence.push(`References "${altName}"`);
    }
  }

  const hasMultipleIdentities = renameEvidence.length > 0 || alternateNames.length > 1;
  const passed = !hasMultipleIdentities;

  return {
    testName: 'Identity Stability Check',
    category: 'identity',
    passed,
    severity: !passed && renameEvidence.length > 2 ? 'high' : (!passed ? 'medium' : 'info'),
    description: passed
      ? 'Project has stable identity with no detected renames'
      : `Project has ${alternateNames.length + 1} known identities - may be evading reputation`,
    evidence: renameEvidence.length > 0 ? renameEvidence.join(', ') : undefined,
    recommendation: passed ? undefined : 'Research previous identities for security history. Renames may indicate reputation evasion.'
  };
}

// =============================================================================
// TEST 8: Maintainer Responsiveness
// =============================================================================
async function testMaintainerResponsiveness(
  owner: string,
  repo: string
): Promise<SecurityTestResult> {
  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PubGuard-Security-Scanner'
  };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

  try {
    // Check security issues response time
    const issuesResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?labels=security&state=all&per_page=10`,
      { headers, signal: AbortSignal.timeout(10000) }
    );

    if (!issuesResponse.ok) {
      return {
        testName: 'Maintainer Security Responsiveness',
        category: 'maintenance',
        passed: true,
        severity: 'info',
        description: 'Could not fetch security issues - manual verification needed'
      };
    }

    const issues = await issuesResponse.json();
    
    if (issues.length === 0) {
      return {
        testName: 'Maintainer Security Responsiveness',
        category: 'maintenance',
        passed: true,
        severity: 'info',
        description: 'No security-labeled issues found'
      };
    }

    // Calculate average response time
    let totalResponseDays = 0;
    let respondedCount = 0;
    let unresolvedCount = 0;

    for (const issue of issues) {
      if (issue.state === 'closed' && issue.closed_at) {
        const created = new Date(issue.created_at);
        const closed = new Date(issue.closed_at);
        const days = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        totalResponseDays += days;
        respondedCount++;
      } else if (issue.state === 'open') {
        unresolvedCount++;
      }
    }

    const avgResponseDays = respondedCount > 0 ? totalResponseDays / respondedCount : -1;
    const passed = avgResponseDays < 30 && avgResponseDays >= 0 && unresolvedCount < 3;

    return {
      testName: 'Maintainer Security Responsiveness',
      category: 'maintenance',
      passed,
      severity: !passed ? (unresolvedCount > 5 ? 'high' : 'medium') : 'info',
      description: avgResponseDays >= 0
        ? `Average security issue resolution: ${avgResponseDays.toFixed(1)} days. ${unresolvedCount} unresolved.`
        : `${unresolvedCount} unresolved security issues`,
      evidence: unresolvedCount > 0 ? `${unresolvedCount} open security issues` : undefined,
      recommendation: passed ? undefined : 'Slow security response indicates risk. Consider alternatives or additional security measures.'
    };
  } catch (error) {
    return {
      testName: 'Maintainer Security Responsiveness',
      category: 'maintenance',
      passed: true,
      severity: 'info',
      description: 'Could not assess maintainer responsiveness'
    };
  }
}

// =============================================================================
// MAIN: Run All Security Tests
// =============================================================================
export async function runSecurityTests(
  owner: string,
  repo: string,
  readmeContent: string,
  securityMdContent?: string,
  alternateNames: string[] = []
): Promise<SecurityTestsAnalysis> {
  const results: SecurityTestResult[] = [];

  // Run all tests in parallel where possible
  const [
    credentialTest,
    permissionTest,
    injectionTest,
    supplyChainTest,
    configTest,
    exposureTest,
    identityTest,
    maintainerTest
  ] = await Promise.all([
    testCredentialStorage(owner, repo, readmeContent),
    testPermissionScope(readmeContent, securityMdContent),
    testPromptInjectionRisk(readmeContent),
    testSupplyChainSecurity(owner, repo, readmeContent),
    testConfigurationDefaults(readmeContent),
    testExposureRisk(repo, alternateNames),
    testIdentityStability(owner, repo, readmeContent, alternateNames),
    testMaintainerResponsiveness(owner, repo)
  ]);

  results.push(
    credentialTest,
    permissionTest,
    injectionTest,
    supplyChainTest,
    configTest,
    exposureTest,
    identityTest,
    maintainerTest
  );

  // Calculate metrics
  const testsRun = results.length;
  const testsPassed = results.filter(r => r.passed).length;
  const testsFailed = testsRun - testsPassed;

  // Convert to findings
  const findings: Finding[] = results
    .filter(r => !r.passed)
    .map(r => ({
      severity: r.severity === 'info' ? 'low' : r.severity,
      category: r.category,
      title: `[TEST FAILED] ${r.testName}`,
      description: r.description + (r.recommendation ? ` Recommendation: ${r.recommendation}` : ''),
      source: 'PubGuard Automated Security Test',
      sourceUrl: undefined,
      date: new Date().toISOString().split('T')[0]
    }));

  // Calculate overall risk based on test failures
  const severityWeights = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
  let riskScore = 0;
  
  for (const result of results) {
    if (!result.passed) {
      riskScore += severityWeights[result.severity] || 0;
    }
  }

  // Cap at 100
  const overallRisk = Math.min(100, riskScore);

  return {
    testsRun,
    testsPassed,
    testsFailed,
    results,
    findings,
    overallRisk
  };
}
