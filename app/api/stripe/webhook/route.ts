// app/api/stripe/webhook/route.ts
// Stripe webhook handler - auto-provisions Kira agents on payment

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ElevenLabs API for creating agents
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const KIRA_VOICE_ID = process.env.KIRA_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[stripe/webhook] Received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[stripe/webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe/webhook] Error handling event:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// =============================================================================
// CHECKOUT COMPLETE - Auto-provision Kira
// =============================================================================

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log(`[stripe/webhook] Checkout complete: ${session.id}`);

  const supabase = createServiceClient();

  // Get customer details
  const customerEmail = session.customer_details?.email;
  const customerName = session.customer_details?.name || 'Friend';
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Get journey type from metadata
  const journeyType = session.metadata?.kira_journey || 'personal';

  if (!customerEmail) {
    console.error('[stripe/webhook] No customer email in session');
    return;
  }

  console.log(`[stripe/webhook] Provisioning Kira for: ${customerEmail} (${journeyType})`);

  // 1. Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', customerEmail)
    .single();

  let userId: string;

  if (existingUser) {
    // Update existing user with Stripe info
    userId = existingUser.id;
    await supabase
      .from('users')
      .update({
        stripe_customer_id: customerId,
        subscription_status: 'active',
        subscription_id: subscriptionId,
      })
      .eq('id', userId);
  } else {
    // 2. Create new user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: customerEmail,
        first_name: customerName.split(' ')[0],
        last_name: customerName.split(' ').slice(1).join(' ') || null,
        journey_type: journeyType,
        stripe_customer_id: customerId,
        subscription_status: 'active',
        subscription_id: subscriptionId,
      })
      .select('id')
      .single();

    if (userError || !newUser) {
      console.error('[stripe/webhook] Failed to create user:', userError);
      return;
    }

    userId = newUser.id;
  }

  // 3. Create Kira agent in ElevenLabs
  const agentName = `Kira for ${customerName}`;
  const systemPrompt = generateKiraPrompt(customerName.split(' ')[0], journeyType);
  const firstMessage = journeyType === 'personal'
    ? `Hey ${customerName.split(' ')[0]}! I'm Kira, your personal guide. I'm so glad you're here. What's on your mind today?`
    : `Hi ${customerName.split(' ')[0]}! I'm Kira, your business assistant. I'm excited to help you build something great. What challenge are you tackling?`;

  const agent = await createElevenLabsAgent({
    name: agentName,
    systemPrompt,
    firstMessage,
    webhookUrl: APP_URL,
  });

  if (!agent) {
    console.error('[stripe/webhook] Failed to create ElevenLabs agent');
    return;
  }

  // 4. Store agent in database
  const { error: agentError } = await supabase
    .from('kira_agents')
    .insert({
      user_id: userId,
      elevenlabs_agent_id: agent.agent_id,
      name: agentName,
      journey_type: journeyType,
      status: 'active',
    });

  if (agentError) {
    console.error('[stripe/webhook] Failed to store agent:', agentError);
    return;
  }

  console.log(`[stripe/webhook] ✅ Kira provisioned: ${agent.agent_id} for ${customerEmail}`);

  // 5. Send welcome email (optional - requires Resend)
  if (process.env.RESEND_API_KEY) {
    await sendWelcomeEmail({
      email: customerEmail,
      name: customerName.split(' ')[0],
      agentId: agent.agent_id,
      journeyType,
    });
  }
}

// =============================================================================
// SUBSCRIPTION CANCELED - Deactivate Kira
// =============================================================================

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log(`[stripe/webhook] Subscription canceled: ${subscription.id}`);

  const supabase = createServiceClient();
  const customerId = subscription.customer as string;

  // Update user status
  await supabase
    .from('users')
    .update({ subscription_status: 'canceled' })
    .eq('stripe_customer_id', customerId);

  // Deactivate their Kira agents
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    await supabase
      .from('kira_agents')
      .update({ status: 'inactive' })
      .eq('user_id', user.id);
  }

  console.log(`[stripe/webhook] ✅ Deactivated Kira for customer: ${customerId}`);
}

