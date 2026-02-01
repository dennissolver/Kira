// app/api/pubguard/v2/types.ts
// PubGuard v2 - Comprehensive Security Assessment Types

export type TrafficLight = 'green' | 'amber' | 'red';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Source tracking for transparency
export interface SourceCheck {
  name: string;
  searched: string[];
  found: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  timestamp: string;
  note?: string;  // Optional note for skipped/failed status
}

// Individual finding with source attribution
export interface Finding {
  severity: RiskLevel;
  category: string;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  date?: string;
}

// Risk category scoring
export interface RiskCategory {
  name: string;
  description: string;
  score: number;        // 0-100 (higher = more risky)
  weight: number;       // 0-1 (importance multiplier)
  weightedScore: number;
  factors: string[];    // What contributed to this score
}

// GitHub deep analysis
export interface GitHubAnalysis {
  url: string;
  owner: string;
  name: string;
  description: string;
  
  // Basic metrics
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  
  // Temporal
  createdAt: string;
  lastCommit: string;
  daysSinceLastCommit: number;
  ageInDays: number;
  
  // Content (for security analysis)
  readme: string;
  hasSecurityMd: boolean;
  securityMdContent?: string;
  
  // Security indicators
  hasSecurityPolicy: boolean;
  securityPolicyContent?: string;
  hasSecurityAdvisories: boolean;
  securityAdvisoriesCount: number;
  
  // Permission analysis (from README/docs)
  permissions: {
    shellAccess: boolean;
    fileSystemAccess: boolean;
    networkAccess: boolean;
    credentialStorage: boolean;
    browserControl: boolean;
    rootRequired: boolean;
  };
  
  // Recent security-related activity
  recentSecurityCommits: {
    sha: string;
    message: string;
    date: string;
  }[];
  
  securityLabeledIssues: {
    title: string;
    url: string;
    state: string;
    createdAt: string;
  }[];
  
  // Maintainer info
  contributors: number;
  topContributors: string[];
  
  // License & compliance
  license: string | null;
  hasCodeOfConduct: boolean;
  hasContributing: boolean;
  
  // Velocity analysis
  starsPerDay: number;
  isViralGrowth: boolean;  // >1000 stars/day = viral
  
  // Rename/rebrand detection
  previousNames: string[];
  recentRename: boolean;
}

// CVE/Vulnerability data
export interface CVEFinding {
  id: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvssScore: number | null;
  publishedDate: string;
  affectedVersions: string[];
  references: string[];
  status: 'open' | 'fixed' | 'disputed';
}

export interface CVEAnalysis {
  searchTerms: string[];
  totalFound: number;
  vulnerabilities: CVEFinding[];
  highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
}

// News/media analysis
export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'warning';
  isSecurityWarning: boolean;
  authorCredibility?: 'high' | 'medium' | 'low';
}

export interface NewsAnalysis {
  searchTerms: string[];
  totalFound: number;
  articles: NewsArticle[];
  securityWarnings: NewsArticle[];
  expertWarnings: {
    name: string;
    title: string;
    organization: string;
    quote: string;
    source: string;
    date: string;
  }[];
}

// Social/researcher signals
export interface SocialSignal {
  platform: 'twitter' | 'hackernews' | 'reddit' | 'linkedin';
  author: string;
  authorCredibility: 'security_researcher' | 'industry_expert' | 'developer' | 'unknown';
  content: string;
  url: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'warning';
  engagement: number;  // likes, upvotes, etc.
}

export interface SocialAnalysis {
  searchTerms: string[];
  signals: SocialSignal[];
  securityResearcherWarnings: SocialSignal[];
  overallSentiment: 'positive' | 'mixed' | 'negative';
}

// Codebase analysis
export interface CodebaseAnalysis {
  securityMdAnalysis: {
    exists: boolean;
    content?: string;
    mentionsKnownRisks: boolean;
    hasResponsibleDisclosure: boolean;
    acknowledgesLimitations: boolean;
    outOfScopeItems: string[];
  };
  
  readmeAnalysis: {
    mentionsSecurityRisks: boolean;
    requiresExpertSetup: boolean;
    warningsFound: string[];
  };
  
  configAnalysis: {
    defaultsAreSecure: boolean;
    riskyDefaults: string[];
    sandboxAvailable: boolean;
    sandboxDefault: boolean;
  };
  
  credentialPatterns: {
    plaintextStorage: boolean;
    encryptedStorage: boolean;
    storageLocations: string[];
  };
  
  permissionScope: {
    requiresShellAccess: boolean;
    requiresRootAccess: boolean;
    requiresFileSystemAccess: boolean;
    requiresNetworkAccess: boolean;
    requiresBrowserControl: boolean;
    apiIntegrations: string[];
  };
}

// Writer guidance
export interface WriterGuidance {
  canRecommend: boolean;
  mustDisclose: string[];
  suggestedDisclaimer: string;
  keyPointsToMention: string[];
  alternativesToConsider: string[];
}

// Complete report
export interface PubGuardReport {
  id: string;
  version: '2.0';
  generatedAt: string;
  scanId?: string;  // Database ID after saving to Supabase
  
  // Target info
  target: {
    url: string;
    name: string;
    owner?: string;
    type: 'github_repo' | 'npm_package' | 'domain';
    isPrivate?: boolean;
  };
  
  // Traffic light (the key output)
  trafficLight: TrafficLight;
  recommendation: 'SAFE_TO_RECOMMEND' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_RECOMMEND';
  
  // Overall scoring
  overallRiskScore: number;  // 0-100
  riskCategories: RiskCategory[];
  
  // Source transparency
  sourcesChecked: SourceCheck[];
  searchTermsUsed: string[];
  
  // Detailed findings
  findings: {
    critical: Finding[];
    high: Finding[];
    medium: Finding[];
    low: Finding[];
    positive: Finding[];  // Good things found
  };
  
  // Analysis sections
  github: GitHubAnalysis | null;
  cve: CVEAnalysis | null;
  news: NewsAnalysis | null;
  social: SocialAnalysis | null;
  codebase: CodebaseAnalysis | null;
  securityTests?: SecurityTestsAnalysis | null;  // Automated security test results
  
  // For tech writers
  writerGuidance: WriterGuidance;
  
  // Liability
  disclaimer: string;
  reportHash: string;  // For verification
}

// Scan request
export interface ScanRequest {
  url: string;
  includeCodebaseAnalysis?: boolean;
  includeSocialSignals?: boolean;
  includeSecurityTests?: boolean;
  customSearchTerms?: string[];
  userId?: string;       // For Supabase tracking
  sessionId?: string;    // Anonymous session tracking
  userType?: 'writer' | 'developer' | 'user' | 'analyst';
}

// Automated Security Test Results
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

// Test categories for expert methodology
export type SecurityTestCategory = 
  | 'credentials'      // How credentials are stored
  | 'permissions'      // What permissions are required
  | 'injection'        // Prompt injection vulnerability
  | 'supply-chain'     // Third-party code risks
  | 'configuration'    // Default config security
  | 'exposure'         // Internet exposure (Shodan)
  | 'identity'         // Rename/rebrand detection
  | 'maintenance';     // Maintainer responsiveness
