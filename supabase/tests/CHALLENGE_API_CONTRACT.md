# Challenge System API Contract

## Overview
This document defines the exact response format for challenge-related Edge Functions and RPCs.

---

## 1. `rpc_get_challenges_view(p_user_id uuid)`

**Purpose:** Retrieve all challenge data for a user (active, claimable, upcoming)

**Input:**
```typescript
{
  p_user_id: string // UUID
}
```

**Output:**
```typescript
{
  ok: boolean,
  currentWeek: {
    start: string,  // YYYY-MM-DD
    end: string     // YYYY-MM-DD
  },
  active: Array<{
    code: string,
    title: string,
    kind: "periodic" | "rolling",
    type: "days_in_period" | "streak" | "xp_target",
    targetDays: number,        // min_days from conditions
    daysDone: number,          // current progress (days completed)
    current?: number,          // for streak type (current streak value)
    status: "open" | "locked",
    isCompleted: boolean,
    isClaimable: boolean,
    windowStart: string | null,  // YYYY-MM-DD
    windowEnd: string | null     // YYYY-MM-DD
  }>,
  claimable: Array<{
    code: string,
    title: string,
    instanceId: string,  // UUID
    reward: {
      xp: number,
      badge_code?: string,
      claimable: boolean
    },
    completedAt: string  // ISO8601 timestamp
  }>,
  upcoming: Array<{
    code: string,
    title: string,
    kind: "periodic" | "rolling",
    period?: "week" | "month",
    windowStart: string,  // YYYY-MM-DD
    windowEnd: string     // YYYY-MM-DD
  }>
}
```

