-- ============================================================================
-- KIRA - SCHEMA UPDATE MIGRATION (FIXED)
-- Migration: 20260119000001_add_knowledge_and_setup.sql
-- ============================================================================

-- ============================================================================
-- 0. CREATE TRIGGER FUNCTION FIRST (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO USERS
-- ============================================================================

-- Add journey_type if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS journey_type TEXT
  CHECK (journey_type IN ('personal', 'business'));

-- Add subscription_id if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- Update subscription_id from stripe_subscription_id if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_subscription_id') THEN
    UPDATE users SET subscription_id = stripe_subscription_id WHERE subscription_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO KIRA_AGENTS
-- ============================================================================

-- Add name column (maps to agent_name)
ALTER TABLE kira_agents ADD COLUMN IF NOT EXISTS name TEXT;

-- Copy from agent_name if exists
UPDATE kira_agents SET name = agent_name WHERE name IS NULL AND agent_name IS NOT NULL;

-- Add configuration columns
ALTER TABLE kira_agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE kira_agents ADD COLUMN IF NOT EXISTS first_message TEXT;
ALTER TABLE kira_agents ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL';

-- Update status constraint to include 'inactive'
ALTER TABLE kira_agents DROP CONSTRAINT IF EXISTS kira_agents_status_check;
ALTER TABLE kira_agents ADD CONSTRAINT kira_agents_status_check
  CHECK (status IN ('active', 'inactive', 'paused', 'deleted'));

-- ============================================================================
-- 3. ADD KNOWLEDGE FILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE CASCADE,

  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Storage
  storage_path TEXT,
  storage_bucket TEXT DEFAULT 'knowledge-files',

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,

  -- Extracted content
  extracted_text TEXT,
  chunk_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user ON knowledge_files(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_agent ON knowledge_files(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(status);

-- RLS
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own files" ON knowledge_files;
CREATE POLICY "Users can view own files" ON knowledge_files
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access files" ON knowledge_files;
CREATE POLICY "Service role full access files" ON knowledge_files
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. ADD KNOWLEDGE URLS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE CASCADE,

  -- URL info
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'crawling', 'ready', 'error')),
  error_message TEXT,

  -- Extracted content
  extracted_text TEXT,
  chunk_count INTEGER DEFAULT 0,

  -- Crawl metadata
  last_crawled_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_user ON knowledge_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_agent ON knowledge_urls(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_status ON knowledge_urls(status);

-- RLS
ALTER TABLE knowledge_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own urls" ON knowledge_urls;
CREATE POLICY "Users can view own urls" ON knowledge_urls
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access urls" ON knowledge_urls;
CREATE POLICY "Service role full access urls" ON knowledge_urls
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. ADD SETUP SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS setup_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session tracking
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

  -- Journey info gathered from Setup Kira
  journey_type TEXT CHECK (journey_type IN ('personal', 'business')),

  -- Data collected during conversation
  collected_data JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'expired')),

  -- Resulting user/agent (linked after completion)
  user_id UUID REFERENCES users(id),
  kira_agent_id UUID REFERENCES kira_agents(id),

  -- ElevenLabs conversation tracking
  elevenlabs_conversation_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_setup_sessions_token ON setup_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_setup_sessions_status ON setup_sessions(status);
CREATE INDEX IF NOT EXISTS idx_setup_sessions_expires ON setup_sessions(expires_at);

-- RLS
ALTER TABLE setup_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access setup_sessions" ON setup_sessions;
CREATE POLICY "Service role full access setup_sessions" ON setup_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_setup_sessions_updated ON setup_sessions;
CREATE TRIGGER trg_setup_sessions_updated BEFORE UPDATE ON setup_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE! Schema update complete.
-- ============================================================================