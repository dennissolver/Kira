// app/api/pubguard/v2/scoring.ts
// Risk scoring and traffic light determination - FIXED for proper CRITICAL CVE handling

import type {
  PubGuardReport,
  RiskCategory,
  Finding,
  TrafficLight,
  GitHubAnalysis,
  CVEAnalysis,
  NewsAnalysis,
  SocialAnalysis,
  WriterGuidance
} from './types';

// Risk category definitions with weights
const RISK_CATEGORIES = {
  architectureRisk: {
    name: 'Architecture Risk',
    description: 'Inherent risks from the tool\'s design (shell access, credentials, etc.)',
    weight: 0.20,
  },
  activeVulnerabilities: {
    name: 'Active Vulnerabilities',
    description: 'Known CVEs, security advisories, and open security issues',
    weight: 0.35, // INCREASED - CVEs are the most important factor
  },
  mediaWarnings: {
    name: 'News & Expert Warnings',
    description: 'Security warnings from publications and researchers',
    weight: 0.20,
  },
  maintainerResponse: {
    name: 'Maintainer Response',
    description: 'How well maintainers address security (inverse - lower is better)',
    weight: 0.15,
  },
  velocityRisk: {
    name: 'Viral Growth Risk',
    description: 'Risk from rapid adoption outpacing security vetting',
    weight: 0.10,
  },
};

// HIGH-PROFILE CVE IDs that should trigger maximum risk
const CRITICAL_BACKDOOR_CVES = [
  'CVE-2024-3094',   // XZ Utils backdoor
  'CVE-2021-44228',  // Log4Shell
  'CVE-2021-45046',  // Log4j follow-up
  'CVE-2022-22965',  // Spring4Shell
  'CVE-2014-0160',   // Heartbleed
  'CVE-2017-5638',   // Apache Struts
  'CVE-2014-6271',   // Shellshock
  'CVE-2021-4034',   // PwnKit
  'CVE-2021-3156',   // Baron Samedit (sudo)
  'CVE-2022-0847',   // Dirty Pipe
];

export function calculateArchitectureRisk(github: GitHubAnalysis | null): RiskCategory {
  let score = 0;
  const factors: string[] = [];

  if (!github) {
    return {
      ...RISK_CATEGORIES.architectureRisk,
      score: 50,
      weightedScore: 50 * RISK_CATEGORIES.architectureRisk.weight,
      factors: ['Unable to analyze - GitHub data unavailable'],
    };
  }

  // Shell access is high risk
  if (github.permissions.shellAccess) {
    score += 35;
    factors.push('Requires shell/command execution access');
  }

  // Root access is critical
  if (github.permissions.rootRequired) {
    score += 25;
    factors.push('Requires root/administrator privileges');
  }

  // Credential storage is concerning
  if (github.permissions.credentialStorage) {
    score += 20;
    factors.push('Stores credentials locally');
  }

  // File system access
  if (github.permissions.fileSystemAccess) {
    score += 10;
    factors.push('Requires file system access');
  }

  // Browser control
  if (github.permissions.browserControl) {
    score += 10;
    factors.push('Controls browser automation');
  }

  // Cap at 100
  score = Math.min(100, score);

  // Reduce score for mitigations
  if (github.hasSecurityPolicy) {
    score = Math.max(0, score - 5);
    factors.push('(Mitigated) Has security policy documentation');
  }

  return {
    ...RISK_CATEGORIES.architectureRisk,
    score,
    weightedScore: score * RISK_CATEGORIES.architectureRisk.weight,
    factors,
  };
}

