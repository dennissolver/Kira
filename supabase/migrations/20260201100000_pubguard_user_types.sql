-- PubGuard Migration: Add User-Type Support
-- Run this in Supabase SQL Editor
--
-- This adds columns needed for the 4 different user-type reports:
-- - Writer: Article-ready content, disclosure requirements
-- - Developer: Action items, remediation steps
-- - User: Plain-English verdict, simple recommendations
-- - Analyst: Full technical depth, exportable data

-- ============================================================================
-- ADD NEW COLUMNS TO pubguard_scans
-- ============================================================================

-- User type who initiated the scan
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS user_type TEXT
CHECK (user_type IN ('writer', 'developer', 'user', 'analyst'));

COMMENT ON COLUMN pubguard_scans.user_type IS
  'The type of user who initiated this scan (writer, developer, user, analyst)';

-- Session tracking for anonymous users
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS session_id TEXT;

COMMENT ON COLUMN pubguard_scans.session_id IS
  'Anonymous session ID for tracking user journey';

-- User ID for logged-in users (future)
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS user_id TEXT;

COMMENT ON COLUMN pubguard_scans.user_id IS
  'User ID if authenticated (for future use)';

-- Numeric risk score (0-100)
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS risk_score INTEGER
CHECK (risk_score >= 0 AND risk_score <= 100);

COMMENT ON COLUMN pubguard_scans.risk_score IS
  'Numeric risk score from 0 (safe) to 100 (dangerous)';

-- Target name (extracted repo name)
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS target_name TEXT;

COMMENT ON COLUMN pubguard_scans.target_name IS
  'Human-readable target name (e.g., "owner/repo")';

-- Scan duration for performance tracking
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS scan_duration_ms INTEGER;

COMMENT ON COLUMN pubguard_scans.scan_duration_ms IS
  'How long the scan took in milliseconds';

-- Report hash for verification
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS report_hash TEXT;

COMMENT ON COLUMN pubguard_scans.report_hash IS
  'Hash of report for verification/integrity';

-- Updated timestamp
ALTER TABLE pubguard_scans
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- ADD INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_user_type
  ON pubguard_scans(user_type);

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_session_id
  ON pubguard_scans(session_id);

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_user_id
  ON pubguard_scans(user_id);

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_risk_level
  ON pubguard_scans(risk_level);

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target
  ON pubguard_scans(target);

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_created_at
  ON pubguard_scans(created_at DESC);

-- Full text search on target
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target_search
  ON pubguard_scans USING gin(to_tsvector('english', target));

-- ============================================================================
-- UPDATE TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pubguard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pubguard_scans_updated_at ON pubguard_scans;
CREATE TRIGGER update_pubguard_scans_updated_at
  BEFORE UPDATE ON pubguard_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_pubguard_updated_at();

-- ============================================================================
-- HELPER VIEWS FOR EACH USER TYPE
-- ============================================================================

-- Writer View: Focus on recommendation and disclosure
CREATE OR REPLACE VIEW pubguard_writer_view AS
SELECT
  id,
  target,
  target_name,
  risk_level,
  risk_score,
  result->'writerGuidance' as writer_guidance,
  result->'findings'->'critical' as critical_findings,
  result->'findings'->'high' as high_findings,
  result->'findings'->'positive' as positive_findings,
  created_at
FROM pubguard_scans
WHERE user_type = 'writer';

-- Developer View: Focus on action items and fixes
CREATE OR REPLACE VIEW pubguard_developer_view AS
SELECT
  id,
  target,
  target_name,
  risk_level,
  risk_score,
  result->'findings' as findings,
  result->'cve' as cve_analysis,
  result->'securityTests' as security_tests,
  result->'github' as github_analysis,
  created_at
FROM pubguard_scans
WHERE user_type = 'developer';

-- User View: Focus on simple verdict
CREATE OR REPLACE VIEW pubguard_user_view AS
SELECT
  id,
  target,
  target_name,
  risk_level,
  risk_score,
  result->'findings'->'critical' as critical_findings,
  result->'findings'->'high' as high_findings,
  result->'findings'->'positive' as positive_findings,
  created_at
FROM pubguard_scans
WHERE user_type = 'user';

-- Analyst View: Full technical depth
CREATE OR REPLACE VIEW pubguard_analyst_view AS
SELECT
  id,
  target,
  target_name,
  risk_level,
  risk_score,
  result as full_result,
  result->'findings' as findings,
  result->'github' as github_analysis,
  result->'cve' as cve_analysis,
  result->'news' as news_analysis,
  result->'securityTests' as security_tests,
  result->'sourcesChecked' as sources_checked,
  report_hash,
  scan_duration_ms,
  created_at
FROM pubguard_scans
WHERE user_type = 'analyst';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get latest scan for a repo
CREATE OR REPLACE FUNCTION get_latest_pubguard_scan(repo_target TEXT)
RETURNS pubguard_scans AS $$
  SELECT * FROM pubguard_scans
  WHERE target ILIKE '%' || repo_target || '%'
  ORDER BY created_at DESC
  LIMIT 1;
$$ LANGUAGE SQL;

-- Get scan history for a repo
CREATE OR REPLACE FUNCTION get_pubguard_scan_history(
  repo_target TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS SETOF pubguard_scans AS $$
  SELECT * FROM pubguard_scans
  WHERE target ILIKE '%' || repo_target || '%'
  ORDER BY created_at DESC
  LIMIT limit_count;
$$ LANGUAGE SQL;

-- Search scans by target and optionally filter by risk level
CREATE OR REPLACE FUNCTION search_pubguard_scans(
  search_query TEXT,
  filter_risk_level TEXT DEFAULT NULL,
  filter_user_type TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS SETOF pubguard_scans AS $$
  SELECT * FROM pubguard_scans
  WHERE target ILIKE '%' || search_query || '%'
  AND (filter_risk_level IS NULL OR risk_level = filter_risk_level)
  AND (filter_user_type IS NULL OR user_type = filter_user_type)
  ORDER BY created_at DESC
  LIMIT limit_count;
$$ LANGUAGE SQL;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'PubGuard user-type columns added successfully!' AS status;

-- ============================================================================
-- VERIFY: Show current table structure
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pubguard_scans'
ORDER BY ordinal_position;