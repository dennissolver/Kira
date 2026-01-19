-- ============================================================================
-- KIRA STANDALONE - DATABASE SCHEMA
-- Migration: 20260119000000_kira_standalone.sql
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
  
  -- Authentication
  password_hash TEXT, -- For email/password auth
  auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'magic_link')),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified BOOLEAN DEFAULT false,
  
  -- Subscription
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================================================
-- KIRA AGENTS TABLE (One per user per journey type)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kira_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Agent identity
  agent_name TEXT NOT NULL, -- e.g., "Kira_Personal_Dennis_7f3k"
  journey_type TEXT NOT NULL CHECK (journey_type IN ('personal', 'business')),
  
  -- ElevenLabs
  elevenlabs_agent_id TEXT UNIQUE NOT NULL,
  elevenlabs_tool_ids JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  
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
  title TEXT, -- Auto-generated from first topic
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Content
  transcript_text TEXT,
  transcript_json JSONB,
  
  -- Topics discussed (for memory/continuity)
  topics JSONB DEFAULT '[]', -- ['trip planning', 'portugal', 'budget']
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- KIRA MEMORY TABLE (Persistent across conversations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kira_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  kira_agent_id UUID REFERENCES kira_agents(id) ON DELETE CASCADE NOT NULL,
  
  -- Memory classification
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference',        -- User preference (communication style, topics they like)
    'context',           -- Background info (job, family, situation)
    'goal',              -- Something they're working toward
    'decision',          -- A decision they made
    'followup',          -- Something to check back on
    'correction',        -- User corrected Kira
    'insight'            -- Something Kira learned about them
  )),
  
  -- The actual memory
  content TEXT NOT NULL,
  
  -- Source
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- Retrieval
  importance INT DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  tags JSONB DEFAULT '[]',
  
  -- Validity
  active BOOLEAN DEFAULT true,
  superseded_by UUID REFERENCES kira_memory(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_recalled_at TIMESTAMPTZ,
  recall_count INT DEFAULT 0
);

-- ============================================================================
-- USER FEEDBACK TABLE (Exit interviews, ongoing feedback)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Type
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'exit_interview',    -- When they decide not to subscribe
    'in_conversation',   -- Feedback during a conversation
    'rating',            -- Simple rating
    'suggestion'         -- Feature suggestion
  )),
  
  -- Content
  content TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  
  -- Context
  conversation_id UUID REFERENCES conversations(id),
  
  -- For exit interviews
  exit_reason TEXT, -- 'finished_task', 'too_expensive', 'not_useful', 'found_alternative', 'other'
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

-- Kira Agents
CREATE INDEX IF NOT EXISTS idx_kira_agents_user ON kira_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_kira_agents_elevenlabs ON kira_agents(elevenlabs_agent_id);
CREATE INDEX IF NOT EXISTS idx_kira_agents_journey ON kira_agents(journey_type);

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

-- Apply to tables
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kira_agents_updated BEFORE UPDATE ON kira_agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kira_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users 
  FOR UPDATE USING (auth.uid() = id);

-- Agents - users can only see their own
CREATE POLICY "Users can view own agents" ON kira_agents 
  FOR ALL USING (user_id = auth.uid());

-- Conversations - users can only see their own
CREATE POLICY "Users can view own conversations" ON conversations 
  FOR ALL USING (user_id = auth.uid());

-- Memory - users can only see their own
CREATE POLICY "Users can view own memory" ON kira_memory 
  FOR ALL USING (user_id = auth.uid());

-- Feedback - users can only see their own
CREATE POLICY "Users can view own feedback" ON user_feedback 
  FOR ALL USING (user_id = auth.uid());

-- Service role bypass for API operations
CREATE POLICY "Service role full access users" ON users 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access agents" ON kira_agents 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access conversations" ON conversations 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access memory" ON kira_memory 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access feedback" ON user_feedback 
  FOR ALL USING (auth.role() = 'service_role');
