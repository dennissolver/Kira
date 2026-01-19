// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

// Service role client for API routes (bypasses RLS)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Types for our database
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string;
  created_at: string;
}

export interface KiraAgent {
  id: string;
  user_id: string;
  agent_name: string;
  journey_type: 'personal' | 'business';
  elevenlabs_agent_id: string;
  elevenlabs_tool_ids: string[];
  status: 'active' | 'paused' | 'deleted';
  total_conversations: number;
  total_minutes: number;
  created_at: string;
  last_conversation_at: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  kira_agent_id: string;
  elevenlabs_conversation_id: string | null;
  title: string | null;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript_text: string | null;
  topics: string[];
  created_at: string;
}

export interface KiraMemory {
  id: string;
  user_id: string;
  kira_agent_id: string;
  memory_type: 'preference' | 'context' | 'goal' | 'decision' | 'followup' | 'correction' | 'insight';
  content: string;
  source_conversation_id: string | null;
  importance: number;
  tags: string[];
  active: boolean;
  created_at: string;
  last_recalled_at: string | null;
  recall_count: number;
}