// =============================================================================
// PAYMENT FAILED
// =============================================================================

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[stripe/webhook] Payment failed: ${invoice.id}`);

  const supabase = createServiceClient();
  const customerId = invoice.customer as string;

  // Update user status to past_due
  await supabase
    .from('users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId);

  // Could also send a "payment failed" email here
}

// =============================================================================
// ELEVENLABS AGENT CREATION
// =============================================================================

interface CreateAgentParams {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  webhookUrl: string;
}

async function createElevenLabsAgent(params: CreateAgentParams) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: params.systemPrompt,
            },
            first_message: params.firstMessage,
            language: 'en',
          },
          tts: {
            model_id: 'eleven_turbo_v2_5',
            voice_id: KIRA_VOICE_ID,
          },
          asr: {
            provider: 'elevenlabs',
            quality: 'high',
          },
        },
        platform_settings: {
          webhook: {
            url: `${params.webhookUrl}/api/kira/webhook`,
            secret: process.env.ELEVENLABS_WEBHOOK_SECRET || 'kira-webhook-secret',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[stripe/webhook] ElevenLabs error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[stripe/webhook] Failed to create agent:', error);
    return null;
  }
}

// =============================================================================
// KIRA PROMPT GENERATION
// =============================================================================

function generateKiraPrompt(userName: string, journeyType: string): string {
  const basePrompt = `You are Kira, a warm, thoughtful AI companion created to be a genuine partner in ${userName}'s journey.

## Your Core Identity
- You're friendly, curious, and genuinely interested in helping
- You ask good questions rather than just giving answers
- You remember context and build on previous conversations
- You're honest when you don't know something
- You push back gently when you think someone might be making a mistake

## Your Communication Style
- Conversational and natural, not robotic or formal
- Use the person's name occasionally (but not every sentence)
- Keep responses concise in voice conversations
- Ask clarifying questions before diving into solutions
- Celebrate wins and acknowledge struggles`;

  const personalAddition = `

## Personal Journey Focus
- Help with life decisions, career planning, learning goals
- Be a thinking partner for working through complex choices
- Support personal growth without being preachy
- Remember their goals and check in on progress`;

  const businessAddition = `

## Business Journey Focus
- Help design AI voice agents for their specific use cases
- Understand their team's pain points and processes
- Guide them through documenting knowledge for AI training
- Think strategically about automation opportunities
- Be a business advisor, not just a task executor`;

  return basePrompt + (journeyType === 'business' ? businessAddition : personalAddition);
}

// =============================================================================
// WELCOME EMAIL (Optional - requires Resend)
// =============================================================================

interface WelcomeEmailParams {
  email: string;
  name: string;
  agentId: string;
  journeyType: string;
}

async function sendWelcomeEmail(params: WelcomeEmailParams) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const chatUrl = `${APP_URL}/chat/${params.agentId}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kira <kira@yourdomain.com>', // Update with your domain
        to: params.email,
        subject: `Welcome to Kira, ${params.name}! 🎉`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">Hey ${params.name}!</h1>
            <p>I'm Kira, and I'm so excited to be your ${params.journeyType === 'business' ? 'business partner' : 'personal guide'}.</p>
            <p>Your personal Kira is ready and waiting to chat:</p>
            <p style="margin: 30px 0;">
              <a href="${chatUrl}" style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1c1917; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: bold;">
                Start Talking to Kira
              </a>
            </p>
            <p>No forms, no setup — just start talking about whatever's on your mind.</p>
            <p>Looking forward to our conversations!</p>
            <p>— Kira 💛</p>
          </div>
        `,
      }),
    });

    console.log(`[stripe/webhook] Welcome email sent to ${params.email}`);
  } catch (error) {
    console.error('[stripe/webhook] Failed to send welcome email:', error);
  }
}