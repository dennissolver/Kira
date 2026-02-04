# PubGuard User Registration Fix - Summary

## The Problem
Scans are being saved to Supabase but `user_id` is NULL on every record.
The system has 6 scans in the database, all with `user_id: null`.

## Root Cause (3 gaps in the chain)

### Gap 1: v2 scan route never saves to DB
`app/api/pubguard/v2/scan/route.ts` runs the scan and returns JSON
but never calls `saveScanToSupabase()`. The save was supposed to happen
here but was never wired up.

### Gap 2: Webhook doesn't pass userId to scan endpoints  
`app/api/pubguard/webhook/route.ts` correctly stores `userId` in
`conversationState` from `custom_data`, but the `executeScan()` function
never passes it to the API endpoints it calls.

### Gap 3: Save route ignores user fields
`app/api/pubguard/scan/save/route.ts` doesn't accept `user_id`,
`session_id`, or `user_type` in the request body, so even if they
were sent, they'd be dropped.

## Files to Update

### 1. `app/api/pubguard/v2/scan/route.ts`
- ADD import: `import { saveScanToSupabase } from '@/lib/pubguard/supabase';`
- ADD `userType`, `userId`, `sessionId` extraction from request body
- ADD `saveScanToSupabase()` call before the final `return NextResponse.json(report)`
- See: `PATCH-v2-scan-route.ts` for exact code

### 2. `app/api/pubguard/webhook/route.ts`  
- UPDATE `executeScan()` signature to accept `userId` and `sessionId`
- UPDATE all scan endpoint calls to include `userId`, `agentId`, `conversationId`
- UPDATE the `tool_call` handler to pass `state?.userId` and `state?.sessionId`
- See: `PATCH-webhook-route.ts` for exact code

### 3. `app/api/pubguard/scan/save/route.ts`
- REPLACE entire file with the fixed version
- Now accepts `user_id`/`userId`, `session_id`/`sessionId`, `user_type`/`userType`
- Uses shared `saveScanToSupabase()` from `lib/pubguard/supabase.ts`
- See: `app/api/pubguard/scan/save/route.ts` (complete replacement)

### 4. No changes needed to `lib/pubguard/supabase.ts`
- This file is already correct! It accepts `userId` and writes it properly.
- The problem was that nothing was calling it with the userId parameter.

## After Deploying

Run this SQL to verify scans now have user_id:
```sql
SELECT id, target_name, risk_level, user_id, user_type, created_at
FROM pubguard_scans
ORDER BY created_at DESC
LIMIT 10;
```

## Also Recommended: Fix mcmdennis profile gap
The `mcmdennis@gmail.com` auth user has no `pubguard_users` row.
Run this to create it:
```sql
INSERT INTO pubguard_users (id, email, source, plan, scan_count, created_at, updated_at)
VALUES (
  '6e083de4-03f8-4c3b-a511-22211d83e899',
  'mcmdennis@gmail.com',
  'auth',
  'free',
  0,
  '2026-01-21 05:46:04.798892+00',
  NOW()
);
```