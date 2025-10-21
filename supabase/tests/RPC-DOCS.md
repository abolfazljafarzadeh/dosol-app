# RPC Function Documentation

All core business logic has been moved to atomic RPC functions in PostgreSQL for consistency, reliability, and performance.

## User Functions

### rpc_log_practice
Logs a practice session with XP calculation, streak updates, medal awards, and league score updates.

**Parameters:**
- `p_user_id` (UUID): User ID
- `p_minutes` (INTEGER): Practice duration (5-240)
- `p_note` (TEXT): Optional note
- `p_idempotency_key` (TEXT): Unique request identifier
- `p_now_utc` (TIMESTAMP): Current UTC timestamp

**Returns:**
```json
{
  "ok": true,
  "xpGained": 80,
  "xpToday": 80,
  "xpTotal": 80,
  "streak": {
    "current": 1,
    "best": 1
  },
  "league": {
    "id": "...",
    "xpWeek": 80,
    "rank": null
  }
}
```

**Error Codes:**
- `MIN_DURATION`: Minutes out of range (5-240)
- `DAILY_LIMIT`: Maximum 2 logs per day or 240 minutes exceeded
- `LEAGUE_LOCKED`: League is locked/finalized (HTTP 423)

---

### rpc_save_training_plan
Saves user's training schedule.

**Parameters:**
- `p_user_id` (UUID): User ID
- `p_days` (INT[]): Days of week (0-6, Sunday=0)
- `p_times` (JSONB): Time slots `{"HH:MM": true}`
- `p_tz` (TEXT): Timezone (optional)

**Returns:**
```json
{
  "ok": true
}
```

---

### rpc_get_dashboard
Fetches aggregated dashboard data.

**Parameters:**
- `p_user_id` (UUID): User ID

**Returns:**
```json
{
  "ok": true,
  "today": {
    "minutes": 120,
    "logs": 2,
    "xpToday": 160
  },
  "xpTotal": 160,
  "streak": {
    "current": 1,
    "best": 1
  },
  "challenge": {
    "daysDone": 3,
    "target": 5,
    "isCompleted": false
  },
  "league": {
    "id": "...",
    "xpWeek": 160,
    "rank": 5
  }
}
```

---

### rpc_get_achievements
Fetches user level, badges, and league info.

**Parameters:**
- `p_user_id` (UUID): User ID

**Returns:**
```json
{
  "ok": true,
  "level": {
    "current": 2,
    "xpTotal": 250,
    "xpForNextLevel": 300,
    "progressPercent": 50
  },
  "badges": [
    {
      "id": "...",
      "code": "first_practice",
      "title": "اولین تمرین",
      "description": "...",
      "kind": "badge",
      "earnedAt": "2025-01-01T12:00:00Z"
    }
  ],
  "league": {
    "id": "...",
    "weekStart": "2025-01-06",
    "weekEnd": "2025-01-12",
    "rank": 3
  }
}
```

---

## Admin Functions (Service Role Only)

### rpc_finalize_weekly_leagues
Finalizes all locked leagues by calculating final ranks.

**Parameters:** None

**Returns:**
```json
{
  "ok": true,
  "finalized": 3
}
```

---

### rpc_rollover_weekly_challenge
Creates a new weekly challenge for the current week.

**Parameters:** None

**Returns:**
```json
{
  "ok": true,
  "message": "New weekly challenge created",
  "challengeId": "...",
  "weekStart": "2025-01-06",
  "weekEnd": "2025-01-12"
}
```

---

## Edge Function Integration

All Edge Functions now simply authenticate the user and call the corresponding RPC:

```typescript
const { data: result, error } = await supabaseClient.rpc('rpc_log_practice', {
  p_user_id: user.id,
  p_minutes: 60,
  p_note: 'Practice session',
  p_idempotency_key: 'unique-key',
  p_now_utc: new Date().toISOString(),
});
```

## Testing

Run all tests:
```bash
psql -h localhost -U postgres -d postgres -f supabase/tests/test-log-practice.sql
psql -h localhost -U postgres -d postgres -f supabase/tests/test-save-training-plan.sql
psql -h localhost -U postgres -d postgres -f supabase/tests/test-get-dashboard.sql
psql -h localhost -U postgres -d postgres -f supabase/tests/test-get-achievements.sql
psql -h localhost -U postgres -d postgres -f supabase/tests/test-admin-functions.sql
```
