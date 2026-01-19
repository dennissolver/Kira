// app/api/kira/email/send-kira-ready/route.ts
// Called after Operational Kira is created to send the welcome email

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendKiraReadyEmail } from '@/lib/email/resend';

interface SendKiraReadyRequest {
  user_id: string;
  agent_id: string; // ElevenLabs agent ID
  primary_goal?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: SendKiraReadyRequest = await request.json();
    
    console.log('[send-kira-ready] Received:', body);

    const { user_id, agent_id, primary_goal } = body;

    if (!user_id || !agent_id) {
      return NextResponse.json(
        { error: 'Missing user_id or agent_id' },
        { status: 400 }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name, email, journey_type')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('[send-kira-ready] User not found:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.email) {
      console.log('[send-kira-ready] No email for user, skipping');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No email address'
      });
    }

    // Send the email
    const result = await sendKiraReadyEmail({
      userName: user.name || 'there',
      userEmail: user.email,
      agentId: agent_id,
      journeyType: user.journey_type || 'personal',
      primaryGoal: primary_goal,
    });

    console.log('[send-kira-ready] Email sent:', result?.id);

    // Log the email send (non-critical, don't fail if this errors)
    try {
      await supabase
        .from('email_logs')
        .insert({
          user_id,
          email_type: 'kira_ready',
          recipient: user.email,
          status: 'sent',
          resend_id: result?.id,
        });
    } catch (logError) {
      console.log('[send-kira-ready] Failed to log email:', logError);
    }

    return NextResponse.json({
      success: true,
      email_id: result?.id,
    });

  } catch (error) {
    console.error('[send-kira-ready] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
