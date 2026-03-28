

# خطة التنفيذ الشاملة: نظام إعدادات المراجعة المتكامل لبوابة التحفيظ

## ملخص

تنفيذ 9 محاور: إعدادات جديدة في المتجر، تطوير محرك التوزيع، تحديث الواجهة مع Preview، إضافة زر إعدادات أثناء الجلسة، إصلاح ربط المحرك، وإصلاح أخطاء الحزب/الجزء.

---

## الملفات المتأثرة

1. `src/stores/tahfeezStore.ts`
2. `src/utils/distributedBlanking.ts`
3. `src/components/TahfeezAutoQuizSettings.tsx`
4. `src/components/TahfeezQuizView.tsx`
5. `src/pages/Tahfeez.tsx`

---

## المرحلة 1: توسيع المتجر (`tahfeezStore.ts`)

إضافة 4 حالات جديدة مع setters و partialize:

- `hiddenWordsMode: 'fixed-count' | 'percentage'` (افتراضي: `'fixed-count'`)
- `hiddenWordsPercentage: number` (افتراضي: 25)
- `percentageScope: 'per-ayah' | 'per-visible-block'` (افتراضي: `'per-ayah'`)
- `wordSequenceMode: 'same-ayah-only' | 'allow-cross-ayah'` (افتراضي: `'same-ayah-only'`)

---

## المرحلة 2: تطوير محرك التوزيع (`distributedBlanking.ts`)

### تغييرات Interface:
إضافة `hiddenWordsMode`, `hiddenWordsPercentage`, `percentageScope`, `wordSequenceMode` إلى `DistributedBlankingParams`.

### منطق النسبة المئوية:
- دالة `isActualWord(text)`: تستثني علامات الوقف والأرقام والزخارف
- إذا `percentageScope = 'per-ayah'`: لكل مجموعة آيات يُحسب `Math.max(1, Math.round(percentage/100 * wordCount))`
- إذا `percentageScope = 'per-visible-block'`: يُحسب من إجمالي `allWordTokens`

### منطق التتابع المحسّن:
- إذا `wordSequenceMode = 'same-ayah-only'`: اختيار آية عشوائية ثم كلمات متتابعة داخلها فقط
- إذا `wordSequenceMode = 'allow-cross-ayah'`: نقطة بداية عشوائية مع امتداد للآية التالية

---

## المرحلة 3: تحديث واجهة الإعدادات (`TahfeezAutoQuizSettings.tsx`)

### إضافات في قسم "نمط المراجعة والتوزيع":

1. **وضع إخفاء الكلمات** (عند word/mixed): زران `عدد ثابت` / `نسبة مئوية`

2. **إذا نسبة مئوية**: أزرار سريعة (10% / 20% / 25% / 30% / 40% / 50% / 60% / 70% / 80%) + slider + عرض النسبة

3. **نطاق النسبة** (عند percentage): زران `لكل آية` / `للمقطع الظاهر`

4. **تتابع الكلمات** (عند sequential + word/mixed): زران `داخل الآية فقط` / `يمتد للآية التالية`

### Preview قبل زر "ابدأ":
صندوق ملخص يعرض:
- نوع المراجعة (آيات/كلمات/مختلط)
- العدد أو النسبة
- طريقة التوزيع
- النطاق (صفحة/سورة/جزء/حزب)

---

## المرحلة 4: إصلاح ربط المحرك (`TahfeezQuizView.tsx`)

### المشكلة الحالية:
السطر 343: `if (quizSource === 'auto' && distributionMode !== 'sequential')` — يعني أن وضع sequential لا يستخدم المحرك إلا في word/mixed. لكن في وضع `ayah-count` مع sequential، يبدأ دائمًا من أول الآيات (السطر 244-248: `for (let a = 0; a < count; a++)`).

### الإصلاح:
- توحيد المنطق: في وضع `ayah-count`، يمر دائمًا عبر `computeDistributedBlanks` بدلاً من الحلقة البسيطة
- تمرير الإعدادات الجديدة (`hiddenWordsMode`, `hiddenWordsPercentage`, `percentageScope`, `wordSequenceMode`) إلى المحرك
- إضافة المتغيرات الجديدة إلى dependency array

---

## المرحلة 5: زر إعدادات أثناء الجلسة (`Tahfeez.tsx`)

### إضافة Sheet في شريط التحكم:
- زر "⚙️" بجانب أزرار إيقاف/كشف الكل (السطر 1655)
- يفتح Sheet يحتوي على المكوّن `TahfeezAutoQuizSettings` (بدون زر ابدأ)
- تغيير الإعدادات ينعكس فوريًا على الجولة التالية

### إضافة prop `compact` لـ `TahfeezAutoQuizSettings`:
- عند `compact=true`: يخفي زر "ابدأ" ويعرض الإعدادات فقط

---

## المرحلة 6: إصلاح أول آية في الحزب/الجزء

### المشكلة:
في `ayah-count` mode (سطر 244-248 من TahfeezQuizView):
```
for (let a = 0; a < count; a++) {
  ayahGroups[a].forEach(t => keys.add(t.key));
}
```
هذا يبدأ دائمًا من أول آية. لكن المشكلة الحقيقية ليست هنا — بل أن المحرك الموزع لا يُستدعى في وضع sequential + ayah. بعد التوحيد في المرحلة 4، سيعمل المحرك بشكل صحيح ويبدأ من فهرس عشوائي باستخدام الـ seed.

---

## التفاصيل التقنية

```text
tahfeezStore (جديد)
├── hiddenWordsMode: 'fixed-count' | 'percentage'
├── hiddenWordsPercentage: number (10-80)
├── percentageScope: 'per-ayah' | 'per-visible-block'
└── wordSequenceMode: 'same-ayah-only' | 'allow-cross-ayah'

distributedBlanking.ts
├── isActualWord(text) → boolean (يستثني الوقف/أرقام/زخارف)
├── blankWords() → يدعم percentage mode
├── blankWordsPerAyah() → جديد: حساب لكل آية
├── sequential + same-ayah-only → كلمات متتابعة داخل آية واحدة
└── sequential + allow-cross-ayah → كلمات متتابعة عبر حدود الآيات

TahfeezAutoQuizSettings.tsx
├── وضع الكلمات: fixed-count / percentage (أزرار)
├── أزرار النسبة: 10-80% + slider
├── نطاق النسبة: per-ayah / per-visible-block
├── تتابع الكلمات: same-ayah / cross-ayah
├── Preview ملخص قبل زر ابدأ
└── prop compact لاستخدام أثناء الجلسة

TahfeezQuizView.tsx blankedKeys
└── يمر دائمًا عبر computeDistributedBlanks
    (يزيل الشرط distributionMode !== 'sequential')

Tahfeez.tsx
├── Sheet مع زر ⚙️ أثناء الجلسة
└── يحتوي TahfeezAutoQuizSettings compact
```

---

## ما لن يتأثر
- نظام SRS (يستخدم `forceBlankedKeys`)
- نظام الغريب (مكوّنات منفصلة)
- أنماط MCQ (next-ayah-mcq / next-waqf-mcq — لها مسار منفصل)
- نظام الصفحات والفهرس
- أنماط الإخفاء الحالية (beginning/middle/end/waqf) — تبقى كما هي، المحرك يضيف عليها

