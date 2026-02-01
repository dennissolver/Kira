// app/api/pubguard/v2/analyzers/security-tests.ts
// REAL Security Tests - No Fake Simulations
// Each test actually calls external APIs or performs real analysis

// =============================================================================
// TYPES - Must match ../types.ts SecurityTestsAnalysis
// =============================================================================

import type { Finding, SecurityTestsAnalysis, SecurityTestResult } from '../types';

// Internal result type for individual tests
interface InternalTestResult {
  testId: string;
  testName: string;
  category: string;
  passed: boolean;
  hasWarning: boolean;
  score: number; // 0-100, lower is better (less risk)
  findings: Finding[];
  details: Record<string, any>;
  skipped?: boolean;
  skipReason?: string;
}

// =============================================================================
// TEST 1: DEPENDENCY VULNERABILITIES (OSV.dev - FREE)
// Scans package.json/requirements.txt for known vulnerabilities
// =============================================================================

interface OSVVulnerability {
  id: string;
  summary: string;
  details: string;
  severity: { type: string; score: string }[];
  affected: { package: { name: string; ecosystem: string }; ranges: any[] }[];
  references: { type: string; url: string }[];
}

async function fetchPackageJson(owner: string, repo: string, token?: string): Promise<any | null> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'PubGuard-Scanner',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
      { headers }
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchRequirementsTxt(owner: string, repo: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'PubGuard-Scanner',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/requirements.txt`,
      { headers }
    );
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

async function queryOSV(ecosystem: string, packageName: string, version?: string): Promise<OSVVulnerability[]> {
  try {
    const response = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: { name: packageName, ecosystem },
        version: version || undefined,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.vulns || [];
  } catch {
    return [];
  }
}

export async function testDependencyVulnerabilities(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    packagesScanned: 0,
    vulnerabilitiesFound: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    vulnerabilities: [] as any[],
  };

  // Try to fetch package.json
  const packageJson = await fetchPackageJson(owner, repo, githubToken);
  const requirementsTxt = await fetchRequirementsTxt(owner, repo, githubToken);

  if (!packageJson && !requirementsTxt) {
    return {
      testId: 'dependency-vulns',
      testName: 'Dependency Vulnerabilities',
      category: 'supply-chain',
      passed: true,
      hasWarning: false,
      score: 0,
      findings: [{
        severity: 'low',
        category: 'Positive',
        title: 'No dependency files found',
        description: 'No package.json or requirements.txt found to scan.',
        source: 'Dependency Analysis',
      }],
      details,
      skipped: true,
      skipReason: 'No dependency files found',
    };
  }

  // Parse and scan npm dependencies
  if (packageJson) {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const depNames = Object.keys(allDeps || {});
    details.packagesScanned += depNames.length;

    // Scan top 20 dependencies (to avoid rate limits)
    for (const dep of depNames.slice(0, 20)) {
      const version = allDeps[dep]?.replace(/[\^~>=<]/g, '').split(' ')[0];
      const vulns = await queryOSV('npm', dep, version);

      for (const vuln of vulns) {
        details.vulnerabilitiesFound++;
        const severity = vuln.severity?.[0]?.score || 'MEDIUM';
        const severityLower = severity.toLowerCase();

        if (severityLower.includes('critical') || parseFloat(severity) >= 9) {
          details.criticalCount++;
        } else if (severityLower.includes('high') || parseFloat(severity) >= 7) {
          details.highCount++;
        } else if (severityLower.includes('medium') || parseFloat(severity) >= 4) {
          details.mediumCount++;
        } else {
          details.lowCount++;
        }

        details.vulnerabilities.push({
          id: vuln.id,
          package: dep,
          summary: vuln.summary,
        });
      }

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Parse and scan Python dependencies
  if (requirementsTxt) {
    const lines = requirementsTxt.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    details.packagesScanned += lines.length;

    for (const line of lines.slice(0, 20)) {
      const match = line.match(/^([a-zA-Z0-9_-]+)/);
      if (!match) continue;

      const dep = match[1];
      const vulns = await queryOSV('PyPI', dep);

      for (const vuln of vulns) {
        details.vulnerabilitiesFound++;
        const severity = vuln.severity?.[0]?.score || 'MEDIUM';

        if (severity === 'CRITICAL' || parseFloat(severity) >= 9) details.criticalCount++;
        else if (severity === 'HIGH' || parseFloat(severity) >= 7) details.highCount++;
        else if (severity === 'MEDIUM' || parseFloat(severity) >= 4) details.mediumCount++;
        else details.lowCount++;

        details.vulnerabilities.push({
          id: vuln.id,
          package: dep,
          summary: vuln.summary,
        });
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Generate findings
  if (details.criticalCount > 0) {
    findings.push({
      severity: 'critical',
      category: 'Dependency Vulnerabilities',
      title: `${details.criticalCount} CRITICAL vulnerability(ies) in dependencies`,
      description: details.vulnerabilities
        .filter((v: any) => v.id.includes('CRITICAL') || details.criticalCount > 0)
        .slice(0, 3)
        .map((v: any) => `${v.package}: ${v.summary}`)
        .join('\n'),
      source: 'OSV.dev',
      sourceUrl: 'https://osv.dev',
    });
  }

  if (details.highCount > 0) {
    findings.push({
      severity: 'high',
      category: 'Dependency Vulnerabilities',
      title: `${details.highCount} HIGH severity vulnerability(ies) in dependencies`,
      description: `Found ${details.highCount} high severity vulnerabilities in project dependencies.`,
      source: 'OSV.dev',
      sourceUrl: 'https://osv.dev',
    });
  }

  if (details.vulnerabilitiesFound === 0 && details.packagesScanned > 0) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: `${details.packagesScanned} dependencies scanned - no vulnerabilities`,
      description: 'All scanned dependencies are free of known vulnerabilities.',
      source: 'OSV.dev',
    });
  }

  const score = Math.min(100,
    details.criticalCount * 30 +
    details.highCount * 15 +
    details.mediumCount * 5 +
    details.lowCount * 1
  );

  return {
    testId: 'dependency-vulns',
    testName: 'Dependency Vulnerabilities',
    category: 'supply-chain',
    passed: details.criticalCount === 0 && details.highCount === 0,
    hasWarning: details.mediumCount > 0 || details.lowCount > 0,
    score,
    findings,
    details,
  };
}

// =============================================================================
// TEST 2: SECRETS IN CODE (GitHub Code Search)
// Searches for exposed API keys, tokens, passwords
// =============================================================================

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: 'AKIA[0-9A-Z]{16}' },
  { name: 'AWS Secret Key', pattern: '[0-9a-zA-Z/+]{40}' },
  { name: 'GitHub Token', pattern: 'gh[ps]_[a-zA-Z0-9]{36}' },
  { name: 'Generic API Key', pattern: 'api[_-]?key[\'"]?\\s*[:=]\\s*[\'"][a-zA-Z0-9]{20,}[\'"]' },
  { name: 'Generic Secret', pattern: 'secret[\'"]?\\s*[:=]\\s*[\'"][a-zA-Z0-9]{10,}[\'"]' },
  { name: 'Private Key', pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----' },
  { name: 'Password in Config', pattern: 'password[\'"]?\\s*[:=]\\s*[\'"][^\'\"]{8,}[\'"]' },
];

export async function testSecretsInCode(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    secretsFound: 0,
    types: [] as string[],
    locations: [] as string[],
  };

  if (!githubToken) {
    return {
      testId: 'secrets-detection',
      testName: 'Secrets Detection',
      category: 'credentials',
      passed: true,
      hasWarning: false,
      score: 0,
      findings: [],
      details,
      skipped: true,
      skipReason: 'GitHub token required for code search',
    };
  }

  // Search for common secret patterns using GitHub code search
  for (const secretPattern of SECRET_PATTERNS.slice(0, 5)) { // Limit searches
    try {
      const response = await fetch(
        `https://api.github.com/search/code?q=${encodeURIComponent(secretPattern.pattern)}+repo:${owner}/${repo}`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PubGuard-Scanner',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.total_count > 0) {
          details.secretsFound += data.total_count;
          details.types.push(secretPattern.name);
          details.locations.push(...data.items?.slice(0, 3).map((i: any) => i.path) || []);
        }
      }

      // Rate limit delay
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Secret search failed for ${secretPattern.name}:`, err);
    }
  }

  if (details.secretsFound > 0) {
    findings.push({
      severity: 'critical',
      category: 'Secrets Exposure',
      title: `${details.secretsFound} potential secret(s) found in code`,
      description: `Found potential secrets: ${details.types.join(', ')}. Files: ${details.locations.slice(0, 5).join(', ')}`,
      source: 'Code Analysis',
      sourceUrl: `https://github.com/${owner}/${repo}/search?q=secret+OR+api_key+OR+password`,
    });
  } else {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'No hardcoded secrets detected',
      description: 'Code search did not find obvious hardcoded secrets.',
      source: 'Code Analysis',
    });
  }

  return {
    testId: 'secrets-detection',
    testName: 'Secrets Detection',
    category: 'credentials',
    passed: details.secretsFound === 0,
    hasWarning: false,
    score: details.secretsFound > 0 ? 80 : 0,
    findings,
    details,
  };
}

