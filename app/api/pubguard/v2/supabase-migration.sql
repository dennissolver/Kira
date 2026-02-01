-- PubGuard Supabase Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- MAIN SCANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pubguard_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Session
  user_id TEXT,                           -- Optional: logged in user
  session_id TEXT,                        -- Anonymous session tracking
  user_type TEXT CHECK (user_type IN ('writer', 'developer', 'user', 'analyst')),
  
  -- Target Info
  target_url TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_owner TEXT,                      -- GitHub owner
  
  -- Results Summary
  traffic_light TEXT NOT NULL CHECK (traffic_light IN ('green', 'amber', 'red')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  is_private_repo BOOLEAN DEFAULT false,
  
  -- Detailed Results (JSONB for flexibility)
  findings JSONB NOT NULL DEFAULT '{
    "critical": [],
    "high": [],
    "medium": [],
    "low": [],
    "positive": []
  }'::jsonb,
  
  github_analysis JSONB,                  -- Full GitHub analysis data
  cve_analysis JSONB,                     -- CVE findings
  news_analysis JSONB,                    -- News/social signals
  security_tests JSONB,                   -- Automated test results
  writer_guidance JSONB,                  -- Recommendation for writers
  sources_checked JSONB,                  -- What sources were checked
  
  -- Metadata
  scan_duration_ms INTEGER,
  report_hash TEXT,                       -- For verification
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pubguard_scans_user ON pubguard_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_session ON pubguard_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target_name ON pubguard_scans(target_name);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target_url ON pubguard_scans(target_url);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_traffic_light ON pubguard_scans(traffic_light);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_created ON pubguard_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_risk ON pubguard_scans(risk_score DESC);

-- Full text search on target name
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target_search 
  ON pubguard_scans USING gin(to_tsvector('english', target_name));

-- ============================================================================
-- SHARED REPORTS TABLE (for sharing scan results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pubguard_shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES pubguard_scans(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,       -- Short unique token for URL
  created_by TEXT,                        -- User who shared it
  expires_at TIMESTAMPTZ,                 -- Optional expiry
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pubguard_shared_token ON pubguard_shared_reports(share_token);

-- ============================================================================
-- SCAN COMPARISONS TABLE (track comparisons between scans)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pubguard_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id_old UUID NOT NULL REFERENCES pubguard_scans(id) ON DELETE CASCADE,
  scan_id_new UUID NOT NULL REFERENCES pubguard_scans(id) ON DELETE CASCADE,
  comparison_data JSONB,                  -- What changed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER WATCHLIST (repos to re-scan periodically)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pubguard_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  target_name TEXT NOT NULL,
  last_scan_id UUID REFERENCES pubguard_scans(id),
  scan_frequency TEXT DEFAULT 'weekly' CHECK (scan_frequency IN ('daily', 'weekly', 'monthly')),
  notify_on_change BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, target_url)
);

CREATE INDEX IF NOT EXISTS idx_pubguard_watchlist_user ON pubguard_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_pubguard_watchlist_active ON pubguard_watchlist(is_active) WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - enable if using Supabase Auth)
-- ============================================================================

-- ALTER TABLE pubguard_scans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pubguard_shared_reports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pubguard_watchlist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own scans + all shared scans
-- CREATE POLICY "Users can view own scans" ON pubguard_scans
--   FOR SELECT USING (
--     user_id = auth.uid()::text 
--     OR user_id IS NULL  -- Anonymous scans visible to all
--   );

-- Policy: Users can insert their own scans
-- CREATE POLICY "Users can insert scans" ON pubguard_scans
--   FOR INSERT WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for pubguard_scans
DROP TRIGGER IF EXISTS update_pubguard_scans_updated_at ON pubguard_scans;
CREATE TRIGGER update_pubguard_scans_updated_at
  BEFORE UPDATE ON pubguard_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pubguard_watchlist
DROP TRIGGER IF EXISTS update_pubguard_watchlist_updated_at ON pubguard_watchlist;
CREATE TRIGGER update_pubguard_watchlist_updated_at
  BEFORE UPDATE ON pubguard_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION: Get latest scan for a repo
-- ============================================================================

CREATE OR REPLACE FUNCTION get_latest_scan(repo_name TEXT)
RETURNS pubguard_scans AS $$
  SELECT * FROM pubguard_scans 
  WHERE target_name ILIKE repo_name 
     OR target_url ILIKE '%' || repo_name || '%'
  ORDER BY created_at DESC 
  LIMIT 1;
$$ LANGUAGE SQL;

-- ============================================================================
-- HELPER FUNCTION: Get scan history for a repo
-- ============================================================================

CREATE OR REPLACE FUNCTION get_scan_history(repo_name TEXT, limit_count INTEGER DEFAULT 10)
RETURNS SETOF pubguard_scans AS $$
  SELECT * FROM pubguard_scans 
  WHERE target_name ILIKE repo_name 
     OR target_url ILIKE '%' || repo_name || '%'
  ORDER BY created_at DESC 
  LIMIT limit_count;
$$ LANGUAGE SQL;

-- ============================================================================
-- HELPER FUNCTION: Search scans
-- ============================================================================

CREATE OR REPLACE FUNCTION search_scans(
  search_query TEXT,
  filter_traffic_light TEXT DEFAULT NULL,
  filter_user_id TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS SETOF pubguard_scans AS $$
  SELECT * FROM pubguard_scans 
  WHERE (
    target_name ILIKE '%' || search_query || '%'
    OR target_url ILIKE '%' || search_query || '%'
  )
  AND (filter_traffic_light IS NULL OR traffic_light = filter_traffic_light)
  AND (filter_user_id IS NULL OR user_id = filter_user_id)
  ORDER BY created_at DESC 
  LIMIT limit_count;
$$ LANGUAGE SQL;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'PubGuard tables created successfully!' AS status;