**Example Response:**
```json
{
  "ok": true,
  "currentWeek": {
    "start": "2025-10-04",
    "end": "2025-10-10"
  },
  "active": [
    {
      "code": "weekly_practice_5",
      "title": "هفته ۵ روز",
      "kind": "periodic",
      "type": "days_in_period",
      "targetDays": 5,
      "daysDone": 3,
      "status": "open",
      "isCompleted": false,
      "isClaimable": false,
      "windowStart": "2025-10-04",
      "windowEnd": "2025-10-10"
    },
    {
      "code": "streak_10",
      "title": "استریک ۱۰ روز",
      "kind": "rolling",
      "type": "streak",
      "targetDays": 10,
      "current": 7,
      "status": "open",
      "isCompleted": false,
      "isClaimable": false,
      "windowStart": null,
      "windowEnd": null
    }
  ],
  "claimable": [
    {
      "code": "weekend_warrior",
      "title": "جنگجوی آخر هفته",
      "instanceId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "reward": {
        "xp": 300,
        "badge_code": "weekend_badge",
        "claimable": true
      },
      "completedAt": "2025-10-06T18:45:32.123Z"
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

---

## 2. `rpc_claim_challenge_reward(p_user_id uuid, p_instance_id uuid)`

**Purpose:** Claim XP and badges for a completed claimable challenge

**Input:**
```typescript
{
  p_user_id: string,     // UUID
  p_instance_id: string  // UUID of challenge_instances
}
```

**Success Output:**
```typescript
{
  ok: boolean,
  xpAwarded: number,
  badgeGranted: boolean,
  claimedAt?: string  // ISO8601 timestamp (only on first successful claim)
}
```

**Error Output:**
```typescript
{
  ok: false,
  error: string  // Error message
}
```

**Example Responses:**

*First Claim (Success):*
```json
{
  "ok": true,
  "xpAwarded": 300,
  "badgeGranted": true,
  "claimedAt": "2025-10-07T12:34:56.789Z"
}
```

*Second Claim (Idempotent - Already Claimed):*
```json
{
  "ok": false,
  "error": "Rewards already claimed"
}
```

*Invalid Instance:*
```json
{
  "ok": false,
  "error": "Challenge instance not found"
}
```

*Not Yet Completed:*
```json
{
  "ok": false,
  "error": "Challenge not completed yet"
}
```

*Not Claimable (Auto-awarded):*
```json
{
  "ok": false,
  "error": "Challenge rewards are not claimable"
}
```

---

## 3. Edge Function: `challenge-rollover-periodic`

**Purpose:** Admin function to create new periodic challenge instances and lock old ones

**Headers Required:**
```
X-CRON-SECRET: <secret_token>
```

**Input:** None (triggered by cron)

**Success Output:**
```typescript
{
  ok: boolean,
  weekStart: string,      // YYYY-MM-DD
  weekEnd: string,        // YYYY-MM-DD
  monthStart: string,     // YYYY-MM-DD
  monthEnd: string,       // YYYY-MM-DD
  executedAt: string      // ISO8601
}
```

**Error Output:**
```typescript
{
  ok: false,
  error: string  // "Unauthorized" if secret is missing/wrong
}
```

**Example Response:**
```json
{
  "ok": true,
  "weekStart": "2025-10-11",
  "weekEnd": "2025-10-17",
  "monthStart": "2025-10-01",
  "monthEnd": "2025-10-31",
  "executedAt": "2025-10-11T00:00:05.123Z"
}
```

**Unauthorized Response:**
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

---

## Edge Function: `get-challenges-view`

**Purpose:** Frontend wrapper for `rpc_get_challenges_view`

**Authentication:** Requires valid JWT (Authorization header)

**Output:** Same as `rpc_get_challenges_view` above

---

## Edge Function: `claim-challenge-reward`

**Purpose:** Frontend wrapper for `rpc_claim_challenge_reward`

**Authentication:** Requires valid JWT (Authorization header)

**Input (JSON body):**
```typescript
{
  instanceId: string  // UUID
}
```

**Output:** Same as `rpc_claim_challenge_reward` above

---

## Idempotency Guarantees

### `rpc_claim_challenge_reward`
- **First call:** Awards XP, grants badge (if applicable), returns `xpAwarded > 0`
- **Second+ call:** Returns error `"Rewards already claimed"`, does NOT modify XP or badges
- **Database state:** `claimed_at` timestamp prevents duplicate awards

### `rpc_evaluate_challenges`
- **Same-day multiple calls:** Only increments `days_done` once per unique `local_date`
- **Mechanism:** `days_marked` JSONB array tracks unique dates

---

## Timezone Handling

All date calculations respect `profiles.tz`:

```sql
v_local_date := (now() AT TIME ZONE v_user_tz)::date;
```

**Example:**
- User in `Asia/Tehran` (UTC+3:30)
- UTC time: `2025-10-06 22:00:00`
- Local date: `2025-10-07` (next day in Tehran)

---

## Security Notes

1. **Admin Functions:** `challenge-rollover-periodic` requires `X-CRON-SECRET` header
2. **User Functions:** All RPC/Edge Functions validate `auth.uid()` via JWT
3. **RLS Policies:** All tables enforce row-level security

---

## Performance Indexes

```sql
-- Optimized queries for active challenges
CREATE INDEX idx_challenge_instances_user_status 
ON challenge_instances(user_id, status) WHERE status = 'open';

-- Fast lookup of claimable rewards
CREATE INDEX idx_user_challenge_progress_claimable 
ON user_challenge_progress(user_id, is_claimable) 
WHERE is_claimable = true AND claimed_at IS NULL;

-- Event processing queue
CREATE INDEX idx_outbox_events_processed 
ON outbox_events(processed, created_at) WHERE NOT processed;
```

---

## Testing Checklist

- [ ] `get-challenges-view` returns all 3 arrays (active/claimable/upcoming)
- [ ] `claim-challenge-reward` awards XP on first call
- [ ] Second claim returns idempotent error
- [ ] Same-day multiple logs count as 1 day
- [ ] Midnight boundary creates new day
- [ ] Timezone calculations use `profiles.tz`
- [ ] `challenge-rollover-periodic` rejects missing secret
- [ ] `challenge-rollover-periodic` succeeds with valid secret
- [ ] Unlock chains trigger on completion
- [ ] Auto-award vs claimable behavior distinct

---

**Last Updated:** 2025-10-07  
**Version:** 1.0
