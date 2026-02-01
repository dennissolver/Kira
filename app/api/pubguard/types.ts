// app/api/pubguard/types.ts
// Shared types for PubGuard v1 routes (exposures, save, webhook)
// Note: V2 has its own types in v2/types.ts

// =============================================================================
// COMMON TYPES
// =============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ScanType = 'github' | 'cve' | 'news' | 'exposure' | 'full';

// =============================================================================
// EXPOSURE SCANNER TYPES (exposures/route.ts)
// =============================================================================

// Certificate info for SSL checks
export interface CertificateInfo {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  daysUntilExpiry: number;
}

// Security header info
export interface SecurityHeaderInfo {
  name: string;
  present: boolean;
  value?: string;
}

// Port info
export interface PortInfo {
  port: number;
  protocol: string;
  service: string;
  version?: string;
  vulnerable: boolean;
}

// Main exposure result type
export interface ExposureResult {
  ip?: string;
  domain?: string;
  ports: PortInfo[];
  certificates?: CertificateInfo[];
  headers?: {
    server?: string;
    securityHeaders: SecurityHeaderInfo[];
  };
  riskFactors: string[];
  riskScore: number;
  riskLevel: RiskLevel;
}

// Exposure scan result wrapper
export interface ExposureScanResult {
  target: string;
  type: 'ip' | 'domain';
  exposure: ExposureResult;
  scannedAt: string;
}

// =============================================================================
// SAVE ROUTE TYPES (save/route.ts)
// =============================================================================

// ScanResult - used by save route
export interface ScanResult {
  id: string;
  type: ScanType;
  target: string;
  result: Record<string, unknown>;
  riskLevel: RiskLevel;
  createdAt: string;
  agentId?: string;
  conversationId?: string;
}

// Database record shape (snake_case for Supabase)
export interface ScanRecord {
  id: string;
  type: ScanType;
  target: string;
  result: string; // JSON stringified
  risk_level: RiskLevel;
  agent_id?: string | null;
  conversation_id?: string | null;
  created_at: string;
}

// =============================================================================
// WEBHOOK TYPES (webhook/route.ts)
// =============================================================================

export interface PubGuardWebhookPayload {
  tool_name: string;
  parameters: {
    url?: string;
    target?: string;
    action?: string;
    scan_type?: ScanType;
    [key: string]: unknown;
  };
  conversation_id: string;
  agent_id?: string;
}

export interface PubGuardWebhookResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  speak?: string; // What Kira should say
}

// =============================================================================
// GITHUB SCANNER TYPES (if needed by v1)
// =============================================================================

export interface GitHubScanResult {
  url: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: string;
  hasSecurityPolicy: boolean;
  license: string | null;
  riskLevel: RiskLevel;
  riskFactors: string[];
}

// =============================================================================
// CVE SCANNER TYPES (if needed by v1)
// =============================================================================

export interface CVEResult {
  id: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvssScore: number | null;
  publishedDate: string;
  affectedVersions: string[];
}

export interface CVEScanResult {
  searchTerm: string;
  totalFound: number;
  vulnerabilities: CVEResult[];
  highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
}

// =============================================================================
// NEWS SCANNER TYPES (if needed by v1)
// =============================================================================

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  isSecurityRelated: boolean;
}

export interface NewsScanResult {
  searchTerm: string;
  totalFound: number;
  articles: NewsArticle[];
  securityWarnings: NewsArticle[];
}