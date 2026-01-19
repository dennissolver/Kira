// lib/email/resend.ts
// Email service using Resend for transactional emails

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'Kira <kira@yourdomain.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kira.app';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    if (error) {
      console.error('[email] Failed to send:', error);
      throw error;
    }

    console.log('[email] Sent successfully:', data?.id);
    return data;
  } catch (error) {
    console.error('[email] Error:', error);
    throw error;
  }
}

// Simple HTML stripper for plain text version
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface KiraReadyEmailParams {
  userName: string;
  userEmail: string;
  agentId: string;
  journeyType: 'personal' | 'business';
  primaryGoal?: string;
}

export async function sendKiraReadyEmail({
  userName,
  userEmail,
  agentId,
  journeyType,
  primaryGoal,
}: KiraReadyEmailParams) {
  const chatUrl = `${APP_URL}/chat/${agentId}`;
  const firstName = userName.split(' ')[0];
  
  const subject = `Your Kira is ready! 🎉`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Kira is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #E8998D 0%, #D4847C 100%); padding: 40px; text-align: center;">
              <img src="${APP_URL}/kira-avatar.jpg" alt="Kira" style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; margin-bottom: 16px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Your Kira is Ready!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #333; margin: 0 0 24px 0;">
                Hey ${firstName}! 👋
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
                Great news — your personal Kira guide is all set up and ready to help you${primaryGoal ? ` with <strong>${primaryGoal}</strong>` : ''}.
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 32px 0;">
                You can chat with Kira anytime by clicking the button below. Bookmark it, save it to your home screen, or just reply to this email when you need the link again.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${chatUrl}" style="display: inline-block; background: linear-gradient(135deg, #E8998D 0%, #D4847C 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 12px rgba(232, 153, 141, 0.4);">
                      Chat with Kira →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link backup -->
              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Or copy this link: <a href="${chatUrl}" style="color: #E8998D;">${chatUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Tips Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <div style="background-color: #FDF8F7; border-radius: 8px; padding: 24px;">
                <h3 style="color: #333; margin: 0 0 16px 0; font-size: 16px;">💡 Quick tips to get the most from Kira:</h3>
                <ul style="color: #555; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Be specific about what you need help with</li>
                  <li>Kira remembers your conversations, so you can pick up where you left off</li>
                  <li>The more context you give, the better Kira can help</li>
                  <li>Don't be afraid to say "that's not quite right" — Kira learns from feedback</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="font-size: 14px; color: #888; margin: 0;">
                Questions? Just reply to this email.
              </p>
              <p style="font-size: 12px; color: #aaa; margin: 16px 0 0 0;">
                © ${new Date().getFullYear()} Kira • Your friendly guide through anything
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

// ============================================================================
// WELCOME BACK EMAIL (for returning users who haven't chatted in a while)
// ============================================================================

interface WelcomeBackEmailParams {
  userName: string;
  userEmail: string;
  agentId: string;
  lastTopic?: string;
  daysSinceLastChat: number;
}

export async function sendWelcomeBackEmail({
  userName,
  userEmail,
  agentId,
  lastTopic,
  daysSinceLastChat,
}: WelcomeBackEmailParams) {
  const chatUrl = `${APP_URL}/chat/${agentId}`;
  const firstName = userName.split(' ')[0];
  
  const subject = `Hey ${firstName}, Kira's still here for you`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <img src="${APP_URL}/kira-avatar.jpg" alt="Kira" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 24px;">
              
              <p style="font-size: 18px; color: #333; margin: 0 0 24px 0;">
                Hey ${firstName}!
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
                It's been ${daysSinceLastChat} days since we last chatted${lastTopic ? ` about <strong>${lastTopic}</strong>` : ''}. Just wanted to check in.
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 32px 0;">
                I'm still here whenever you need me — whether it's to continue what we started or tackle something completely new.
              </p>
              
              <a href="${chatUrl}" style="display: inline-block; background: linear-gradient(135deg, #E8998D 0%, #D4847C 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Continue with Kira →
              </a>
              
              <p style="font-size: 14px; color: #888; margin: 32px 0 0 0;">
                — Kira
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #aaa; margin: 0;">
                <a href="${APP_URL}/unsubscribe" style="color: #aaa;">Unsubscribe</a> • 
                <a href="${APP_URL}/preferences" style="color: #aaa;">Email preferences</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

// ============================================================================
// MAGIC LINK EMAIL (passwordless login)
// ============================================================================

interface MagicLinkEmailParams {
  userEmail: string;
  magicLinkUrl: string;
  expiresInMinutes?: number;
}

export async function sendMagicLinkEmail({
  userEmail,
  magicLinkUrl,
  expiresInMinutes = 15,
}: MagicLinkEmailParams) {
  const subject = `Your Kira login link`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          
          <tr>
            <td style="padding: 40px; text-align: center;">
              <img src="${APP_URL}/kira-avatar.jpg" alt="Kira" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 24px;">
              
              <h1 style="color: #333; font-size: 24px; margin: 0 0 16px 0;">Sign in to Kira</h1>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 32px 0;">
                Click the button below to sign in. This link expires in ${expiresInMinutes} minutes.
              </p>
              
              <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #E8998D 0%, #D4847C 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 18px; font-weight: 600;">
                Sign in to Kira →
              </a>
              
              <p style="font-size: 14px; color: #888; margin: 32px 0 0 0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    html,
  });
}
