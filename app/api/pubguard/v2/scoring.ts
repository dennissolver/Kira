// app/api/pubguard/v2/scoring.ts
// Risk scoring and traffic light determination

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
    weight: 0.25,
  },
  activeVulnerabilities: {
    name: 'Active Vulnerabilities',
    description: 'Known CVEs, security advisories, and open security issues',
    weight: 0.25,
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
    weight: 0.15,
  },
};

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

  // CVE findings
  if (cve) {
    const critical = cve.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const high = cve.vulnerabilities.filter(v => v.severity === 'HIGH').length;
    const medium = cve.vulnerabilities.filter(v => v.severity === 'MEDIUM').length;

    if (critical > 0) {
      score += Math.min(40, critical * 20);
      factors.push(`${critical} CRITICAL CVE(s) in NVD database`);
    }
    if (high > 0) {
      score += Math.min(30, high * 10);
      factors.push(`${high} HIGH severity CVE(s)`);
    }
    if (medium > 0) {
      score += Math.min(15, medium * 5);
      factors.push(`${medium} MEDIUM severity CVE(s)`);
    }
  }

  // GitHub security advisories
  if (github?.securityAdvisoriesCount && github.securityAdvisoriesCount > 0) {
    score += Math.min(20, github.securityAdvisoriesCount * 5);
    factors.push(`${github.securityAdvisoriesCount} GitHub security advisory/alerts`);
  }

  // Open security issues
  if (github?.securityLabeledIssues && github.securityLabeledIssues.length > 0) {
    score += Math.min(15, github.securityLabeledIssues.length * 3);
    factors.push(`${github.securityLabeledIssues.length} open security-labeled issues`);
  }

  // No CVEs is positive
  if (cve && cve.totalFound === 0) {
    factors.push('No CVEs found in NVD database');
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
      score += Math.min(50, news.expertWarnings.length * 25);
      for (const warning of news.expertWarnings.slice(0, 3)) {
        factors.push(`${warning.name} (${warning.organization}): "${warning.quote.slice(0, 50)}..."`);
      }
    }

    // Security warnings from high-credibility sources
    const highCredWarnings = news.securityWarnings.filter(w => w.authorCredibility === 'high');
    if (highCredWarnings.length > 0) {
      score += Math.min(30, highCredWarnings.length * 10);
      factors.push(`${highCredWarnings.length} security warnings from major publications`);
    }

    // General security coverage
    if (news.securityWarnings.length > 5) {
      score += 10;
      factors.push(`Widespread security coverage (${news.securityWarnings.length} articles)`);
    }
  }

  if (social) {
    if (social.securityResearcherWarnings.length > 0) {
      score += Math.min(20, social.securityResearcherWarnings.length * 10);
      factors.push(`${social.securityResearcherWarnings.length} security researcher warnings on social media`);
    }
  }

  // No warnings is positive
  if (news && news.securityWarnings.length === 0 && (!social || social.securityResearcherWarnings.length === 0)) {
    factors.push('No security warnings found in media');
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
      disclaimer = 'WARNING: Security researchers and industry experts have raised significant concerns about this tool. It requires extensive system access and has documented security vulnerabilities. We do not recommend installing this tool without expert security guidance.';
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
