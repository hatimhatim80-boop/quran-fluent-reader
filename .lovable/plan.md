# خطة: نمط "التدريب على المعنى" في بوابة الغريب

النمط (`meaning_to_mushaf_word`) موجود فعليًا داخل `GhareebSRSPanel` كزر صغير ضمن لوحة المراجعة الذكية. الخطة تجعله **زرًا مستقلًا بارزًا** له شاشة إعداد كاملة، مع إعدادات جديدة (مدة بقاء التلوين، لون التمييز، عدد الأسئلة، التلميح، ...) وضمان ثبات صفحة المصحف.

## 1) نقطة الدخول — زر بارز في بوابة الغريب

داخل `src/components/QuranReader.tsx` في شريط أدوات بوابة الغريب (بجوار زر "المراجعة الذكية") نضيف زرًا منفصلًا:

- العنوان: **"التدريب على المعنى"**
- الوصف تحت العنوان: *"يعرض لك المعنى، ثم تختار الكلمة المناسبة من صفحة المصحف"*
- أيقونة `Target` بنفس نمط بقية الأزرار.

عند الضغط يُفتح مكوّن جديد `GhareebMeaningQuizSetup` كـ overlay داخل القارئ (نفس آلية فتح لوحة SRS عبر `setShowMeaningQuiz`).
نفصل الحالة عن SRS لتجنّب أي تداخل: `showSRS` يبقى للمراجعة الذكية فقط، ونضيف `showMeaningQuiz`.

كذلك في `src/pages/Sessions.tsx` يبقى نوع الجلسة `ghareeb-meaning-quiz` كما هو، لكن الاستئناف الآن يفتح مباشرة شاشة التدريب (لا شاشة SRS).

## 2) شاشة الإعداد — `GhareebMeaningQuizSetup.tsx` (ملف جديد)

محتوى الشاشة:

| الحقل | النوع |
|---|---|
| النطاق (سورة / صفحة / حزب / جزء) | `SRSScopeSelector` (مُعاد الاستخدام) |
| عدد الأسئلة | إدخال رقمي + خيارات سريعة (10/20/50/الكل) |
| الانتقال التلقائي | `Switch` (`autoAdvance`) |
| مدة بقاء تلوين الكلمة الصحيحة | شرائح: 1s / 2s / 3s / 5s + إدخال يدوي بالـ ms (`correctHighlightDurationMs`) |
| لون تمييز الكلمة الصحيحة | 5 ألوان جاهزة + تخصيص (`correctHighlightColor` بصيغة HSL token) |
| التلميح عند الخطأ | `Switch` + عدّاد "بعد عدد المحاولات الخاطئة" (`hintAfterWrong`) |
| اسم الجلسة (اختياري) | إدخال نصي |
| زر "معاينة" | يفتح سؤالًا تجريبيًا واحدًا بنفس الإعدادات دون حفظ |
| زر "ابدأ التدريب" | يبدأ الجلسة |
| زر "حفظ كجلسة وبدء" | ينشئ جلسة في `sessionsStore` نوعها `ghareeb-meaning-quiz` |

تُحفظ الإعدادات الافتراضية في `localStorage` تحت مفتاح `ghareeb_meaning_quiz_settings` (مستخدم واحد، بدون أي بيانات طلاب).

## 3) واجهة التدريب — تحديث `GhareebMeaningQuiz.tsx`

التعديلات على المكوّن القائم:

- استقبال `config: MeaningQuizConfig` يحوي:
  ```ts
  {
    autoAdvance: boolean;
    correctHighlightDurationMs: number; // 500–10000
    correctHighlightColor: string;      // HSL: "142 70% 45%"
    hintEnabled: boolean;
    hintAfterWrong: number;             // عدد المحاولات قبل ظهور التلميح
    questionLimit: number | null;
  }
  ```
- استبدال class الثابت `mq-correct` بأنماط محقونة من `correctHighlightColor` عبر `<style>` ديناميكي.
- على الإجابة الصحيحة:
  1. تطبيق التلوين على الكلمة.
  2. تثبيت التلوين لمدة `correctHighlightDurationMs` كاملة.
  3. **لا يبدأ مؤقت الانتقال** إلا بعد انتهاء هذه المدة، وفقط إذا `autoAdvance === true`.
  4. إذا كان `autoAdvance === false` يبقى التلوين ويظهر زر "السؤال التالي" البارز الموجود حاليًا في الفوتر (نوسّعه ليبقى ظاهرًا فور الحل).
