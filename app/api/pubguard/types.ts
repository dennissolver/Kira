// app/api/pubguard/types.ts
// Shared types for PubGuard security scanning

export interface GitHubRepoAnalysis {
  url: string;
  name: string;
  owner: string;
  analysis: {
    age: {
      created: string;
      lastCommit: string;
      daysSinceLastCommit: number;
      isStale: boolean;
    };
    popularity: {
      stars: number;
      forks: number;
      watchers: number;
      openIssues: number;
      velocity: 'high' | 'medium' | 'low' | 'stale';
    };
    security: {
      hasSecurityPolicy: boolean;
      hasCodeOfConduct: boolean;
      hasContributing: boolean;
      hasLicense: boolean;
      licenseType: string | null;
      securityIssuesCount: number;
      dependabotEnabled: boolean;
      vulnerabilityAlerts: number;
    };
    maintenance: {
      contributorCount: number;
      recentContributors: number;
      hasReadme: boolean;
      defaultBranch: string;
      isArchived: boolean;
      isFork: boolean;
    };
    riskScore: number;
    riskLevel: RiskLevel;
    recommendations: string[];
  };
  scannedAt: string;
}

export interface CVEResult {
  id: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvssScore: number | null;
  cvssVector: string | null;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
  affectedProducts: string[];
  cweIds: string[];
}

export interface CVEScanResult {
  query: string;
  totalResults: number;
  vulnerabilities: CVEResult[];
  scannedAt: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  relevanceScore?: number;
}

export interface NewsScanResult {
  query: string;
  articles: NewsArticle[];
  totalFound: number;
  scannedAt: string;
}

export interface ExposureResult {
  ip?: string;
  domain?: string;
  ports: {
    port: number;
    protocol: string;
    service: string;
    version?: string;
    vulnerable?: boolean;
  }[];
  certificates?: {
    issuer: string;
    subject: string;
    validFrom: string;
    validTo: string;
    isExpired: boolean;
    daysUntilExpiry: number;
  }[];
  headers?: {
    server?: string;
    securityHeaders: {
      name: string;
      present: boolean;
      value?: string;
    }[];
  };
  riskFactors: string[];
  riskScore: number;
  riskLevel: RiskLevel;
}

export interface ExposureScanResult {
  target: string;
  type: 'domain' | 'ip';
  exposure: ExposureResult;
  scannedAt: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScanResult {
  id: string;
  type: 'github' | 'cve' | 'news' | 'exposure';
  target: string;
  result: GitHubRepoAnalysis | CVEScanResult | NewsScanResult | ExposureScanResult;
  riskLevel: RiskLevel;
  createdAt: string;
  agentId?: string;
  conversationId?: string;
}

export interface FullScanReport {
  id: string;
  title: string;
  generatedAt: string;
  summary: {
    overallRisk: RiskLevel;
    overallScore: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  scans: {
    github?: GitHubRepoAnalysis[];
    cve?: CVEScanResult[];
    news?: NewsScanResult[];
    exposures?: ExposureScanResult[];
  };
  recommendations: string[];
}