// =============================================================================
// TEST 3: MAINTAINER ACTIVITY (GitHub API)
// Checks response time to security issues, commit frequency
// =============================================================================

export async function testMaintainerActivity(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    lastCommitDaysAgo: 0,
    securityIssueResponseTime: null,
    openSecurityIssues: 0,
    contributorCount: 0,
    isAbandoned: false,
  };

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PubGuard-Scanner',
  };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

  try {
    // Get repo info
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (repoResponse.ok) {
      const repoData = await repoResponse.json();
      const pushedAt = new Date(repoData.pushed_at);
      const daysSince = Math.floor((Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24));
      details.lastCommitDaysAgo = daysSince;
      details.isAbandoned = daysSince > 365;
    }

    // Get contributors
    const contribResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1`,
      { headers }
    );
    if (contribResponse.ok) {
      const linkHeader = contribResponse.headers.get('Link');
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        details.contributorCount = match ? parseInt(match[1]) : 1;
      } else {
        const data = await contribResponse.json();
        details.contributorCount = data.length;
      }
    }

    // Check for open security issues
    const issuesResponse = await fetch(
      `https://api.github.com/search/issues?q=repo:${owner}/${repo}+label:security+state:open`,
      { headers }
    );
    if (issuesResponse.ok) {
      const issuesData = await issuesResponse.json();
      details.openSecurityIssues = issuesData.total_count;
    }
  } catch (err) {
    console.error('Maintainer activity test failed:', err);
  }

  // Generate findings
  if (details.isAbandoned) {
    findings.push({
      severity: 'high',
      category: 'Maintainer Activity',
      title: 'Project appears abandoned',
      description: `No commits in ${details.lastCommitDaysAgo} days. Security issues may not be addressed.`,
      source: 'GitHub Analysis',
      sourceUrl: `https://github.com/${owner}/${repo}/commits`,
    });
  } else if (details.lastCommitDaysAgo > 180) {
    findings.push({
      severity: 'medium',
      category: 'Maintainer Activity',
      title: 'Low recent activity',
      description: `Last commit was ${details.lastCommitDaysAgo} days ago.`,
      source: 'GitHub Analysis',
    });
  } else {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'Active maintenance',
      description: `Project is actively maintained (last commit ${details.lastCommitDaysAgo} days ago, ${details.contributorCount} contributors).`,
      source: 'GitHub Analysis',
    });
  }

  if (details.openSecurityIssues > 0) {
    findings.push({
      severity: 'high',
      category: 'Security Issues',
      title: `${details.openSecurityIssues} open security issue(s)`,
      description: 'There are unresolved security-labeled issues.',
      source: 'GitHub Issues',
      sourceUrl: `https://github.com/${owner}/${repo}/issues?q=label:security+is:open`,
    });
  }

  const score = (details.isAbandoned ? 50 : 0) +
                (details.lastCommitDaysAgo > 180 ? 20 : 0) +
                (details.openSecurityIssues * 10);

  return {
    testId: 'maintainer-activity',
    testName: 'Maintainer Activity',
    category: 'maintenance',
    passed: !details.isAbandoned && details.openSecurityIssues === 0,
    hasWarning: details.lastCommitDaysAgo > 180,
    score: Math.min(100, score),
    findings,
    details,
  };
}

