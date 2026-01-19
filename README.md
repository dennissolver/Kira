# Kira Email System

Transactional and re-engagement email system for Kira using Resend.

## Overview

```
User completes setup
        ↓
Operational Kira created
        ↓
"Kira Ready" email sent with chat link
        ↓
User bookmarks link or saves to home screen
        ↓
[7 days of inactivity]
        ↓
Cron job sends "Welcome Back" email
```

## Email Types

| Type | Trigger | Purpose |
|------|---------|---------|
| `kira_ready` | After setup completes | Welcome + chat link |
| `welcome_back` | 7 days inactive | Re-engagement |
| `magic_link` | Login request | Passwordless auth |
| `subscription_confirm` | Payment success | Receipt |
| `subscription_reminder` | 5 days before trial ends | Conversion |

## Setup

### 1. Install Resend

```bash
npm install resend
```

### 2. Add Environment Variables

```env
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
EMAIL_FROM=Kira <kira@yourdomain.com>

# For cron jobs
CRON_SECRET=your-secret-string

# App URL (for links in emails)
NEXT_PUBLIC_APP_URL=https://kira.app
```

### 3. Configure Resend Domain

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records they provide
4. Verify the domain

### 4. Run Database Migration

```sql
-- Copy contents of migrations/add_email_logs.sql
```

### 5. Set Up Webhook (for tracking)

1. Go to Resend Dashboard → Webhooks
2. Add webhook URL: `https://kira.app/api/webhooks/resend`
3. Select events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
4. Copy the signing secret to `RESEND_WEBHOOK_SECRET`

### 6. Deploy Cron Job

The `vercel.json` configures a daily cron at 10am UTC:
```json
{
  "crons": [
    {
      "path": "/api/cron/reengagement-emails",
      "schedule": "0 10 * * *"
    }
  ]
}
```

## Files

```
lib/
  email/
    resend.ts              # Email service + templates

app/api/
  kira/
    email/
      send-kira-ready/
        route.ts           # Endpoint to send welcome email
  cron/
    reengagement-emails/
      route.ts             # Daily cron for inactive users
  webhooks/
    resend/
      route.ts             # Resend delivery tracking

migrations/
  add_email_logs.sql       # Database tables

vercel.json                # Cron configuration
```

## Usage

### Send Kira Ready Email (after setup)

```typescript
import { sendKiraReadyEmail } from '@/lib/email/resend';

await sendKiraReadyEmail({
  userName: 'Dennis',
  userEmail: 'dennis@example.com',
  agentId: 'abc123',
  journeyType: 'personal',
  primaryGoal: 'planning a trip to Portugal',
});
```

### Check If User Wants Emails

```typescript
const { data: shouldSend } = await supabase
  .rpc('should_send_email', {
    p_user_id: userId,
    p_email_type: 'welcome_back'
  });
```

### Get Users for Re-engagement

```typescript
const { data: users } = await supabase
  .rpc('get_users_for_reengagement', {
    p_days_inactive: 7,
    p_min_days_since_email: 3
  });
```

## Email Templates

All templates are in `lib/email/resend.ts`:

- **Kira Ready** - Branded welcome with chat link button
- **Welcome Back** - Personal re-engagement
- **Magic Link** - Simple login link

Templates use inline CSS for email client compatibility.

## Tracking

Email events are tracked in `email_logs` table:

| Status | Meaning |
|--------|---------|
| `pending` | Queued |
| `sent` | Sent to Resend |
| `delivered` | Reached inbox |
| `opened` | User opened |
| `clicked` | User clicked link |
| `bounced` | Failed delivery |
| `failed` | Error |

## User Preferences

Users can control which emails they receive:

```sql
-- Default preferences
{
  "kira_ready": true,
  "welcome_back": true,
  "weekly_summary": false,
  "feature_announcements": true
}
```

## Testing

### Test Welcome Email

```bash
curl -X POST http://localhost:3000/api/kira/email/send-kira-ready \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "agent_id": "your-agent-id",
    "primary_goal": "testing the email system"
  }'
```

### Test Cron Job Locally

```bash
curl http://localhost:3000/api/cron/reengagement-emails \
  -H "Authorization: Bearer your-cron-secret"
```

## Troubleshooting

### Emails not sending
- Check `RESEND_API_KEY` is valid
- Verify domain is configured in Resend
- Check Resend dashboard for errors

### Cron not running
- Verify `vercel.json` is in project root
- Check Vercel dashboard → Crons
- Ensure `CRON_SECRET` matches

### Webhooks not updating
- Verify webhook URL is accessible
- Check `RESEND_WEBHOOK_SECRET` matches
- Look at Resend webhook logs
