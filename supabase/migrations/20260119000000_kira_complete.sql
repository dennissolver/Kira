-- ============================================================================
-- KIRA PLATFORM - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Migration: 20260119000000_kira_complete.sql
-- 
-- This is the SINGLE SOURCE OF TRUTH for the Kira database schema.
-- Run this once on a fresh Supabase project.
--
-- Includes:
--   1. Core Tables (users, kira_agents, conversations, kira_memory)
--   2. Knowledge Base (knowledge_files, knowledge_urls)
--   3. Setup Sessions (setup_sessions)
--   4. Conversation Continuity (conversation_messages)
--   5. Email System (email_logs)
--   6. User Feedback (user_feedback)
--   7. All Indexes, Triggers, Functions, and RLS Policies
--
-- ============================================================================


-- ============================================================================
-- CLEAN SLATE: DROP EVERYTHING FIRST
-- ============================================================================
-- Drop tables first (CASCADE handles triggers, indexes, policies automatically)
-- Order matters due to foreign keys - drop dependent tables first

DROP TABLE IF EXISTS user_feedback CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS kira_memory CASCADE;
DROP TABLE IF EXISTS knowledge_urls CASCADE;
DROP TABLE IF EXISTS knowledge_files CASCADE;
DROP TABLE IF EXISTS setup_sessions CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS kira_agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions (after tables since tables might depend on them)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_on_message() CASCADE;
DROP FUNCTION IF EXISTS should_send_email(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_users_for_reengagement(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_conversation_context(UUID, UUID, INTEGER) CASCADE;


-- ============================================================================
-- Enable required extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  first_name TEXT,
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
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'trialing', 'active', 'past_due', 'canceled', 'cancelled', 'expired')),
  subscription_id TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,

  -- Email preferences (for email system)
  email_preferences JSONB DEFAULT '{
    "kira_ready": true,
    "welcome_back": true,
    "weekly_summary": false,
    "feature_announcements": true
  }'::jsonb,
  last_email_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);