export function calculateVulnerabilityRisk(
  cve: CVEAnalysis | null,
  github: GitHubAnalysis | null
): RiskCategory {
  let score = 0;
  const factors: string[] = [];
  let hasBackdoorCVE = false;

  // CVE findings
  if (cve && cve.vulnerabilities.length > 0) {
    const critical = cve.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const high = cve.vulnerabilities.filter(v => v.severity === 'HIGH');
    const medium = cve.vulnerabilities.filter(v => v.severity === 'MEDIUM');

    // Check for known backdoor/catastrophic CVEs
    for (const vuln of cve.vulnerabilities) {
      if (CRITICAL_BACKDOOR_CVES.includes(vuln.id)) {
        hasBackdoorCVE = true;
        score = 100; // MAXIMUM RISK
        factors.push(`🚨 BACKDOOR/CATASTROPHIC: ${vuln.id} (CVSS ${vuln.cvssScore || '10.0'})`);
        break;
      }
    }

    if (!hasBackdoorCVE) {
      // Regular CRITICAL CVEs - much higher impact now
      if (critical.length > 0) {
        // CRITICAL CVE = at least 70 points, more for multiple
        score += Math.min(100, 70 + (critical.length - 1) * 15);
        factors.push(`🚨 ${critical.length} CRITICAL CVE(s) - CVSS 9.0+`);

        // Add details for first critical CVE
        if (critical[0].cvssScore) {
          factors.push(`Highest CVSS: ${critical[0].cvssScore} (${critical[0].id})`);
        }
      }

      // HIGH severity CVEs
      if (high.length > 0) {
        score += Math.min(40, high.length * 15);
        factors.push(`⚠️ ${high.length} HIGH severity CVE(s)`);
      }

      // MEDIUM severity CVEs
      if (medium.length > 0) {
        score += Math.min(20, medium.length * 5);
        factors.push(`${medium.length} MEDIUM severity CVE(s)`);
      }
    }
  }

  // GitHub security advisories
  if (github?.securityAdvisoriesCount && github.securityAdvisoriesCount > 0) {
    score += Math.min(25, github.securityAdvisoriesCount * 8);
    factors.push(`${github.securityAdvisoriesCount} GitHub security advisory/alerts`);
  }

  // Open security issues
  if (github?.securityLabeledIssues && github.securityLabeledIssues.length > 0) {
    score += Math.min(15, github.securityLabeledIssues.length * 5);
    factors.push(`${github.securityLabeledIssues.length} open security-labeled issues`);
  }

  // No CVEs is positive
  if (cve && cve.totalFound === 0) {
    factors.push('✓ No CVEs found in NVD database');
  }

  score = Math.min(100, score);

  return {
    ...RISK_CATEGORIES.activeVulnerabilities,
    score,
    weightedScore: score * RISK_CATEGORIES.activeVulnerabilities.weight,
    factors,
  };
}

export function calculateMediaRisk(
  news: NewsAnalysis | null,
  social: SocialAnalysis | null
): RiskCategory {
  let score = 0;
  const factors: string[] = [];

  if (news) {
    // Expert warnings are very significant
    if (news.expertWarnings.length > 0) {
      score += Math.min(60, news.expertWarnings.length * 30);
      for (const warning of news.expertWarnings.slice(0, 3)) {
        factors.push(`${warning.name} (${warning.organization}): "${warning.quote.slice(0, 50)}..."`);
      }
    }

    // Security warnings from high-credibility sources
    const highCredWarnings = news.securityWarnings.filter(w => w.authorCredibility === 'high');
    if (highCredWarnings.length > 0) {
      score += Math.min(40, highCredWarnings.length * 15);
      factors.push(`${highCredWarnings.length} security warnings from major publications`);
    }

    // General security coverage - more articles = more concern
    if (news.securityWarnings.length > 20) {
      score += 25;
      factors.push(`Major security incident coverage (${news.securityWarnings.length} articles)`);
    } else if (news.securityWarnings.length > 10) {
      score += 15;
      factors.push(`Significant security coverage (${news.securityWarnings.length} articles)`);
    } else if (news.securityWarnings.length > 5) {
      score += 10;
      factors.push(`Widespread security coverage (${news.securityWarnings.length} articles)`);
    }
  }

  if (social) {
    if (social.securityResearcherWarnings.length > 0) {
      score += Math.min(30, social.securityResearcherWarnings.length * 15);
      factors.push(`${social.securityResearcherWarnings.length} security researcher warnings on social media`);
    }
  }

  // No warnings is positive
  if (news && news.securityWarnings.length === 0 && (!social || social.securityResearcherWarnings.length === 0)) {
    factors.push('✓ No security warnings found in media');
  }

  score = Math.min(100, score);

  return {
    ...RISK_CATEGORIES.mediaWarnings,
    score,
    weightedScore: score * RISK_CATEGORIES.mediaWarnings.weight,
    factors,
  };
}

