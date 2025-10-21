# Doosell Backend - Supabase Implementation

## نمای کلی (Overview)

این پروژه از **Supabase** برای بک‌اند استفاده می‌کند و شامل:
- **RPC Functions**: منطق اصلی business logic در PostgreSQL
- **Edge Functions**: لایه رابط (relay layer) بین فرانت‌اند و RPC
- **Row Level Security (RLS)**: امنیت سطر به سطر داده‌ها
- **Idempotency**: جلوگیری از ثبت تکراری با کلید idempotency

---

## معماری (Architecture)

```
Frontend → Edge Function → RPC Function → Database
```

### اصول طراحی:
1. **RPC اتمیک**: تمام محاسبات XP، استریک، رتبه‌بندی و تاریخ در RPC انجام می‌شود
2. **Edge Function سبک**: فقط authentication + relay به RPC
3. **Client ساده**: فقط render و نمایش داده‌ها، بدون business logic
4. **Idempotency**: هر درخواست با کلید یکتا، نتیجه قطعی دارد

---

## RPC Functions

### 1. `rpc_log_practice`
ثبت تمرین روزانه با محاسبه خودکار XP، استریک و رتبه‌بندی لیگ.

**امضا:**
```sql
rpc_log_practice(
  p_user_id UUID,
  p_minutes INT,
  p_note TEXT,
  p_idempotency_key TEXT,
  p_utc_now TIMESTAMPTZ
)
```

**خروجی:**
```json
{
  "ok": true,
  "xpGained": 80,
  "xpToday": 160,
  "xpTotal": 1240,
  "streak": {
    "current": 7,
    "best": 15
  },
  "challenge": {
    "daysDone": 4,
    "target": 7,
    "isCompleted": false
  },
  "league": {
    "id": "uuid",
    "xpWeek": 320,
    "rank": 5
  }
}
```

**خطاها:**
- `DAILY_LIMIT`: بیش از 2 ثبت یا 240 دقیقه در روز
- `MIN_DURATION`: کمتر از 5 دقیقه
- `LEAGUE_LOCKED`: لیگ بسته است (HTTP 423)
- `MISSING_IDEMPOTENCY_KEY`: کلید idempotency ارسال نشده

**تست:** `supabase/tests/test-log-practice.sql`

---

### 2. `rpc_get_dashboard`
دریافت داده‌های کامل داشبورد کاربر.

**امضا:**
```sql
rpc_get_dashboard(p_user_id UUID)
```

**خروجی:**
```json
{
  "ok": true,
  "today": {
    "minutes": 120,
    "logs": 2,
    "xpToday": 80
  },
  "xpTotal": 1240,
  "streak": {
    "current": 7,
    "best": 15
  },
  "challenge": {
    "daysDone": 4,
    "target": 7,
    "isCompleted": false
  },
  "league": {
    "id": "uuid",
    "xpWeek": 320,
    "rank": 5
  }
}
```

**تست:** `supabase/tests/test-get-dashboard.sql`

---

### 3. `rpc_get_achievements`
دریافت سطح، مدال‌ها و پیشرفت کاربر.

**امضا:**
```sql
rpc_get_achievements(p_user_id UUID)
```

**خروجی:**
```json
{
  "ok": true,
  "level": {
    "current": 12,
    "xpForNextLevel": 760,
    "progressPercent": 62
  },
  "badges": [
    {
      "code": "first_practice",
      "title": "اولین تمرین",
      "kind": "achievement",
      "earned_at": "2025-01-01T10:00:00Z",
      "is_temporary": false
    }
  ],
  "league": {
    "id": "uuid",
    "status": "open",
    "xpWeek": 320,
    "rank": 5
  }
}
```

**تست:** `supabase/tests/test-get-achievements.sql`

---

### 4. `rpc_save_training_plan`
ذخیره برنامه تمرین هفتگی کاربر.

**امضا:**
```sql
rpc_save_training_plan(
  p_user_id UUID,
  p_days INT[],
  p_times JSONB,
  p_tz TEXT
)
```

**ورودی:**
- `p_days`: آرایه روزهای هفته [0..6] (0=یکشنبه)
- `p_times`: `{"08:00": true, "14:30": true}`
- `p_tz`: timezone (مثل `'Asia/Tehran'`)

**خروجی:**
```json
{
  "ok": true
}
```

**تست:** `supabase/tests/test-save-training-plan.sql`

---

### 5. `rpc_finalize_weekly_leagues` (Admin)
بستن لیگ‌های هفتگی و محاسبه رتبه‌ها.

**امضا:**
```sql
rpc_finalize_weekly_leagues()
```

