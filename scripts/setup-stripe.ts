#!/usr/bin/env npx ts-node

/**
 * Kira - Stripe Auto-Setup Script
 *
 * This script automatically configures all Stripe resources for Kira:
 * - Products (Personal & Business)
 * - Prices (Monthly subscriptions)
 * - Payment Links (No-code checkout)
 * - Webhook Endpoint (For auto-provisioning)
 * - Customer Portal (Self-service billing)
 *
 * Usage:
 *   1. Add STRIPE_SECRET_KEY to .env.local
 *   2. Run: npx ts-node scripts/setup-stripe.ts
 *   3. Copy the output env vars to your .env.local and Vercel
 *
 * Requirements:
 *   npm install stripe dotenv
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import path from 'path';
import Stripe from 'stripe';

// Load from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Your app URL (change for production)
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://kira-rho.vercel.app',

  // Product definitions
  products: {
    personal: {
      name: 'Kira Personal',
      description: 'Your friendly AI guide for life decisions, learning, and personal growth. Includes: Unlimited conversations, Voice-first AI companion, Memory across conversations, Personal goal tracking.',
      price: {
        monthly: 1200, // $12.00 in cents
        yearly: 9900,  // $99.00 in cents (save ~$45)
      },
      trialDays: 30,
    },
    business: {
      name: 'Kira Business',
      description: 'AI voice agents for your team - onboarding, support, and process automation. Includes: Custom AI agents, Team onboarding automation, Customer support voice agents, Process documentation & training, Analytics & insights.',
      price: {
        monthly: 4900,  // $49.00 in cents
        yearly: 47000,  // $470.00 in cents (save ~$118)
      },
      trialDays: 14,
    },
  },

  // Webhook events to listen for
  webhookEvents: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
  ] as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
};

// =============================================================================
// SETUP SCRIPT
// =============================================================================

async function setupStripe() {
  console.log('\n🚀 Kira Stripe Auto-Setup\n');
  console.log('='.repeat(50));

  // Check for API key
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error('❌ Error: STRIPE_SECRET_KEY not found in .env.local');
    console.log('\nMake sure .env.local contains:');
    console.log('  STRIPE_SECRET_KEY=sk_test_xxx');
    process.exit(1);
  }

  const isTestMode = apiKey.startsWith('sk_test_');
  console.log(`\n📍 Mode: ${isTestMode ? 'TEST' : '⚠️  LIVE'}`);
  console.log(`📍 App URL: ${CONFIG.appUrl}`);

  if (!isTestMode) {
    console.log('\n⚠️  WARNING: You are using a LIVE Stripe key!');
    console.log('   This will create real products and prices.');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await sleep(5000);
  }

  // Initialize Stripe without specifying apiVersion (uses SDK default)
  const stripe = new Stripe(apiKey);

  const results: Record<string, string> = {};

  try {
    // =========================================================================
    // 1. CREATE PRODUCTS
    // =========================================================================
    console.log('\n📦 Creating Products...\n');

    // Personal Product
    const personalProduct = await stripe.products.create({
      name: CONFIG.products.personal.name,
      description: CONFIG.products.personal.description,
      metadata: {
        kira_journey: 'personal',
        created_by: 'kira-setup-script',
      },
    });
    console.log(`   ✅ ${personalProduct.name} (${personalProduct.id})`);
    results.STRIPE_PERSONAL_PRODUCT_ID = personalProduct.id;

    // Business Product
    const businessProduct = await stripe.products.create({
      name: CONFIG.products.business.name,
      description: CONFIG.products.business.description,
      metadata: {
        kira_journey: 'business',
        created_by: 'kira-setup-script',
      },
    });
    console.log(`   ✅ ${businessProduct.name} (${businessProduct.id})`);
    results.STRIPE_BUSINESS_PRODUCT_ID = businessProduct.id;

    // =========================================================================
    // 2. CREATE PRICES
    // =========================================================================
    console.log('\n💰 Creating Prices...\n');

    // Personal Monthly
    const personalMonthly = await stripe.prices.create({
      product: personalProduct.id,
      unit_amount: CONFIG.products.personal.price.monthly,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        kira_journey: 'personal',
        billing_period: 'monthly',
      },
    });
    console.log(`   ✅ Personal Monthly: $${CONFIG.products.personal.price.monthly / 100}/mo (${personalMonthly.id})`);
    results.STRIPE_PERSONAL_MONTHLY_PRICE_ID = personalMonthly.id;

    // Personal Yearly
    const personalYearly = await stripe.prices.create({
      product: personalProduct.id,
      unit_amount: CONFIG.products.personal.price.yearly,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: {
        kira_journey: 'personal',
        billing_period: 'yearly',
      },
    });
    console.log(`   ✅ Personal Yearly: $${CONFIG.products.personal.price.yearly / 100}/yr (${personalYearly.id})`);
    results.STRIPE_PERSONAL_YEARLY_PRICE_ID = personalYearly.id;

    // Business Monthly
    const businessMonthly = await stripe.prices.create({
      product: businessProduct.id,
      unit_amount: CONFIG.products.business.price.monthly,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        kira_journey: 'business',
        billing_period: 'monthly',
      },
    });
    console.log(`   ✅ Business Monthly: $${CONFIG.products.business.price.monthly / 100}/mo (${businessMonthly.id})`);
    results.STRIPE_BUSINESS_MONTHLY_PRICE_ID = businessMonthly.id;

    // Business Yearly
    const businessYearly = await stripe.prices.create({
      product: businessProduct.id,
      unit_amount: CONFIG.products.business.price.yearly,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: {
        kira_journey: 'business',
        billing_period: 'yearly',
      },
    });
    console.log(`   ✅ Business Yearly: $${CONFIG.products.business.price.yearly / 100}/yr (${businessYearly.id})`);
    results.STRIPE_BUSINESS_YEARLY_PRICE_ID = businessYearly.id;

    // =========================================================================
    // 3. CREATE PAYMENT LINKS
    // =========================================================================
    console.log('\n🔗 Creating Payment Links...\n');

    // Personal Payment Link (with trial)
    const personalPaymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: personalMonthly.id, quantity: 1 }],
      subscription_data: {
        trial_period_days: CONFIG.products.personal.trialDays,
        metadata: {
          kira_journey: 'personal',
        },
      },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${CONFIG.appUrl}/start?type=personal&setup=complete` },
      },
      metadata: {
        kira_journey: 'personal',
      },
    });
    console.log(`   ✅ Personal: ${personalPaymentLink.url}`);
    results.STRIPE_PERSONAL_PAYMENT_LINK = personalPaymentLink.url;
    results.STRIPE_PERSONAL_PAYMENT_LINK_ID = personalPaymentLink.id;

    // Business Payment Link (with trial)
    const businessPaymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: businessMonthly.id, quantity: 1 }],
      subscription_data: {
        trial_period_days: CONFIG.products.business.trialDays,
        metadata: {
          kira_journey: 'business',
        },
      },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${CONFIG.appUrl}/start?type=business&setup=complete` },
      },
      metadata: {
        kira_journey: 'business',
      },
    });
    console.log(`   ✅ Business: ${businessPaymentLink.url}`);
    results.STRIPE_BUSINESS_PAYMENT_LINK = businessPaymentLink.url;
    results.STRIPE_BUSINESS_PAYMENT_LINK_ID = businessPaymentLink.id;

    // =========================================================================
    // 4. CREATE WEBHOOK ENDPOINT
    // =========================================================================
    console.log('\n🪝 Creating Webhook Endpoint...\n');

    const webhookUrl = `${CONFIG.appUrl}/api/stripe/webhook`;

    // Check if webhook already exists
    const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const existingWebhook = existingWebhooks.data.find(w => w.url === webhookUrl);

    let webhook: Stripe.WebhookEndpoint;
    if (existingWebhook) {
      // Update existing webhook
      webhook = await stripe.webhookEndpoints.update(existingWebhook.id, {
        enabled_events: CONFIG.webhookEvents,
      });
      console.log(`   ✅ Updated existing webhook: ${webhook.url}`);
    } else {
      // Create new webhook
      webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: CONFIG.webhookEvents,
        metadata: {
          created_by: 'kira-setup-script',
        },
      });
      console.log(`   ✅ Created webhook: ${webhook.url}`);
    }

    results.STRIPE_WEBHOOK_ENDPOINT_ID = webhook.id;
    if (webhook.secret) {
      results.STRIPE_WEBHOOK_SECRET = webhook.secret;
      console.log(`   🔑 Webhook Secret: ${webhook.secret}`);
    } else {
      console.log(`   ⚠️  Webhook secret not returned (already exists). Get it from Stripe Dashboard.`);
    }

    // =========================================================================
    // 5. CREATE CUSTOMER PORTAL CONFIGURATION
    // =========================================================================
    console.log('\n🎛️  Creating Customer Portal...\n');

    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your Kira subscription',
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'name'],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: personalProduct.id,
              prices: [personalMonthly.id, personalYearly.id],
            },
            {
              product: businessProduct.id,
              prices: [businessMonthly.id, businessYearly.id],
            },
          ],
        },
      },
    });
    console.log(`   ✅ Portal Configuration: ${portalConfig.id}`);
    results.STRIPE_PORTAL_CONFIG_ID = portalConfig.id;

    // =========================================================================
    // OUTPUT RESULTS
    // =========================================================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ SETUP COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n📋 Add these to your .env.local and Vercel:\n');
    console.log('─'.repeat(50));

    console.log('\n# Stripe Configuration (auto-generated)');
    console.log(`STRIPE_SECRET_KEY=${apiKey}`);
    console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${apiKey.replace('sk_test_', 'pk_test_').replace('sk_live_', 'pk_live_')}`);

    if (results.STRIPE_WEBHOOK_SECRET) {
      console.log(`STRIPE_WEBHOOK_SECRET=${results.STRIPE_WEBHOOK_SECRET}`);
    } else {
      console.log(`STRIPE_WEBHOOK_SECRET=whsec_xxx  # Get from Stripe Dashboard → Webhooks`);
    }

    console.log(`\n# Stripe Product IDs`);
    console.log(`STRIPE_PERSONAL_PRODUCT_ID=${results.STRIPE_PERSONAL_PRODUCT_ID}`);
    console.log(`STRIPE_BUSINESS_PRODUCT_ID=${results.STRIPE_BUSINESS_PRODUCT_ID}`);

    console.log(`\n# Stripe Price IDs`);
    console.log(`STRIPE_PERSONAL_MONTHLY_PRICE_ID=${results.STRIPE_PERSONAL_MONTHLY_PRICE_ID}`);
    console.log(`STRIPE_PERSONAL_YEARLY_PRICE_ID=${results.STRIPE_PERSONAL_YEARLY_PRICE_ID}`);
    console.log(`STRIPE_BUSINESS_MONTHLY_PRICE_ID=${results.STRIPE_BUSINESS_MONTHLY_PRICE_ID}`);
    console.log(`STRIPE_BUSINESS_YEARLY_PRICE_ID=${results.STRIPE_BUSINESS_YEARLY_PRICE_ID}`);

    console.log(`\n# Stripe Payment Links (for landing page CTAs)`);
    console.log(`NEXT_PUBLIC_STRIPE_PERSONAL_LINK=${results.STRIPE_PERSONAL_PAYMENT_LINK}`);
    console.log(`NEXT_PUBLIC_STRIPE_BUSINESS_LINK=${results.STRIPE_BUSINESS_PAYMENT_LINK}`);

    console.log(`\n# Stripe Portal`);
    console.log(`STRIPE_PORTAL_CONFIG_ID=${results.STRIPE_PORTAL_CONFIG_ID}`);

    console.log('\n─'.repeat(50));
    console.log('\n🔗 Payment Links (share these with customers):\n');
    console.log(`   Personal ($12/mo, 30-day trial):`);
    console.log(`   ${results.STRIPE_PERSONAL_PAYMENT_LINK}\n`);
    console.log(`   Business ($49/mo, 14-day trial):`);
    console.log(`   ${results.STRIPE_BUSINESS_PAYMENT_LINK}\n`);

    console.log('─'.repeat(50));
    console.log('\n📌 Next Steps:\n');
    console.log('   1. Copy the env vars above to .env.local');
    console.log('   2. Add them to Vercel: Settings → Environment Variables');
    console.log('   3. Create the webhook handler: /api/stripe/webhook');
    console.log('   4. Update landing page CTAs with payment links');
    console.log('   5. Redeploy to Vercel\n');

  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the setup
setupStripe();