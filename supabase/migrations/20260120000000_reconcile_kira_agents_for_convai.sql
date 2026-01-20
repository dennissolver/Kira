BEGIN;

-- 1. Ensure required columns exist (idempotent)

ALTER TABLE public.kira_agents
ADD COLUMN IF NOT EXISTS elevenlabs_agent_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS journey_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Mark legacy / broken agents as inactive
-- (agents created before ConvAI fix)

UPDATE public.kira_agents
SET status = 'inactive'
WHERE elevenlabs_agent_id IS NULL
   OR elevenlabs_agent_id = '';

-- 3. Enforce NOT NULL for real agents only
-- (we allow inactive rows to stay dirty)

ALTER TABLE public.kira_agents
ALTER COLUMN elevenlabs_agent_id SET NOT NULL;

-- 4. Enforce ONE active agent per user + journey
-- (this matches backend logic)

CREATE UNIQUE INDEX IF NOT EXISTS kira_one_active_agent_per_journey
ON public.kira_agents (user_id, journey_type)
WHERE status = 'active';

-- 5. Optional: add helpful comments for future-you

COMMENT ON COLUMN public.kira_agents.elevenlabs_agent_id
IS 'Authoritative ConvAI agent_id from ElevenLabs. Required for voice.';

COMMENT ON COLUMN public.kira_agents.status
IS 'active | inactive. Only active agents may start voice sessions.';

COMMIT;