export function calculateMaintainerResponse(github: GitHubAnalysis | null): RiskCategory {
  let score = 50; // Start neutral
  const factors: string[] = [];

  if (!github) {
    return {
      ...RISK_CATEGORIES.maintainerResponse,
      score: 50,
      weightedScore: 50 * RISK_CATEGORIES.maintainerResponse.weight,
      factors: ['Unable to analyze maintainer response'],
    };
  }

  // Good signs (reduce score)
  if (github.hasSecurityPolicy) {
    score -= 15;
    factors.push('Has SECURITY.md with disclosure process');
  }

  if (github.recentSecurityCommits.length > 5) {
    score -= 15;
    factors.push(`Active security maintenance (${github.recentSecurityCommits.length} security-related commits)`);
  }

  if (github.contributors > 50) {
    score -= 10;
    factors.push(`Large contributor base (${github.contributors})`);
  }

  if (github.daysSinceLastCommit < 7) {
    score -= 10;
    factors.push('Very active development (commit within 7 days)');
  }

  // Bad signs (increase score)
  if (github.daysSinceLastCommit > 180) {
    score += 20;
    factors.push('Appears unmaintained (no commits in 6+ months)');
  }

  if (github.contributors < 3) {
    score += 15;
    factors.push('Low bus factor (fewer than 3 contributors)');
  }

  if (!github.license) {
    score += 10;
    factors.push('No license detected');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...RISK_CATEGORIES.maintainerResponse,
    score,
    weightedScore: score * RISK_CATEGORIES.maintainerResponse.weight,
    factors,
  };
}

export function calculateVelocityRisk(github: GitHubAnalysis | null): RiskCategory {
  let score = 0;
  const factors: string[] = [];

  if (!github) {
    return {
      ...RISK_CATEGORIES.velocityRisk,
      score: 30,
      weightedScore: 30 * RISK_CATEGORIES.velocityRisk.weight,
      factors: ['Unable to analyze growth velocity'],
    };
  }

  // Viral growth is risky
  if (github.isViralGrowth) {
    score += 50;
    factors.push(`Viral growth detected (${Math.round(github.starsPerDay)} stars/day)`);
  } else if (github.starsPerDay > 100) {
    score += 30;
    factors.push(`Rapid growth (${Math.round(github.starsPerDay)} stars/day)`);
  } else if (github.starsPerDay > 50) {
    score += 15;
    factors.push(`Fast growth (${Math.round(github.starsPerDay)} stars/day)`);
  }

  // Recent rename is suspicious
  if (github.recentRename) {
    score += 25;
    factors.push(`Recent rename (previously: ${github.previousNames.join(', ')})`);
  }

  // Very new projects with high stars
  if (github.ageInDays < 30 && github.stars > 10000) {
    score += 20;
    factors.push('Very new project with massive adoption - limited vetting time');
  }

  // Established projects get a bonus
  if (github.ageInDays > 365 && github.starsPerDay < 50) {
    score -= 10;
    factors.push('Established project with steady growth');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...RISK_CATEGORIES.velocityRisk,
    score,
    weightedScore: score * RISK_CATEGORIES.velocityRisk.weight,
    factors,
  };
}

