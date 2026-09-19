# قارئ القرآن الكريم - Quran Fluent Reader

تطبيق احترافي لقراءة القرآن الكريم مع ميزة عرض معاني الكلمات الغريبة والتشغيل التلقائي.

## المميزات

- 📖 **قراءة المصحف**: عرض نص القرآن الكريم صفحة بصفحة
- 🔤 **معاني الكلمات الغريبة**: إظهار معاني الكلمات الغريبة تلقائياً
- ▶️ **التشغيل التلقائي**: التنقل بين الكلمات تلقائياً مع إمكانية التحكم بالسرعة
- ⚙️ **إعدادات متقدمة**: تخصيص الخطوط والألوان وتنسيق النوافذ المنبثقة
- 📊 **تقرير المطابقة**: أداة للتحقق من دقة ربط الكلمات بالمعاني
- ✏️ **نظام التصحيح**: تعديل الأخطاء وتطبيقها على التكرارات
- 💾 **حفظ التقدم**: حفظ آخر صفحة وكلمة تم الوصول إليها

## التقنيات المستخدمة

- **React 18** + **TypeScript**
- **Vite** للبناء السريع
- **Tailwind CSS** للتنسيق
- **Zustand** لإدارة الحالة
- **shadcn/ui** للمكونات

## التشغيل المحلي

```bash
# تثبيت الاعتماديات
npm install

# تشغيل خادم التطوير
npm run dev

# بناء للإنتاج
npm run build
```

## بناء تطبيق Desktop (Tauri)

### المتطلبات
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) v18+

### خطوات البناء

```bash
# تثبيت Tauri CLI
npm install -D @tauri-apps/cli

# إنشاء مجلد Tauri (إذا لم يكن موجوداً)
npx tauri init

# بناء التطبيق
npm run build
npx tauri build
```

ستجد الملفات التنفيذية في:
- **Windows**: `src-tauri/target/release/quran-fluent-reader.exe`
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Linux**: `src-tauri/target/release/bundle/appimage/`

## بناء تطبيق Android (Capacitor)

### المتطلبات
- [Android Studio](https://developer.android.com/studio)
- Java JDK 21

### خطوات البناء

```bash
# تثبيت الحزم المقفلة ثم بناء التطبيق
npm ci
npm run build
npx cap sync android

# تحقق أن محرك التسميع الأصلي NoorSpeech مسجَّل داخل مشروع Android
grep -q "NoorSpeechPlugin" android/app/src/main/java/app/lovable/p9444b7b6261c4f408a4fa03f717ae338/MainActivity.java

# فتح في Android Studio
npx cap open android

# أو تشغيل مباشرة على جهاز متصل
npx cap run android
```

## GitHub Actions (البناء التلقائي)

عند إنشاء Release أو tag جديد (مثل `v1.0.0`)، سيتم تلقائياً:

1. بناء تطبيقات Desktop لـ:
   - Windows (exe)
   - macOS (dmg, app)
   - Linux (AppImage, deb)

2. بناء APK لـ Android

ستجد جميع الملفات في صفحة [Releases](../../releases).

### إعداد GitHub Actions

ملف Workflow موجود في `.github/workflows/build-apps.yml`

لتفعيله:
1. تأكد من صلاحيات GITHUB_TOKEN في Settings > Actions > General
2. أنشئ tag جديد: `git tag v1.0.0 && git push origin v1.0.0`
3. أو أنشئ Release من GitHub

## هيكل المشروع

```
├── src/
│   ├── components/        # مكونات React
│   ├── hooks/             # React hooks مخصصة
│   ├── pages/             # صفحات التطبيق
│   ├── stores/            # Zustand stores
│   ├── types/             # تعريفات TypeScript
│   └── utils/             # دوال مساعدة
├── public/
│   └── data/              # بيانات القرآن والغريب
├── src-tauri/             # إعدادات Tauri Desktop
├── capacitor.config.ts    # إعدادات Capacitor Mobile
└── .github/workflows/     # GitHub Actions
```

## المساهمة

1. Fork المشروع
2. أنشئ branch جديد: `git checkout -b feat/feature-name`
3. قم بالتعديلات
4. أنشئ Pull Request

## الترخيص

MIT License
