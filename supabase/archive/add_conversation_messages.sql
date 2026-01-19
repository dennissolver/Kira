-- ============================================================================
-- MIGRATION: Add Conversation Messages Table for Seamless Continuation
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. CONVERSATION MESSAGES TABLE
-- Stores individual messages for display and context injection
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
  message_index INTEGER, -- Order within conversation
  
  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent ON conversation_messages(kira_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON conversation_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_index ON conversation_messages(conversation_id, message_index);

-- 2. ADD COLUMNS TO CONVERSATIONS TABLE
-- For quick access to last topic and summary
-- ============================================================================
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_topic TEXT,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Index for finding recent conversations
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(kira_agent_id, last_message_at DESC);

-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Service role full access (for API routes)
CREATE POLICY "Service role full access on conversation_messages" 
ON conversation_messages FOR ALL USING (true) WITH CHECK (true);

-- 4. FUNCTION: Update conversation stats on new message
-- ============================================================================
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

-- Trigger to auto-update conversation stats
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- 5. FUNCTION: Get conversation context for Kira return
-- ============================================================================
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
  -- Get the most recent conversation for this agent/user
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
  
  -- If no conversation found, return empty context
  IF last_conv.id IS NULL THEN
    RETURN json_build_object(
      'has_history', false,
      'recent_messages', '[]'::json,
      'memories', '[]'::json
    );
  END IF;
  
  -- Calculate time gap
  time_gap := NOW() - last_conv.last_message_at;
  
  -- Build result with messages and memories
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
-- DONE! Run this migration in Supabase SQL Editor
-- ============================================================================
