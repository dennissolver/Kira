-- Migration: Add kira_drafts table for Setup Kira → Operational Kira handoff
--
-- FLOW:
-- 1. Setup Kira calls save_framework_draft → inserts row here
-- 2. UI polls/listens for new drafts with status='draft'
-- 3. User reviews at /setup/draft/[id]
-- 4. User submits → status='approved' → Operational Kira created
-- 5. Row updated with agent_id reference

-- Create kira_drafts table
CREATE TABLE IF NOT EXISTS kira_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User info (collected by Setup Kira)
  user_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  location TEXT NOT NULL,

  -- Journey configuration
  journey_type TEXT NOT NULL CHECK (journey_type IN ('personal', 'business')),

  -- The framework/brief
  primary_objective TEXT NOT NULL,
  key_context JSONB DEFAULT '[]'::jsonb,
  success_definition TEXT,
  constraints JSONB DEFAULT '[]'::jsonb,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'created', 'expired')),

  -- Links to other entities
  elevenlabs_conversation_id TEXT,  -- Setup conversation ID
  agent_id UUID REFERENCES kira_agents(id),  -- Operational Kira (after creation)

  -- User edits (from review page)
  user_edits JSONB,  -- Track what user changed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,

  -- Session tracking (to match draft to correct browser session)
  session_id TEXT
);

-- Index for polling/realtime detection
CREATE INDEX IF NOT EXISTS idx_kira_drafts_status_created
ON kira_drafts(status, created_at DESC);

-- Index for finding user's drafts
CREATE INDEX IF NOT EXISTS idx_kira_drafts_user_name
ON kira_drafts(user_name);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kira_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kira_drafts_updated_at
  BEFORE UPDATE ON kira_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_kira_drafts_updated_at();

-- Enable realtime for draft detection
ALTER PUBLICATION supabase_realtime ADD TABLE kira_drafts;

-- RLS policies (adjust based on your auth setup)
ALTER TABLE kira_drafts ENABLE ROW LEVEL SECURITY;

-- Allow inserts from service role (webhooks)
CREATE POLICY "Service role can insert drafts"
ON kira_drafts FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow reads for draft detection (adjust as needed)
CREATE POLICY "Allow reading drafts"
ON kira_drafts FOR SELECT
TO anon, authenticated
USING (true);

-- Allow updates for approval flow
CREATE POLICY "Allow updating drafts"
ON kira_drafts FOR UPDATE
TO anon, authenticated
USING (true);

COMMENT ON TABLE kira_drafts IS 'Stores framework drafts created by Setup Kira for user review before creating Operational Kira';