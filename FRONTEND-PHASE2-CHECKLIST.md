# مرحله ۲ فرانت — چک‌لیست قطعی

## ✅ وضعیت: همه موارد باید تیک بخورند تا مرحله Done باشد

---

## 1️⃣ جایگزینی APIها (اجباری)

- [ ] `logPractice()` → فراخوانی `supabase.functions.invoke('log-practice', { body: { minutes, note, idempotency_key } })`
- [ ] `getDashboard()` → فراخوانی `supabase.functions.invoke('get-dashboard')`
- [ ] `getAchievements()` → فراخوانی `supabase.functions.invoke('get-achievements')`
- [ ] `saveTrainingPlan()` → فراخوانی `supabase.functions.invoke('save-training-plan', { body: { days, times, tz } })`
- [ ] **هیچ محاسبه XP/استریک/رتبه/هفته/تاریخ روی کلاینت انجام نشود** — همه از سرور

---

## 2️⃣ کلید Idempotency (الزامی در ثبت تمرین)

- [ ] قبل از فراخوانی `logPractice` یک `uuid v4` تولید شود
- [ ] کلید در `body.idempotency_key` ارسال شود
- [ ] در صورت Retry (قطع شبکه)، **همان کلید** دوباره ارسال شود

**مثال:**
```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
const result = await supabase.functions.invoke('log-practice', {
  body: { minutes: 120, note: 'تمرین عصر', idempotency_key: idempotencyKey }
});
```

---

## 3️⃣ مدل داده و UI همسو با پاسخ‌های جدید

### صفحه ثبت تمرین (`PracticeLogScreen`)
- [ ] پاسخ `log-practice` را بخوان و مقادیر زیر را نمایش بده:
  - `xpGained` — امتیاز کسب‌شده
  - `xpToday` — امتیاز امروز
  - `streak.current` — استریک فعلی
  - `streak.best` — بهترین استریک
  - `league.xpWeek` — امتیاز هفتگی لیگ
  - `league.rank` — رتبه در لیگ (یا `null`)

### داشبورد (`DashboardScreen`)
- [ ] فقط با `getDashboard()` پر شود، بدون محاسبه کلاینت
- [ ] نمایش:
  - `today.minutes` — دقایق امروز
  - `today.count` — تعداد ثبت‌های امروز
  - `today.xpToday` — XP امروز
  - `xpTotal` — مجموع XP
  - `streak.current` / `streak.best`
  - `challenge.daysDone` / `challenge.target` / `challenge.isCompleted`
  - `league.id` / `league.xpWeek` / `league.rank`
  - `motivationalMessage` — پیام انگیزشی

### صفحه دستاوردها (`AchievementsScreen`)
- [ ] فقط با `getAchievements()` پر شود
- [ ] نمایش:
  - `level.current` — سطح فعلی
  - `level.xpForNextLevel` — XP مورد نیاز سطح بعد
  - `level.progressPercent` — درصد پیشرفت
  - `badges[]` — لیست مدال‌ها
  - `league` — اطلاعات لیگ

---

## 4️⃣ مدیریت خطا (ثابت و ساده)

- [ ] **423** → پیام: «لیگ بسته است؛ امتیاز قابل افزایش نیست.»
- [ ] **کد خطا `DAILY_LIMIT`** → پیام: «حداکثر دو ثبت یا ۲۴۰ دقیقه در روز مجاز است.»
- [ ] **کد خطا `MIN_DURATION`** → پیام: «حداقل ۵ دقیقه باید ثبت شود.»
- [ ] **کد خطا `MISSING_IDEMPOTENCY_KEY`** → پیام: «مشکل فنی؛ لطفاً دوباره تلاش کنید.»
- [ ] **سایر خطاها** → پیام عمومی: «خطای شبکه یا سرور؛ لطفاً دوباره تلاش کنید.»

**مثال:**
```typescript
try {
  const { data, error } = await supabase.functions.invoke('log-practice', { ... });
  if (error) throw error;
  if (!data.ok) {
    if (data.code === 'DAILY_LIMIT') {
      toast.error('حداکثر دو ثبت یا ۲۴۰ دقیقه در روز مجاز است.');
    } else if (data.code === 'MIN_DURATION') {
      toast.error('حداقل ۵ دقیقه باید ثبت شود.');
    }
    // ...
  }
} catch (err) {
  if (err.status === 423) {
    toast.error('لیگ بسته است؛ امتیاز قابل افزایش نیست.');
  } else {
    toast.error('خطای شبکه یا سرور؛ لطفاً دوباره تلاش کنید.');
  }
}
```

---

## 5️⃣ UX کوچک ولی مهم

- [ ] دکمه «ثبت تمرین» بعد از موفقیت، state را **فوراً** با پاسخ سرور آپدیت کند (بدون `refetch` اضافی)
- [ ] Loader استاندارد در حین درخواست
- [ ] دکمه Retry در صورت خطای شبکه
- [ ] **حذف Auto-join لیگ از کلاینت** (قبلاً انجام شده ✔)

---

## 6️⃣ امنیت و کلیدها

- [ ] همه Edge Functionهای کاربری با **Anon Key** و **هدر Authorization** کاربر صدا شوند
- [ ] فانکشن‌های ادمین (`finalize-weekly-leagues`, `rollover-weekly-challenge`) **فقط از سرور/کران** با **Service Role** صدا شوند

**مثال (کاربری):**
```typescript
const { data } = await supabase.functions.invoke('log-practice', {
  body: { ... },
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

---

## 7️⃣ تست‌های دودکشی (QA سریع روی فرانت)

- [ ] **دو بار ثبت ۱۲۰ دقیقه در یک روز** → `xpToday=160` (80+80) و دکمه ثبت غیرفعال یا پیام سقف
- [ ] **ری‌پلی همان درخواست با همان `idempotency_key`** → هیچ تغییر عددی؛ همان پاسخ قبلی برگردد
- [ ] **عبور از نیمه‌شب** (با تغییر ساعت دستگاه) → استریک در داشبورد درست محاسبه شود
- [ ] **وقتی لیگ قفل است** → پیام خطای `423` نمایش داده شود

---

## 🎯 تعریف Done

✅ همه موارد بالا تیک خورده باشند  
✅ هیچ محاسبه XP/استریک/رتبه روی کلاینت نباشد  
✅ تست‌های QA پاس شده باشند

---

## 📝 نکات مهم

1. **پاسخ Edge Function همان پاسخ RPC است** — فقط رله می‌کند
2. **تمام منطق در RPC** — Edge Function فقط authentication + call
3. **Idempotency key** جلوی دابل‌کلیک و network retry را می‌گیرد
4. **کلاینت فقط render** — هیچ business logic ندارد

---

**تاریخ ایجاد:** 2025-01-06  
**مرحله:** Phase 2 — Frontend Integration  
**وضعیت:** 🟡 در حال انجام
