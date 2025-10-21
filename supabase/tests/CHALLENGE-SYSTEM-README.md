# Challenge System - Complete Reference

## Overview
This document provides comprehensive testing and integration guidance for the challenge system.

## System Components

### 1. Database Tables
- `challenges` - Challenge definitions (periodic/rolling)
- `challenge_instances` - User-specific challenge instances with time windows
- `user_challenge_progress` - Progress tracking and completion status

### 2. RPC Functions
- `rpc_evaluate_challenges(user_id, local_date, tz)` - Evaluates progress after practice log
- `rpc_get_challenges_view(user_id)` - Returns all challenges for a user
- `rpc_claim_challenge_reward(user_id, instance_id)` - Claims reward for completed challenge
- `rpc_challenge_rollover_periodic()` - Admin function to create new periods (weekly/monthly)

### 3. Edge Functions
- `get-challenges-view` - HTTP wrapper for rpc_get_challenges_view (requires JWT)
- `claim-challenge-reward` - HTTP wrapper for rpc_claim_challenge_reward (requires JWT)
- `challenge-rollover-periodic` - Admin cron endpoint (requires X-CRON-SECRET header)

## API Contracts

### GET Challenges View
**Endpoint:** `get-challenges-view`  
**Auth:** Required (JWT)

**Response:**
```json
{
  "ok": true,
  "currentWeek": {
    "start": "2025-10-06",
    "end": "2025-10-12"
  },
  "active": [
    {
      "instanceId": "uuid",
      "code": "weekly_practice_5",
      "title": "هفته ۵ روز",
      "kind": "periodic",
      "type": "days_in_period",
      "targetDays": 5,
      "daysDone": 2,
      "status": "open",
      "isCompleted": false,
      "isClaimable": false,
      "windowStart": "2025-10-06",
      "windowEnd": "2025-10-12"
    },
    {
      "instanceId": "uuid",
      "code": "streak_10",
      "title": "استریک ۱۰ روز",
      "kind": "rolling",
      "type": "streak",
      "targetDays": 10,
      "current": 7,
      "status": "open",
      "isCompleted": false,
      "isClaimable": false
    }
  ],
  "claimable": [
    {
      "instanceId": "uuid",
      "code": "weekly_practice_5",
      "title": "هفته ۵ روز",
      "reward": {
        "xp": 100,
        "claimable": true
      },
      "completedAt": "2025-10-07T12:34:56Z"
    }
  ],
  "upcoming": [
    {
      "code": "monthly_champion",
      "title": "قهرمان ماهانه",
      "kind": "periodic",
      "period": "month",
      "windowStart": "2025-11-01",
      "windowEnd": "2025-11-30"
    }
  ]
}
```

### Claim Challenge Reward
**Endpoint:** `claim-challenge-reward`  
**Auth:** Required (JWT)  
**Body:** `{ "instanceId": "uuid" }`

**Success Response:**
```json
{
  "ok": true,
  "xpAwarded": 300,
  "badgeGranted": true,
  "claimedAt": "2025-10-07T12:34:56Z"
}
```

**Idempotent Response (already claimed):**
```json
{
  "ok": false,
  "error": "Rewards already claimed"
}
```

### Challenge Rollover (Admin)
**Endpoint:** `challenge-rollover-periodic`  
**Auth:** Required (X-CRON-SECRET header)  
**Headers:** `X-CRON-SECRET: <token>`

**Response:**
```json
{
  "ok": true,
  "weekStart": "2025-10-06",
  "weekEnd": "2025-10-12",
  "monthStart": "2025-10-01",
  "monthEnd": "2025-10-31",
  "executedAt": "2025-10-07T00:00:00Z"
}
```

**Unauthorized Response:**
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

## Testing

### Running SQL Tests
```bash
# Run comprehensive test suite
psql -f supabase/tests/test-challenge-system.sql

# Expected output: All tests PASSED
```

### Test Coverage
1. ✅ 5/7 days in week → auto-award
2. ✅ 10-day streak → claimable + unlock chain
3. ✅ Claimable list before/after claim
4. ✅ Claim idempotency (2nd call returns error, no XP change)
5. ✅ Same day multiple logs → counted once
6. ✅ Response contract validation

### Manual Testing with curl

**Get Challenges:**
```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/get-challenges-view' \
  -H 'Authorization: Bearer <jwt-token>' \
  -H 'Content-Type: application/json'
```

