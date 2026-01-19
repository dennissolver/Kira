-- ============================================================================
-- MIGRATION: Add Email Logs Table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- EMAIL LOGS TABLE
-- Track all emails sent for analytics and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  
  -- What
  email_type TEXT NOT NULL CHECK (email_type IN (
    'kira_ready',           -- Initial welcome after setup
    'welcome_back',         -- Re-engagement after inactivity
    'magic_link',           -- Passwordless login
    'subscription_confirm', -- Payment confirmation
    'subscription_reminder',-- Before trial ends
    'weekly_summary',       -- Usage summary
    'feature_announcement'  -- Product updates
  )),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  
  -- Tracking
  resend_id TEXT,           -- Resend's email ID for tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend ON email_logs(resend_id);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on email_logs" 
ON email_logs FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- ADD EMAIL PREFERENCES TO USERS TABLE
-- ============================================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
  "kira_ready": true,
  "welcome_back": true,
  "weekly_summary": false,
  "feature_announcements": true
}'::jsonb;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_email_at TIMESTAMPTZ;


-- ============================================================================
-- FUNCTION: Check if user should receive email type
-- ============================================================================
CREATE OR REPLACE FUNCTION should_send_email(
  p_user_id UUID,
  p_email_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  prefs JSONB;
  pref_value BOOLEAN;
BEGIN
  -- Get user's email preferences
  SELECT email_preferences INTO prefs
  FROM users
  WHERE id = p_user_id;
  
  -- If no preferences, default to true for important emails
  IF prefs IS NULL THEN
    RETURN p_email_type IN ('kira_ready', 'magic_link', 'subscription_confirm');
  END IF;
  
  -- Check specific preference
  pref_value := (prefs ->> p_email_type)::boolean;
  
  -- Default to true if not set
  RETURN COALESCE(pref_value, true);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Get users for re-engagement emails
-- Returns users who haven't chatted in X days and haven't been emailed recently
-- ============================================================================
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
    SELECT last_topic 
    FROM conversations 
    WHERE kira_agent_id = ka.id 
    ORDER BY last_message_at DESC 
    LIMIT 1
  ) c ON true
  WHERE 
    -- Has email
    u.email IS NOT NULL
    -- Inactive for X days
    AND ka.last_conversation_at < NOW() - (p_days_inactive || ' days')::INTERVAL
    -- Hasn't been emailed recently
    AND (
      u.last_email_at IS NULL 
      OR u.last_email_at < NOW() - (p_min_days_since_email || ' days')::INTERVAL
    )
    -- Wants re-engagement emails
    AND should_send_email(u.id, 'welcome_back')
    -- Active subscription or in trial
    AND u.subscription_status IN ('active', 'trialing')
  ORDER BY ka.last_conversation_at ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- DONE!
-- ============================================================================