-- ============================================================================
-- 2. KIRA AGENTS TABLE
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
-- 3. CONVERSATIONS TABLE
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

  -- Conversation continuity fields
  last_topic TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  summary TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 4. CONVERSATION MESSAGES TABLE (for seamless continuation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kira_agent_id UUID NOT NULL REFERENCES kira_agents(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- For voice conversations (from ElevenLabs)
  audio_url TEXT,
  duration_ms INTEGER,

  -- Message metadata
  message_index INTEGER,

  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 5. KIRA MEMORY TABLE
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
-- 6. KNOWLEDGE FILES TABLE
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
-- 7. KNOWLEDGE URLS TABLE
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
-- 8. SETUP SESSIONS TABLE
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
-- 9. EMAIL LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,

  -- What
  email_type TEXT NOT NULL CHECK (email_type IN (
    'kira_ready',
    'welcome_back',
    'magic_link',
    'subscription_confirm',
    'subscription_reminder',
    'weekly_summary',
    'feature_announcement'
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),

  -- Tracking
  resend_id TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 10. USER FEEDBACK TABLE
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
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(kira_agent_id, last_message_at DESC);

-- Conversation Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent ON conversation_messages(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON conversation_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_index ON conversation_messages(conversation_id, message_index);

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

-- Email Logs
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend ON email_logs(resend_id);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(feedback_type);


-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Update conversation stats when new message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.timestamp,
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Check if user should receive email type
CREATE OR REPLACE FUNCTION should_send_email(
  p_user_id UUID,
  p_email_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  prefs JSONB;
  pref_value BOOLEAN;
BEGIN
  SELECT email_preferences INTO prefs
  FROM users
  WHERE id = p_user_id;
  
  IF prefs IS NULL THEN
    RETURN p_email_type IN ('kira_ready', 'magic_link', 'subscription_confirm');
  END IF;
  
  pref_value := (prefs ->> p_email_type)::boolean;
  RETURN COALESCE(pref_value, true);
END;
$$ LANGUAGE plpgsql;


-- Get users for re-engagement emails
CREATE OR REPLACE FUNCTION get_users_for_reengagement(
  p_days_inactive INTEGER DEFAULT 7,
  p_min_days_since_email INTEGER DEFAULT 3
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  agent_id TEXT,
  last_topic TEXT,
  days_since_chat INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    ka.elevenlabs_agent_id as agent_id,
    c.last_topic,
    EXTRACT(DAY FROM NOW() - ka.last_conversation_at)::INTEGER as days_since_chat
  FROM users u
  JOIN kira_agents ka ON ka.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT conv.last_topic 
    FROM conversations conv
    WHERE conv.kira_agent_id = ka.id 
    ORDER BY conv.last_message_at DESC 
    LIMIT 1
  ) c ON true
  WHERE 
    u.email IS NOT NULL
    AND ka.last_conversation_at < NOW() - (p_days_inactive || ' days')::INTERVAL
    AND (
      u.last_email_at IS NULL 
      OR u.last_email_at < NOW() - (p_min_days_since_email || ' days')::INTERVAL
    )
    AND should_send_email(u.id, 'welcome_back')
    AND u.subscription_status IN ('active', 'trialing', 'trial')
  ORDER BY ka.last_conversation_at ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;


-- Get conversation context for returning users
CREATE OR REPLACE FUNCTION get_conversation_context(
  p_agent_id UUID,
  p_user_id UUID,
  p_message_limit INTEGER DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  last_conv RECORD;
  time_gap INTERVAL;
BEGIN
  SELECT 
    c.id,
    c.last_message_at,
    c.last_topic,
    c.summary,
    c.message_count,
    c.title
  INTO last_conv
  FROM conversations c
  WHERE c.kira_agent_id = p_agent_id 
    AND c.user_id = p_user_id
    AND c.status = 'active'
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 1;
  
  IF last_conv.id IS NULL THEN
    RETURN json_build_object(
      'has_history', false,
      'recent_messages', '[]'::json,
      'memories', '[]'::json
    );
  END IF;
  
  time_gap := NOW() - last_conv.last_message_at;
  
  SELECT json_build_object(
    'has_history', true,
    'conversation_id', last_conv.id,
    'last_message_at', last_conv.last_message_at,
    'time_gap_seconds', EXTRACT(EPOCH FROM time_gap)::INTEGER,
    'time_gap_category', 
      CASE 
        WHEN time_gap < INTERVAL '1 hour' THEN 'recent'
        WHEN time_gap < INTERVAL '1 day' THEN 'today'
        WHEN time_gap < INTERVAL '7 days' THEN 'this_week'
        ELSE 'older'
      END,
    'last_topic', last_conv.last_topic,
    'summary', last_conv.summary,
    'message_count', last_conv.message_count,
    'title', last_conv.title,
    'recent_messages', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'role', m.role,
          'content', m.content,
          'timestamp', m.timestamp
        ) ORDER BY m.timestamp DESC
      ), '[]'::json)
      FROM (
        SELECT * FROM conversation_messages
        WHERE conversation_id = last_conv.id
        ORDER BY timestamp DESC
        LIMIT p_message_limit
      ) m
    ),
    'memories', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', mem.id,
          'type', mem.memory_type,
          'content', mem.content,
          'importance', mem.importance
        ) ORDER BY mem.importance DESC
      ), '[]'::json)
      FROM (
        SELECT * FROM kira_memory
        WHERE kira_agent_id = p_agent_id 
          AND user_id = p_user_id
          AND active = true
        ORDER BY importance DESC, created_at DESC
        LIMIT 10
      ) mem
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
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

DROP TRIGGER IF EXISTS trg_email_logs_updated ON email_logs;
CREATE TRIGGER trg_email_logs_updated BEFORE UPDATE ON email_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Conversation message trigger (updates conversation stats)
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON conversation_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
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

-- Conversation Messages - users can only see their own
DROP POLICY IF EXISTS "Users can view own messages" ON conversation_messages;
CREATE POLICY "Users can view own messages" ON conversation_messages
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

DROP POLICY IF EXISTS "Service role full access messages" ON conversation_messages;
CREATE POLICY "Service role full access messages" ON conversation_messages
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

DROP POLICY IF EXISTS "Service role full access email_logs" ON email_logs;
CREATE POLICY "Service role full access email_logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access feedback" ON user_feedback;
CREATE POLICY "Service role full access feedback" ON user_feedback
  FOR ALL USING (auth.role() = 'service_role');


-- ============================================================================
-- STORAGE BUCKET (run separately in Supabase Dashboard if needed)
-- ============================================================================
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('knowledge-files', 'knowledge-files', false);


-- ============================================================================
-- SCHEMA COMPLETE!
-- ============================================================================
-- Tables: 10
--   - users
--   - kira_agents
--   - conversations
--   - conversation_messages
--   - kira_memory
--   - knowledge_files
--   - knowledge_urls
--   - setup_sessions
--   - email_logs
--   - user_feedback
--
-- Functions: 5
--   - update_updated_at_column()
--   - update_conversation_on_message()
--   - should_send_email()
--   - get_users_for_reengagement()
--   - get_conversation_context()
--
-- Triggers: 7
--   - Updated_at triggers on 6 tables
--   - Message insert trigger on conversation_messages
--
-- ============================================================================
