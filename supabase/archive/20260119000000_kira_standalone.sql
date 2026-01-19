-- ============================================================================
-- KIRA STANDALONE - DATABASE SCHEMA (COMPLETE)
-- Migration: 20260119000000_kira_standalone.sql
-- ============================================================================
-- This is the complete schema for Kira including:
-- - Users with Stripe integration
-- - Kira Agents with configuration
-- - Conversations & Memory
-- - Knowledge Base (files & URLs)
-- - Setup Sessions
-- - User Feedback
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,

  -- Journey
  journey_type TEXT CHECK (journey_type IN ('personal', 'business')),

  -- Authentication
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'magic_link')),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified BOOLEAN DEFAULT false,

  -- Subscription & Stripe
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'cancelled', 'expired')),
  subscription_id TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================================================
-- KIRA AGENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS kira_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Agent identity (both columns for compatibility)
  agent_name TEXT,
  name TEXT,
  journey_type TEXT NOT NULL CHECK (journey_type IN ('personal', 'business')),

  -- ElevenLabs
  elevenlabs_agent_id TEXT UNIQUE NOT NULL,
  elevenlabs_tool_ids TEXT[] DEFAULT '{}',

  -- Agent configuration
  system_prompt TEXT,
  first_message TEXT,
  voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',

  -- Status (includes 'inactive' for canceled subscriptions)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused', 'deleted')),

  -- Usage stats
  total_conversations INT DEFAULT 0,
  total_minutes INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_conversation_at TIMESTAMPTZ,

  -- Ensure one agent per user per journey type
  UNIQUE(user_id, journey_type)
);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE CASCADE NOT NULL,

  -- ElevenLabs tracking
  elevenlabs_conversation_id TEXT UNIQUE,

  -- Session info
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,

  -- Content
  transcript_text TEXT,
  transcript_json JSONB,

  -- Topics discussed (for memory/continuity)
  topics TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- KIRA MEMORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS kira_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE CASCADE NOT NULL,

  -- Memory classification
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference',
    'context',
    'goal',
    'decision',
    'followup',
    'correction',
    'insight'
  )),

  -- The actual memory
  content TEXT NOT NULL,

  -- Source
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Retrieval
  importance INT DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  tags TEXT[] DEFAULT '{}',

  -- Validity
  active BOOLEAN DEFAULT true,
  superseded_by UUID REFERENCES kira_memory(id),

  -- Usage tracking
  recall_count INT DEFAULT 0,
  last_recalled_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- KNOWLEDGE FILES TABLE
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

-- ============================================================================
-- KNOWLEDGE URLS TABLE
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

-- ============================================================================
-- SETUP SESSIONS TABLE
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

-- ============================================================================
-- USER FEEDBACK TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Type
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'exit_interview',
    'in_conversation',
    'rating',
    'suggestion'
  )),

  -- Content
  content TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),

  -- Context
  conversation_id UUID REFERENCES conversations(id),

  -- For exit interviews
  exit_reason TEXT,
  would_return BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Kira Agents
CREATE INDEX IF NOT EXISTS idx_kira_agents_user ON kira_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_kira_agents_elevenlabs ON kira_agents(elevenlabs_agent_id);
CREATE INDEX IF NOT EXISTS idx_kira_agents_journey ON kira_agents(journey_type);
CREATE INDEX IF NOT EXISTS idx_kira_agents_status ON kira_agents(status);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_elevenlabs ON conversations(elevenlabs_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- Memory
CREATE INDEX IF NOT EXISTS idx_kira_memory_user ON kira_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_kira_memory_agent ON kira_memory(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_kira_memory_type ON kira_memory(memory_type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kira_memory_importance ON kira_memory(importance DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kira_memory_tags ON kira_memory USING gin(tags) WHERE active = true;

-- Knowledge Files
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user ON knowledge_files(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_agent ON knowledge_files(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(status);

-- Knowledge URLs
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_user ON knowledge_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_agent ON knowledge_urls(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_urls_status ON knowledge_urls(status);

-- Setup Sessions
CREATE INDEX IF NOT EXISTS idx_setup_sessions_token ON setup_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_setup_sessions_status ON setup_sessions(status);
CREATE INDEX IF NOT EXISTS idx_setup_sessions_expires ON setup_sessions(expires_at);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(feedback_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_kira_agents_updated ON kira_agents;
CREATE TRIGGER trg_kira_agents_updated BEFORE UPDATE ON kira_agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conversations_updated ON conversations;
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_kira_memory_updated ON kira_memory;
CREATE TRIGGER trg_kira_memory_updated BEFORE UPDATE ON kira_memory
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_setup_sessions_updated ON setup_sessions;
CREATE TRIGGER trg_setup_sessions_updated BEFORE UPDATE ON setup_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Agents - users can only see their own
DROP POLICY IF EXISTS "Users can view own agents" ON kira_agents;
CREATE POLICY "Users can view own agents" ON kira_agents
  FOR ALL USING (user_id = auth.uid());

-- Conversations - users can only see their own
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR ALL USING (user_id = auth.uid());

-- Memory - users can only see their own
DROP POLICY IF EXISTS "Users can view own memory" ON kira_memory;
CREATE POLICY "Users can view own memory" ON kira_memory
  FOR ALL USING (user_id = auth.uid());

-- Knowledge Files - users can only see their own
DROP POLICY IF EXISTS "Users can view own files" ON knowledge_files;
CREATE POLICY "Users can view own files" ON knowledge_files
  FOR ALL USING (user_id = auth.uid());

-- Knowledge URLs - users can only see their own
DROP POLICY IF EXISTS "Users can view own urls" ON knowledge_urls;
CREATE POLICY "Users can view own urls" ON knowledge_urls
  FOR ALL USING (user_id = auth.uid());

-- Feedback - users can only see their own
DROP POLICY IF EXISTS "Users can view own feedback" ON user_feedback;
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR ALL USING (user_id = auth.uid());

-- Service role bypass for API operations
DROP POLICY IF EXISTS "Service role full access users" ON users;
CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access agents" ON kira_agents;
CREATE POLICY "Service role full access agents" ON kira_agents
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access conversations" ON conversations;
CREATE POLICY "Service role full access conversations" ON conversations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access memory" ON kira_memory;
CREATE POLICY "Service role full access memory" ON kira_memory
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access files" ON knowledge_files;
CREATE POLICY "Service role full access files" ON knowledge_files
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access urls" ON knowledge_urls;
CREATE POLICY "Service role full access urls" ON knowledge_urls
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access setup_sessions" ON setup_sessions;
CREATE POLICY "Service role full access setup_sessions" ON setup_sessions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access feedback" ON user_feedback;
CREATE POLICY "Service role full access feedback" ON user_feedback
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- DONE! Complete Kira schema ready.
-- ============================================================================