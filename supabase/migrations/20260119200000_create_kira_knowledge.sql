-- supabase/migrations/20250119_create_kira_knowledge_v3_fixed.sql
-- Knowledge base for Kira's collaborative research with users
-- This migration handles existing tables and adds missing columns

-- =============================================================================
-- KIRA KNOWLEDGE TABLE - Add missing columns if table exists
-- =============================================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS kira_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('kira_research', 'user_upload', 'user_url', 'user_note')),
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT NOT NULL,
  key_points TEXT[] DEFAULT '{}',
  relevance_note TEXT,
  raw_content TEXT,
  tags TEXT[] DEFAULT '{}',
  topic TEXT,
  token_count INTEGER DEFAULT 0,
  search_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL CHECK (created_by IN ('kira', 'user'))
);

-- Add missing columns to existing table (safe - won't error if they exist)
DO $$
BEGIN
  -- Add search_session_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'search_session_id'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN search_session_id UUID;
  END IF;

  -- Add token_count if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'token_count'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN token_count INTEGER DEFAULT 0;
  END IF;

  -- Add raw_content if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'raw_content'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN raw_content TEXT;
  END IF;

  -- Add relevance_note if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'relevance_note'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN relevance_note TEXT;
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add search_vector column for full-text search (TSVECTOR type)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kira_knowledge' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE kira_knowledge ADD COLUMN search_vector TSVECTOR;
  END IF;
END $$;

-- =============================================================================
-- RESEARCH SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS kira_research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  searches_used INTEGER DEFAULT 0,
  max_searches INTEGER DEFAULT 3,
  tokens_used INTEGER DEFAULT 0,
  max_tokens INTEGER DEFAULT 10000,
  urls_fetched INTEGER DEFAULT 0,
  max_urls INTEGER DEFAULT 5,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  completed_at TIMESTAMPTZ,
  kira_findings_count INTEGER DEFAULT 0,
  user_findings_count INTEGER DEFAULT 0,
  synthesis TEXT
);

-- =============================================================================
-- TRIGGER TO MAINTAIN SEARCH VECTOR
-- =============================================================================

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_kira_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    array_to_string(coalesce(NEW.key_points, '{}'), ' ')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_kira_knowledge_search_vector ON kira_knowledge;
CREATE TRIGGER trigger_kira_knowledge_search_vector
  BEFORE INSERT OR UPDATE OF title, summary, key_points ON kira_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_kira_knowledge_search_vector();

-- Backfill existing rows (if any)
UPDATE kira_knowledge
SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(summary, '') || ' ' ||
  array_to_string(coalesce(key_points, '{}'), ' ')
)
WHERE search_vector IS NULL;

-- =============================================================================
-- INDEXES
-- =============================================================================

DO $$
BEGIN
  -- kira_knowledge indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_user_id') THEN
    CREATE INDEX idx_kira_knowledge_user_id ON kira_knowledge(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_agent_id') THEN
    CREATE INDEX idx_kira_knowledge_agent_id ON kira_knowledge(kira_agent_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_topic') THEN
    CREATE INDEX idx_kira_knowledge_topic ON kira_knowledge(topic);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_source_type') THEN
    CREATE INDEX idx_kira_knowledge_source_type ON kira_knowledge(source_type);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_created_at') THEN
    CREATE INDEX idx_kira_knowledge_created_at ON kira_knowledge(created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_session') THEN
    CREATE INDEX idx_kira_knowledge_session ON kira_knowledge(search_session_id);
  END IF;

  -- GIN index on the pre-computed search_vector column (THIS IS THE FIX)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kira_knowledge_search') THEN
    CREATE INDEX idx_kira_knowledge_search ON kira_knowledge USING GIN (search_vector);
  END IF;

  -- kira_research_sessions indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_research_sessions_user') THEN
    CREATE INDEX idx_research_sessions_user ON kira_research_sessions(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_research_sessions_status') THEN
    CREATE INDEX idx_research_sessions_status ON kira_research_sessions(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_research_sessions_active') THEN
    CREATE INDEX idx_research_sessions_active ON kira_research_sessions(user_id, status) WHERE status = 'active';
  END IF;
END $$;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_kira_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kira_knowledge_updated_at ON kira_knowledge;
CREATE TRIGGER trigger_kira_knowledge_updated_at
  BEFORE UPDATE ON kira_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_kira_knowledge_updated_at();

CREATE OR REPLACE FUNCTION check_research_session_limits(session_id UUID)
RETURNS TABLE (
  can_search BOOLEAN,
  can_fetch BOOLEAN,
  searches_remaining INTEGER,
  tokens_remaining INTEGER,
  urls_remaining INTEGER,
  is_expired BOOLEAN
) AS $$
DECLARE
  session kira_research_sessions%ROWTYPE;
BEGIN
  SELECT * INTO session FROM kira_research_sessions WHERE id = session_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0, 0, 0, true;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (session.searches_used < session.max_searches AND session.status = 'active' AND NOW() < session.expires_at),
    (session.urls_fetched < session.max_urls AND session.tokens_used < session.max_tokens AND session.status = 'active' AND NOW() < session.expires_at),
    (session.max_searches - session.searches_used)::INTEGER,
    (session.max_tokens - session.tokens_used)::INTEGER,
    (session.max_urls - session.urls_fetched)::INTEGER,
    (NOW() >= session.expires_at);
END;
$$ LANGUAGE plpgsql;

-- Updated search function to use the pre-computed search_vector column
CREATE OR REPLACE FUNCTION search_kira_knowledge(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  key_points TEXT[],
  url TEXT,
  source_type TEXT,
  relevance_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.title,
    k.summary,
    k.key_points,
    k.url,
    k.source_type,
    k.relevance_note,
    k.created_by,
    k.created_at,
    ts_rank(k.search_vector, plainto_tsquery('english', p_query)) AS rank
  FROM kira_knowledge k
  WHERE k.user_id = p_user_id
    AND (
      k.search_vector @@ plainto_tsquery('english', p_query)
      OR k.title ILIKE '%' || p_query || '%'
      OR k.summary ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, k.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE kira_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_research_sessions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own knowledge" ON kira_knowledge;
  DROP POLICY IF EXISTS "Users can insert own knowledge" ON kira_knowledge;
  DROP POLICY IF EXISTS "Users can update own knowledge" ON kira_knowledge;
  DROP POLICY IF EXISTS "Users can delete own knowledge" ON kira_knowledge;
  DROP POLICY IF EXISTS "Service role full access to knowledge" ON kira_knowledge;

  DROP POLICY IF EXISTS "Users can view own sessions" ON kira_research_sessions;
  DROP POLICY IF EXISTS "Users can insert own sessions" ON kira_research_sessions;
  DROP POLICY IF EXISTS "Users can update own sessions" ON kira_research_sessions;
  DROP POLICY IF EXISTS "Service role full access to sessions" ON kira_research_sessions;
END $$;

CREATE POLICY "Users can view own knowledge" ON kira_knowledge
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge" ON kira_knowledge
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge" ON kira_knowledge
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own knowledge" ON kira_knowledge
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to knowledge" ON kira_knowledge
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own sessions" ON kira_research_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON kira_research_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON kira_research_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to sessions" ON kira_research_sessions
  FOR ALL USING (auth.role() = 'service_role');