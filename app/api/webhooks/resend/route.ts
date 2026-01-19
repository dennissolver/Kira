// app/api/webhooks/resend/route.ts
// Handles Resend webhooks for email delivery tracking

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// Verify Resend webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('resend-signature') || '';

    // Verify webhook signature (skip if no secret configured)
    if (RESEND_WEBHOOK_SECRET && !verifySignature(payload, signature, RESEND_WEBHOOK_SECRET)) {
      console.error('[resend-webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const event = JSON.parse(payload);
    console.log('[resend-webhook] Received:', event.type);

    const { type, data } = event;
    const emailId = data.email_id;

    if (!emailId) {
      return NextResponse.json({ received: true });
    }

    // Update email log based on event type
    switch (type) {
      case 'email.sent':
        await supabase
          .from('email_logs')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('resend_id', emailId);
        break;

      case 'email.delivered':
        await supabase
          .from('email_logs')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('resend_id', emailId);
        break;

      case 'email.opened':
        await supabase
          .from('email_logs')
          .update({ 
            status: 'opened', 
            opened_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq('resend_id', emailId);
        break;

      case 'email.clicked':
        await supabase
          .from('email_logs')
          .update({ 
            status: 'clicked', 
            clicked_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq('resend_id', emailId);
        break;

      case 'email.bounced':
        await supabase
          .from('email_logs')
          .update({ 
            status: 'bounced', 
            error_message: data.bounce?.message || 'Bounced',
            updated_at: new Date().toISOString() 
          })
          .eq('resend_id', emailId);
        break;

      case 'email.complained':
        await supabase
          .from('email_logs')
          .update({ 
            status: 'failed', 
            error_message: 'Spam complaint',
            updated_at: new Date().toISOString() 
          })
          .eq('resend_id', emailId);
        break;

      default:
        console.log('[resend-webhook] Unhandled event type:', type);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[resend-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