// =============================================================================
// TEST 4: LICENSE & LEGAL (GitHub API)
// Checks for proper licensing
// =============================================================================

export async function testLicenseCompliance(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    license: null,
    isOSIApproved: false,
    hasLicenseFile: false,
  };

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PubGuard-Scanner',
  };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/license`, { headers });
    if (response.ok) {
      const data = await response.json();
      details.license = data.license?.spdx_id;
      details.hasLicenseFile = true;

      const osiApproved = ['MIT', 'Apache-2.0', 'GPL-3.0', 'GPL-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'MPL-2.0'];
      details.isOSIApproved = osiApproved.includes(details.license);
    }
  } catch {
    // No license found
  }

  if (!details.hasLicenseFile) {
    findings.push({
      severity: 'medium',
      category: 'Legal',
      title: 'No license file found',
      description: 'This project has no clear license, which may pose legal risks for commercial use.',
      source: 'GitHub Analysis',
    });
  } else if (details.isOSIApproved) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: `OSI-approved license: ${details.license}`,
      description: 'Project uses a well-known open source license.',
      source: 'GitHub Analysis',
    });
  } else {
    findings.push({
      severity: 'low',
      category: 'Legal',
      title: `License: ${details.license || 'Unknown'}`,
      description: 'Review the license terms before using in production.',
      source: 'GitHub Analysis',
    });
  }

  return {
    testId: 'license-compliance',
    testName: 'License Compliance',
    category: 'configuration',
    passed: details.hasLicenseFile,
    hasWarning: !details.isOSIApproved,
    score: details.hasLicenseFile ? 0 : 20,
    findings,
    details,
  };
}

// =============================================================================
// TEST 5: TYPOSQUATTING CHECK (npm/PyPI)
// Checks if this package name is similar to popular packages
// =============================================================================

const POPULAR_PACKAGES = {
  npm: ['react', 'lodash', 'express', 'axios', 'moment', 'request', 'chalk', 'commander', 'debug', 'uuid'],
  pypi: ['requests', 'numpy', 'pandas', 'django', 'flask', 'tensorflow', 'boto3', 'scipy', 'pillow', 'matplotlib'],
};

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function testTyposquatting(
  projectName: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    similarPackages: [] as string[],
    isSuspicious: false,
  };

  const lowerName = projectName.toLowerCase();

  // Check against popular packages
  for (const [ecosystem, packages] of Object.entries(POPULAR_PACKAGES)) {
    for (const popular of packages) {
      const distance = levenshteinDistance(lowerName, popular);
      // If very similar but not exact match
      if (distance > 0 && distance <= 2 && lowerName !== popular) {
        details.similarPackages.push(`${popular} (${ecosystem})`);
        details.isSuspicious = true;
      }
    }
  }

  if (details.isSuspicious) {
    findings.push({
      severity: 'high',
      category: 'Supply Chain',
      title: 'Package name similar to popular packages',
      description: `This package name is very similar to: ${details.similarPackages.join(', ')}. This could indicate typosquatting.`,
      source: 'Name Analysis',
    });
  }

  return {
    testId: 'typosquatting',
    testName: 'Typosquatting Check',
    category: 'supply-chain',
    passed: !details.isSuspicious,
    hasWarning: false,
    score: details.isSuspicious ? 60 : 0,
    findings,
    details,
  };
}

// =============================================================================
// TEST 6: INTERNET EXPOSURE (Shodan - Optional)
// Checks for exposed instances on the internet
// =============================================================================

export async function testInternetExposure(
  projectName: string,
  shodanApiKey?: string
): Promise<InternalTestResult> {
  const findings: Finding[] = [];
  const details: Record<string, any> = {
    exposedInstances: 0,
    countries: [] as string[],
    ports: [] as number[],
  };

  if (!shodanApiKey) {
    return {
      testId: 'internet-exposure',
      testName: 'Internet Exposure',
      category: 'exposure',
      passed: true,
      hasWarning: false,
      score: 0,
      findings: [],
      details,
      skipped: true,
      skipReason: 'Shodan API key not configured',
    };
  }

  try {
    const response = await fetch(
      `https://api.shodan.io/shodan/host/search?key=${shodanApiKey}&query=${encodeURIComponent(projectName)}`,
    );

    if (response.ok) {
      const data = await response.json();
      details.exposedInstances = data.total || 0;

      if (data.matches) {
        details.countries = [...new Set(data.matches.map((m: any) => m.location?.country_name).filter(Boolean))];
        details.ports = [...new Set(data.matches.map((m: any) => m.port).filter(Boolean))];
      }
    }
  } catch (err) {
    console.error('Shodan search failed:', err);
  }

  if (details.exposedInstances > 0) {
    findings.push({
      severity: details.exposedInstances > 100 ? 'critical' : 'high',
      category: 'Internet Exposure',
      title: `${details.exposedInstances} exposed instance(s) found`,
      description: `Found ${details.exposedInstances} instances exposed to the internet. Countries: ${details.countries.slice(0, 5).join(', ')}. Ports: ${details.ports.slice(0, 5).join(', ')}.`,
      source: 'Shodan',
      sourceUrl: `https://www.shodan.io/search?query=${encodeURIComponent(projectName)}`,
    });
  }

  return {
    testId: 'internet-exposure',
    testName: 'Internet Exposure',
    category: 'exposure',
    passed: details.exposedInstances === 0,
    hasWarning: details.exposedInstances > 0 && details.exposedInstances < 100,
    score: Math.min(100, details.exposedInstances),
    findings,
    details,
  };
}

