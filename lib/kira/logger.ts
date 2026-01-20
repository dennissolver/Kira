// lib/kira/logger.ts
import { SupabaseClient } from '@supabase/supabase-js';

export function createLogger(
  supabase: SupabaseClient,
  requestId: string
) {
  async function log(
    step: string,
    status: 'start' | 'success' | 'error',
    message?: string,
    details?: any
  ) {
    const payload = {
      request_id: requestId,
      step,
      status,
      message,
      details,
    };

    // 1. Vercel logs
    if (status === 'error') {
      console.error('[KIRA]', payload);
    } else {
      console.log('[KIRA]', payload);
    }

    // 2. Supabase persistent logs
    try {
      await supabase.from('kira_logs').insert(payload);
    } catch (e) {
      console.error('[KIRA][LOGGING_FAILED]', e);
    }
  }

  return { log };
}