**توضیح:**
- وضعیت لیگ‌ها را از `open` به `locked` تغییر می‌دهد
- رتبه‌بندی نهایی را محاسبه می‌کند
- وضعیت را به `finalized` تغییر می‌دهد

**تست:** `supabase/tests/test-admin-functions.sql`

---

### 6. `rpc_rollover_weekly_challenge` (Admin)
ایجاد چالش هفتگی جدید و غیرفعال کردن چالش قبلی.

**امضا:**
```sql
rpc_rollover_weekly_challenge()
```

**توضیح:**
- چالش فعلی (`active_week`) را null می‌کند
- چالش جدید با `active_week = تاریخ امروز` ایجاد می‌کند

**تست:** `supabase/tests/test-admin-functions.sql`

---

## Edge Functions

تمام Edge Functionها در `supabase/functions/` قرار دارند و فقط وظیفه relay به RPC را دارند:

- `log-practice`: ثبت تمرین (با idempotency)
- `get-dashboard`: دریافت داشبورد
- `get-achievements`: دریافت دستاوردها
- `save-training-plan`: ذخیره برنامه تمرین
- `finalize-weekly-leagues`: بستن لیگ‌ها (Admin)
- `rollover-weekly-challenge`: ایجاد چالش جدید (Admin)

### امنیت:
- **کاربری**: با `SUPABASE_ANON_KEY` + هدر `Authorization`
- **ادمین**: فقط از سرور با `SUPABASE_SERVICE_ROLE_KEY`

---

## تست‌ها (Tests)

همه تست‌ها در `supabase/tests/` قرار دارند:

```bash
# اجرای تست‌ها
psql $DATABASE_URL -f supabase/tests/test-log-practice.sql
psql $DATABASE_URL -f supabase/tests/test-get-dashboard.sql
psql $DATABASE_URL -f supabase/tests/test-get-achievements.sql
psql $DATABASE_URL -f supabase/tests/test-save-training-plan.sql
psql $DATABASE_URL -f supabase/tests/test-admin-functions.sql
```

### Coverage:
- ✅ ثبت تمرین با idempotency
- ✅ محدودیت روزانه (2 ثبت / 240 دقیقه)
- ✅ محاسبه XP و استریک
- ✅ رتبه‌بندی لیگ
- ✅ پیشرفت چالش
- ✅ سطح و مدال‌ها
- ✅ ذخیره برنامه تمرین
- ✅ فانکشن‌های ادمین

---

## Idempotency

**چرا مهم است؟**
- جلوگیری از ثبت تکراری در صورت قطع شبکه
- جلوگیری از دابل‌کلیک
- نتیجه قطعی برای هر درخواست

**نحوه استفاده:**
```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
const result = await supabase.functions.invoke('log-practice', {
  body: { 
    minutes: 120, 
    note: 'تمرین عصر', 
    idempotency_key: idempotencyKey 
  }
});

// در صورت retry، همان کلید را دوباره ارسال کنید
```

**نکته:** کلید idempotency در جدول `practice_logs.idempotency_key` ذخیره می‌شود و unique است.

---

## مستندات کامل

برای جزئیات بیشتر، مراجعه کنید به:
- **[RPC-DOCS.md](./tests/RPC-DOCS.md)**: مستندات کامل RPC Functionها
- **[test-log-practice.sql](./tests/test-log-practice.sql)**: تست‌های ثبت تمرین
- **[test-get-dashboard.sql](./tests/test-get-dashboard.sql)**: تست‌های داشبورد
- **[test-get-achievements.sql](./tests/test-get-achievements.sql)**: تست‌های دستاوردها
- **[test-save-training-plan.sql](./tests/test-save-training-plan.sql)**: تست‌های برنامه تمرین
- **[test-admin-functions.sql](./tests/test-admin-functions.sql)**: تست‌های ادمین

---

## مراحل بعدی

### Phase 2 - Frontend Integration:
- [ ] جایگزینی APIهای قدیمی با Edge Functionهای جدید
- [ ] استفاده از idempotency key در تمام درخواست‌های ثبت تمرین
- [ ] همسوسازی UI با پاسخ‌های RPC
- [ ] مدیریت خطاهای استاندارد (423, DAILY_LIMIT, MIN_DURATION)

برای چک‌لیست کامل، مراجعه کنید به [FRONTEND-PHASE2-CHECKLIST.md](../FRONTEND-PHASE2-CHECKLIST.md)

---

## ارتباط و گزارش باگ

در صورت مشاهده هر گونه مشکل یا باگ، لطفاً گزارش دهید.

**تاریخ تکمیل بک‌اند:** 2025-01-06  
**وضعیت:** ✅ Complete