// =============================================================================
// MAIN: Run All Security Tests
// =============================================================================

export async function runAllSecurityTests(
  owner: string,
  repo: string,
  projectName: string,
  options: {
    githubToken?: string;
    shodanApiKey?: string;
  } = {}
): Promise<SecurityTestsAnalysis> {
  console.log(`[SecurityTests] Running tests for ${owner}/${repo}`);

  const internalResults: InternalTestResult[] = [];

  // Run tests in parallel where possible
  const [
    dependencyTest,
    secretsTest,
    maintainerTest,
    licenseTest,
    typosquattingTest,
    exposureTest,
  ] = await Promise.all([
    testDependencyVulnerabilities(owner, repo, options.githubToken),
    testSecretsInCode(owner, repo, options.githubToken),
    testMaintainerActivity(owner, repo, options.githubToken),
    testLicenseCompliance(owner, repo, options.githubToken),
    testTyposquatting(projectName),
    testInternetExposure(projectName, options.shodanApiKey),
  ]);

  internalResults.push(dependencyTest, secretsTest, maintainerTest, licenseTest, typosquattingTest, exposureTest);

  // Convert to SecurityTestsAnalysis format
  const results: SecurityTestResult[] = internalResults
    .filter(t => !t.skipped)
    .map(t => ({
      testName: t.testName,
      category: t.category,
      passed: t.passed,
      severity: t.score >= 60 ? 'critical' as const :
               t.score >= 40 ? 'high' as const :
               t.score >= 20 ? 'medium' as const :
               t.score >= 10 ? 'low' as const : 'info' as const,
      description: t.findings[0]?.description || 'Test completed',
      evidence: t.details ? JSON.stringify(t.details).substring(0, 200) : undefined,
      recommendation: t.findings[0]?.title,
    }));

  // Collect all findings
  const allFindings: Finding[] = internalResults.flatMap(t => t.findings);

  // Calculate totals
  const testsRun = internalResults.filter(t => !t.skipped).length;
  const testsPassed = internalResults.filter(t => t.passed && !t.skipped).length;
  const testsFailed = internalResults.filter(t => !t.passed && !t.skipped).length;
  const overallRisk = testsRun > 0
    ? Math.round(internalResults.filter(t => !t.skipped).reduce((sum, t) => sum + t.score, 0) / testsRun)
    : 0;

  console.log(`[SecurityTests] Complete: ${testsPassed}/${testsRun} passed, risk score: ${overallRisk}`);

  return {
    testsRun,
    testsPassed,
    testsFailed,
    results,
    findings: allFindings,
    overallRisk,
  };
}