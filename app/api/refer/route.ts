// app/api/refer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yourName, yourEmail, friendEmail, referrerId } = body;

    // Validate inputs
    if (!yourName || !yourEmail || !friendEmail) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(yourEmail) || !emailRegex.test(friendEmail)) {
      return NextResponse.json(
        { error: 'Please enter valid email addresses' },
        { status: 400 }
      );
    }

    // Don't let people refer themselves
    if (yourEmail.toLowerCase() === friendEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "You can't refer yourself!" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Store the referral in the database
    const { data: referral, error: dbError } = await supabase
      .from('referrals')
      .insert({
        referrer_name: yourName,
        referrer_email: yourEmail.toLowerCase(),
        referred_email: friendEmail.toLowerCase(),
        referrer_user_id: referrerId || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // Check if this referral already exists
      if (dbError.code === '23505') {
        return NextResponse.json(
          { error: 'This friend has already been invited' },
          { status: 400 }
        );
      }
      console.error('[refer] Database error:', dbError);
      throw dbError;
    }

    // Send the referral email using Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kira-rho.vercel.app';

    if (RESEND_API_KEY) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Kira <onboarding@resend.dev>', // Use your verified domain in production
            reply_to: yourEmail,
            to: friendEmail,
            subject: `${yourName} thinks you'd love Kira`,
            html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${siteUrl}/kira-avatar.jpg" alt="Kira" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
    </div>
    
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center;">
      ${yourName} sent you something
    </h1>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hey there! 👋
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your friend <strong>${yourName}</strong> has been using Kira — an AI guide that helps with everything from planning projects to making decisions — and thought you might find it useful too.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 30px;">
      Think of Kira like having a smart, patient friend who's always available to help you think things through.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${siteUrl}?ref=${referral.id}" style="display: inline-block; background: linear-gradient(135deg, #f43f5e 0%, #f97316 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px;">
        Meet Kira
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Questions? Just reply to this email — it'll go straight to ${yourName}.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      This email was sent because ${yourName} (${yourEmail}) thought you'd like Kira.<br>
      We won't email you again unless you sign up.
    </p>
  </body>
</html>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error('[refer] Email send error:', emailError);
          // Don't fail the whole request if email fails - referral is still saved
        }
      } catch (emailErr) {
        console.error('[refer] Email send exception:', emailErr);
      }
    } else {
      console.log('[refer] RESEND_API_KEY not set - email not sent');
      console.log('[refer] Would send to:', friendEmail, 'from:', yourName);
    }

    // Update referral status to sent
    await supabase
      .from('referrals')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', referral.id);

    return NextResponse.json({
      success: true,
      message: 'Referral sent successfully'
    });

  } catch (error) {
    console.error('[refer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send referral. Please try again.' },
      { status: 500 }
    );
  }
}