- على الخطأ:
  - إذا `hintEnabled` و`wrongCount >= hintAfterWrong` نعرض تلميحًا (وميض خفيف على الموضع الصحيح أو إظهار أول حرف فقط بدون كشف الكلمة كلها).
  - وإلا: نفس السلوك الحالي (وميض أحمر + رسالة "حاول مرة أخرى").
- **قبول مواضع متعددة لنفس المعنى**: عند بناء `current.target` نحسب مجموعة `acceptableKeys` تشمل كل `uniqueKey` من `allWords` يطابق `canonicalize(meaning)` لنفس النص القرآني (`canonicalFormsCompatible(wordText)`). في `handleSurfaceClick` نتحقق من النص العربي للكلمة المنقورة مقابل أي كلمة مقبولة، ويُعتبر صحيحًا إذا تطابق مع أي منها.

## 4) ثبات صفحة المصحف

التلوين الحالي يستخدم `background` + `box-shadow` فقط، وهذا لا يغيّر التخطيط. سنُلزم نفسه:
- لا تغيير لـ `padding`/`margin`/`font-size`/`display` لعنصر `.quran-word`.
- لا إدراج DOM إضافي داخل سطر المصحف؛ التلوين CSS فقط على نفس العنصر.
- التأكد من استبعاد الكلاسات `verse-number`, `waqf-mark`, `hizb-mark`, وأي زخارف بإضافة فحص:
  ```ts
  const blocked = ['verse-number','waqf-mark','hizb-mark','sajda-mark'];
  if (blocked.some(c => wordEl.classList.contains(c))) return;
  ```

## 5) الاستئناف وحفظ الجلسة

- نوع الجلسة في `sessionsStore` يبقى `ghareeb-meaning-quiz`.
- بدلًا من تمرير الاستئناف عبر `GhareebSRSPanel`، نمرّره مباشرة من `QuranReader` إلى مكوّن `GhareebMeaningQuiz` عبر برّوب `resumeSessionId`.
- نخزّن في `session.settings`:
  ```
  { scopeLabel, pages, config: MeaningQuizConfig, currentIndex, score }
  ```
  ونحدّث `currentIndex` و`score` بعد كل سؤال (نفس آلية SRS الحالية في `SRSReviewSession`).
- عند الاستئناف من `Sessions.tsx` تُفتح `/mushaf?session=<id>&meaningQuiz=1` (موجود)، و`QuranReader` يفتح المكوّن مع `resumeSessionId`.

## 6) ما لن يتم إضافته (حسب الطلب)

- لا تقارير طلاب، لا تتبّع متعدد المستخدمين.
- لا جداول جديدة في IndexedDB.
- لا تغيير في منطق المراجعة الذكية أو القراءة العادية.

## ملفات سيتم تعديلها / إنشاؤها

- جديد: `src/components/GhareebMeaningQuizSetup.tsx`
- تعديل: `src/components/GhareebMeaningQuiz.tsx` — إضافة `config`، تثبيت التلوين، التلميح، قبول مواضع متعددة، استئناف.
- تعديل: `src/components/QuranReader.tsx` — حالة `showMeaningQuiz` وزر بارز جديد، فصل الاستئناف عن SRS.
- تعديل: `src/components/GhareebSRSPanel.tsx` — إزالة زر/شاشة "meaning-setup" من داخل لوحة SRS (تنظيف فقط).
- تعديل بسيط: `src/pages/Sessions.tsx` — توجيه الاستئناف إلى المكوّن الجديد (نفس URL).

## القبول

- زر "التدريب على المعنى" ظاهر بوضوح في شريط أدوات بوابة الغريب وليس داخل المراجعة الذكية.
- شاشة الإعداد تحوي كل الحقول المطلوبة وتعمل مع كل النطاقات.
- الكلمة الصحيحة تبقى ملوّنة كامل المدة المُعدّة قبل الانتقال.
- صفحة المصحف لا تتزحزح أثناء التلوين.
- أرقام الآيات وعلامات الوقف والحزب غير قابلة للضغط.
- نفس المعنى في مواضع متعددة يقبل كل المواضع الصحيحة.