export function calculateOverallScore(categories: RiskCategory[]): number {
  // Check for any CRITICAL/BACKDOOR indicators that should force high score
  const vulnCategory = categories.find(c => c.name === 'Active Vulnerabilities');

  // If vulnerability score is 100 (backdoor detected), ensure minimum overall score of 85
  if (vulnCategory && vulnCategory.score >= 100) {
    const baseScore = categories.reduce((sum, cat) => sum + cat.weightedScore, 0);
    return Math.max(85, Math.round(baseScore));
  }

  // If vulnerability score is 70+ (critical CVE), ensure minimum overall score of 70
  if (vulnCategory && vulnCategory.score >= 70) {
    const baseScore = categories.reduce((sum, cat) => sum + cat.weightedScore, 0);
    return Math.max(70, Math.round(baseScore));
  }

  const totalWeightedScore = categories.reduce((sum, cat) => sum + cat.weightedScore, 0);
  return Math.round(totalWeightedScore);
}

export function determineTrafficLight(score: number): TrafficLight {
  if (score <= 30) return 'green';
  if (score <= 65) return 'amber';
  return 'red';
}

export function determineRecommendation(
  trafficLight: TrafficLight
): PubGuardReport['recommendation'] {
  switch (trafficLight) {
    case 'green': return 'SAFE_TO_RECOMMEND';
    case 'amber': return 'PROCEED_WITH_CAUTION';
    case 'red': return 'DO_NOT_RECOMMEND';
  }
}

export function generateWriterGuidance(
  trafficLight: TrafficLight,
  findings: Finding[],
  github: GitHubAnalysis | null,
  news: NewsAnalysis | null
): WriterGuidance {
  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');

  const mustDisclose: string[] = [];
  const keyPoints: string[] = [];

  // CRITICAL CVEs must always be disclosed first
  for (const finding of criticalFindings) {
    if (finding.category === 'CVE Database') {
      mustDisclose.push(`⚠️ CRITICAL VULNERABILITY: ${finding.title}`);
    }
  }

  // Build disclosure requirements
  if (github?.permissions.shellAccess) {
    mustDisclose.push('Requires shell/command execution access');
  }
  if (github?.permissions.credentialStorage) {
    mustDisclose.push('Stores credentials on user\'s system');
  }
  if (github?.permissions.rootRequired) {
    mustDisclose.push('Requires root/administrator privileges');
  }

  // Expert warnings must be disclosed
  if (news?.expertWarnings) {
    for (const warning of news.expertWarnings) {
      mustDisclose.push(`${warning.name} (${warning.organization}) has warned against using this tool`);
    }
  }

  // Key points to mention
  if (github?.hasSecurityPolicy) {
    keyPoints.push('Has documented security policy');
  }
  if (github?.recentSecurityCommits && github.recentSecurityCommits.length > 5) {
    keyPoints.push('Maintainers actively address security issues');
  }
  if (github?.isViralGrowth) {
    keyPoints.push('Extremely rapid adoption - exercise additional caution');
  }

  // Suggested disclaimer based on traffic light
  let disclaimer = '';
  switch (trafficLight) {
    case 'green':
      disclaimer = 'This tool appears to follow security best practices. As with any software, users should review permissions before installation.';
      break;
    case 'amber':
      disclaimer = 'DISCLOSURE: This tool has known security considerations. It requires [list permissions] and has been the subject of security discussions. Users should carefully review the security documentation and consider running in an isolated environment.';
      break;
    case 'red':
      disclaimer = '🚨 CRITICAL SECURITY WARNING: This software has known critical vulnerabilities or has been flagged by security researchers. DO NOT install or use this software without expert security guidance. Consider using verified alternatives.';
      break;
  }

  return {
    canRecommend: trafficLight !== 'red',
    mustDisclose,
    suggestedDisclaimer: disclaimer,
    keyPointsToMention: keyPoints,
    alternativesToConsider: [], // Would need a database of alternatives
  };
}

export function categorizeFindings(findings: Finding[]): PubGuardReport['findings'] {
  return {
    critical: findings.filter(f => f.severity === 'critical'),
    high: findings.filter(f => f.severity === 'high'),
    medium: findings.filter(f => f.severity === 'medium'),
    low: findings.filter(f => f.severity === 'low' && f.category !== 'Positive'),
    positive: findings.filter(f => f.category === 'Positive' ||
      (f.severity === 'low' && f.title.toLowerCase().includes('no '))),
  };
}