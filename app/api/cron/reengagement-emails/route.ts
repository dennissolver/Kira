// app/api/cron/reengagement-emails/route.ts
// Cron job to send re-engagement emails to inactive users
// Schedule: Daily at 10am (configure in vercel.json)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWelcomeBackEmail } from '@/lib/email/resend';

// Verify cron secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    console.log('[reengagement-emails] Starting cron job');

    // Get users who need re-engagement emails
    const { data: users, error } = await supabase
      .rpc('get_users_for_reengagement', {
        p_days_inactive: 7,       // Haven't chatted in 7 days
        p_min_days_since_email: 3 // Haven't been emailed in 3 days
      });

    if (error) {
      console.error('[reengagement-emails] Error fetching users:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`[reengagement-emails] Found ${users?.length || 0} users to email`);

    const results = {
      total: users?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send emails (with rate limiting)
    for (const user of users || []) {
      try {
        await sendWelcomeBackEmail({
          userName: user.user_name || 'there',
          userEmail: user.user_email,
          agentId: user.agent_id,
          lastTopic: user.last_topic,
          daysSinceLastChat: user.days_since_chat,
        });

        // Log the email
        await supabase.from('email_logs').insert({
          user_id: user.user_id,
          email_type: 'welcome_back',
          recipient: user.user_email,
          status: 'sent',
          metadata: {
            days_inactive: user.days_since_chat,
            last_topic: user.last_topic,
          }
        });

        // Update user's last_email_at
        await supabase
          .from('users')
          .update({ last_email_at: new Date().toISOString() })
          .eq('id', user.user_id);

        results.sent++;
        
        // Rate limit: 1 email per 100ms to avoid hitting Resend limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (emailError) {
        console.error(`[reengagement-emails] Failed for ${user.user_email}:`, emailError);
        results.failed++;
        results.errors.push(`${user.user_email}: ${emailError}`);

        // Log the failure
        await supabase.from('email_logs').insert({
          user_id: user.user_id,
          email_type: 'welcome_back',
          recipient: user.user_email,
          status: 'failed',
          error_message: String(emailError),
        });
      }
    }

    console.log('[reengagement-emails] Complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('[reengagement-emails] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
