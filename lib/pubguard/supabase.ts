// lib/pubguard/supabase.ts
// PubGuard Supabase integration - matches actual table schema

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Type for the actual pubguard_scans table
interface PubGuardScanRow {
  id: string;
  type: string;
  target: string;
  result: Record<string, any>;
  risk_level: string;
  agent_id?: string;
  conversation_id?: string;
  created_at?: string;
  user_type?: string;
  session_id?: string;
  user_id?: string;
  risk_score?: number;
  target_name?: string;
  scan_duration_ms?: number;
  report_hash?: string;
  updated_at?: string;
}

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('[PubGuard] Supabase not configured');
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

// Generate a unique scan ID
function generateScanId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save scan results to Supabase
 * Maps the PubGuardReport to the actual table schema
 */
export async function saveScanToSupabase(
  report: any, // PubGuardReport type
  durationMs: number,
  userId?: string,
  sessionId?: string,
  userType?: 'writer' | 'developer' | 'user' | 'analyst',
  agentId?: string,
  conversationId?: string
): Promise<{ id: string } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('[PubGuard] Supabase not configured, skipping save');
    return null;
  }

  // Map trafficLight to risk_level (your table uses risk_level)
  const riskLevel = report.trafficLight || report.risk_level || 'amber';

  // Extract target name from report
  const targetName = report.target?.name ||
                     report.targetName ||
                     report.target?.url?.split('/').pop() ||
                     'unknown';

  // Build the row matching your actual schema
  const scanRow: Partial<PubGuardScanRow> = {
    id: generateScanId(),
    type: 'github', // or could be 'npm_scan', 'pypi_scan' etc
    target: report.target?.url || report.targetUrl || report.target || '',

    // Store ALL scan data in the result JSONB column
    result: {
      // Core results
      trafficLight: report.trafficLight,
      overallRiskScore: report.overallRiskScore,
      recommendation: report.recommendation,

      // Target info
      target: report.target,

      // Detailed analysis
      findings: report.findings,
      github: report.github,
      cve: report.cve,
      news: report.news,
      social: report.social,
      securityTests: report.securityTests,

      // Guidance for different user types
      writerGuidance: report.writerGuidance,
      developerGuidance: report.developerGuidance,
      userGuidance: report.userGuidance,
      analystData: report.analystData,

      // Sources and metadata
      sourcesChecked: report.sourcesChecked,
      searchTermsUsed: report.searchTermsUsed,

      // Timestamps
      generatedAt: report.generatedAt,
      disclaimer: report.disclaimer,
    },

    risk_level: riskLevel,

    // Optional fields
    agent_id: agentId || undefined,
    conversation_id: conversationId || undefined,

    // New columns we added
    user_type: userType || undefined,
    session_id: sessionId || undefined,
    user_id: userId || undefined,
    risk_score: report.overallRiskScore || undefined,
    target_name: targetName,
    scan_duration_ms: durationMs,
    report_hash: report.reportHash || undefined,
  };

  try {
    const { data, error } = await supabase
      .from('pubguard_scans')
      .insert(scanRow)
      .select('id')
      .single();

    if (error) {
      console.error('[PubGuard] Supabase insert error:', error);
      return null;
    }

    console.log(`[PubGuard] Saved scan to Supabase: ${data.id}`);
    return data;
  } catch (err) {
    console.error('[PubGuard] Supabase save failed:', err);
    return null;
  }
}

/**
 * Get a scan by ID
 */
export async function getScanById(scanId: string): Promise<PubGuardScanRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error) {
    console.error('[PubGuard] Get scan error:', error);
    return null;
  }

  return data;
}

/**
 * Get latest scan for a target
 */
export async function getLatestScan(target: string): Promise<PubGuardScanRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .ilike('target', `%${target}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[PubGuard] Get latest scan error:', error);
    return null;
  }

  return data || null;
}

/**
 * Get scan history for a target
 */
export async function getScanHistory(
  target: string,
  limit: number = 10
): Promise<PubGuardScanRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .ilike('target', `%${target}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PubGuard] Get scan history error:', error);
    return [];
  }

  return data || [];
}

/**
 * Get scans by user type
 */
export async function getScansByUserType(
  userType: 'writer' | 'developer' | 'user' | 'analyst',
  limit: number = 20
): Promise<PubGuardScanRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .eq('user_type', userType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PubGuard] Get scans by user type error:', error);
    return [];
  }

  return data || [];
}

/**
 * Get recent scans for a session
 */
export async function getSessionScans(
  sessionId: string,
  limit: number = 10
): Promise<PubGuardScanRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PubGuard] Get session scans error:', error);
    return [];
  }

  return data || [];
}

/**
 * Extract user-type-specific data from a scan result
 */
export function extractUserTypeData(
  scan: PubGuardScanRow,
  userType: 'writer' | 'developer' | 'user' | 'analyst'
): Record<string, any> {
  const result = scan.result || {};

  switch (userType) {
    case 'writer':
      return {
        canRecommend: result.writerGuidance?.canRecommend,
        mustDisclose: result.writerGuidance?.mustDisclose || [],
        suggestedCaveats: result.writerGuidance?.suggestedCaveats || [],
        criticalFindings: result.findings?.critical || [],
        highFindings: result.findings?.high || [],
        positiveIndicators: result.findings?.positive || [],
        riskLevel: scan.risk_level,
        riskScore: scan.risk_score,
      };

    case 'developer':
      return {
        findings: result.findings,
        cveAnalysis: result.cve,
        securityTests: result.securityTests,
        githubAnalysis: result.github,
        actionItems: [
          ...(result.findings?.critical || []),
          ...(result.findings?.high || []),
          ...(result.findings?.medium || []),
        ],
        riskLevel: scan.risk_level,
        riskScore: scan.risk_score,
      };

    case 'user':
      return {
        verdict: scan.risk_level === 'green' ? 'Safe to Use' :
                 scan.risk_level === 'amber' ? 'Use with Caution' : 'Not Recommended',
        verdictEmoji: scan.risk_level === 'green' ? '✅' :
                      scan.risk_level === 'amber' ? '⚠️' : '🚫',
        shouldInstall: scan.risk_level !== 'red',
        mainConcerns: result.findings?.critical?.slice(0, 3) || [],
        positivePoints: result.findings?.positive?.slice(0, 3) || [],
        riskLevel: scan.risk_level,
      };

    case 'analyst':
      return {
        fullResult: result,
        findings: result.findings,
        github: result.github,
        cve: result.cve,
        news: result.news,
        securityTests: result.securityTests,
        sourcesChecked: result.sourcesChecked,
        riskScore: scan.risk_score,
        riskLevel: scan.risk_level,
        reportHash: scan.report_hash,
        scanDuration: scan.scan_duration_ms,
      };

    default:
      return result;
  }
}