**Claim Reward:**
```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/claim-challenge-reward' \
  -H 'Authorization: Bearer <jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{"instanceId": "<uuid>"}'
```

**Rollover (Admin - requires secret):**
```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/challenge-rollover-periodic' \
  -H 'X-CRON-SECRET: <your-secret-token>' \
  -H 'Content-Type: application/json'
```

## Security Checklist

- [x] Admin rollover function requires secret token (X-CRON-SECRET)
- [x] JWT verification on user-facing endpoints
- [x] RLS policies on all tables
- [x] Idempotent claim operation
- [x] No duplicate unlocks (ON CONFLICT DO NOTHING)
- [x] Timezone-aware date calculations
- [x] Performance indexes added

## Integration Guide

### Frontend Usage (React/TypeScript)

```typescript
import { getChallengesView, claimChallengeReward } from '@/services/challengeService';

// Fetch challenges
const response = await getChallengesView();
if (response.ok) {
  console.log('Active:', response.active);
  console.log('Claimable:', response.claimable);
  console.log('Upcoming:', response.upcoming);
}

// Claim reward
const claimResponse = await claimChallengeReward(instanceId);
if (claimResponse.ok) {
  console.log(`Gained ${claimResponse.xpAwarded} XP!`);
  if (claimResponse.badgeGranted) {
    console.log('Badge earned!');
  }
}
```

### Setting Up Cron Job

**Step 1:** Set CRON_SECRET in Supabase Secrets (already done via add_secret tool)

**Step 2:** Create pg_cron job (run in SQL editor):
```sql
SELECT cron.schedule(
  'challenge-rollover-daily',
  '0 0 * * *', -- Daily at midnight UTC
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/challenge-rollover-periodic',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-CRON-SECRET', current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

## Troubleshooting

### Issue: Challenge not completing
- Check `user_challenge_progress.progress` for current state
- Verify `local_date` matches user timezone
- Ensure `rpc_evaluate_challenges` is called after practice log

### Issue: Claim returns "already claimed"
- This is expected idempotent behavior
- Check `user_challenge_progress.claimed_at` timestamp
- Frontend should hide claimed challenges

### Issue: Rollover 401 Unauthorized
- Verify X-CRON-SECRET header is set
- Check CRON_SECRET is configured in Supabase Secrets
- Ensure `verify_jwt = false` in config.toml

### Issue: No unlock chain
- Verify `challenges.unlock` field contains `on_complete_unlock_codes` array
- Check `challenge_instances` for newly created instances
- Look for ON CONFLICT logs in `outbox_events`

## Performance Notes

- Indexes added for:
  - `challenge_instances(user_id, status)`
  - `user_challenge_progress(user_id, is_claimable)`
  - `outbox_events(processed, created_at)`
  
- `rpc_evaluate_challenges` runs atomically within `rpc_log_practice` transaction
- Single day can have multiple logs, but only counted once via `days_marked` array

## Monitoring

Check `outbox_events` table for completion logs:
```sql
SELECT * FROM outbox_events 
WHERE topic = 'challenge.completed' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Sample Challenge Definitions

```sql
-- Weekly challenge (auto-award)
INSERT INTO challenges (code, title, kind, period, conditions, reward, auto_enroll)
VALUES (
  'weekly_practice_5',
  'هفته ۵ روز',
  'periodic',
  'week',
  '{"type":"days_in_period","min_days":5}'::jsonb,
  '{"xp":100,"claimable":false}'::jsonb,
  true
);

-- Streak challenge (claimable + unlock)
INSERT INTO challenges (code, title, kind, conditions, reward, unlock, auto_enroll)
VALUES (
  'streak_10',
  'استریک ۱۰ روز',
  'rolling',
  '{"type":"streak","min_days":10}'::jsonb,
  '{"xp":300,"claimable":true,"badge_code":"streak_master"}'::jsonb,
  '{"on_complete_unlock_codes":["monthly_champion"]}'::jsonb,
  true
);
```

## Next Steps for Frontend

1. **Create ChallengesScreen component** using `getChallengesView()`
2. **Display active challenges** with progress bars
3. **Show claimable modal** with animation on completion
4. **Implement claim button** calling `claimChallengeReward()`
5. **Add upcoming section** for locked challenges
6. **Toast notifications** for completions and claims

Refer to `src/services/challengeService.ts` for ready-to-use API functions.
