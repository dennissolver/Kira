-- Migration: Create PubGuard tables
-- Run this in Supabase SQL Editor

-- Table for storing scan results
CREATE TABLE IF NOT EXISTS pubguard_scans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('github', 'cve', 'news', 'exposure')),
  target TEXT NOT NULL,
  result JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  agent_id UUID REFERENCES kira_agents(id) ON DELETE SET NULL,
  conversation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_type ON pubguard_scans(type);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_risk ON pubguard_scans(risk_level);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_agent ON pubguard_scans(agent_id);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_created ON pubguard_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pubguard_scans_target ON pubguard_scans(target);

-- Table for generated reports
CREATE TABLE IF NOT EXISTS pubguard_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  agent_id UUID REFERENCES kira_agents(id) ON DELETE SET NULL,
  scan_ids TEXT[] NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL,
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  html_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pubguard_reports_agent ON pubguard_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_pubguard_reports_created ON pubguard_reports(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE pubguard_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pubguard_reports ENABLE ROW LEVEL SECURITY;

-- Policies for pubguard_scans
CREATE POLICY "Users can view scans from their agents" ON pubguard_scans
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert scans" ON pubguard_scans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can delete scans" ON pubguard_scans
  FOR DELETE USING (true);

-- Policies for pubguard_reports
CREATE POLICY "Users can view their reports" ON pubguard_reports
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert reports" ON pubguard_reports
  FOR INSERT WITH CHECK (true);

-- Function to clean up old scans (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_scans(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pubguard_scans
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE pubguard_scans IS 'Stores security scan results from PubGuard (GitHub, CVE, news, infrastructure)';
COMMENT ON TABLE pubguard_reports IS 'Stores generated security assessment reports';