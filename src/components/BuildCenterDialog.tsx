import React, { useState } from 'react';
import { Rocket, Copy, Check, ExternalLink, Terminal, Apple, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BuildCenterDialogProps {
  children: React.ReactNode;
}

interface BuildStep {
  label: string;
  done: boolean;
  optional?: boolean;
}

const TAURI_STEPS: BuildStep[] = [
  { label: 'Node.js مثبت', done: true },
  { label: 'Rust toolchain مثبت', done: false },
  { label: 'tauri.conf.json موجود', done: false },
  { label: 'src-tauri/ موجود', done: false },
];

const CAPACITOR_STEPS: BuildStep[] = [
  { label: 'Node.js مثبت', done: true },
  { label: '@capacitor/core مثبت', done: false },
  { label: 'capacitor.config.ts موجود', done: false },
  { label: 'android/ مُهيأ', done: false, optional: true },
  { label: 'ios/ مُهيأ', done: false, optional: true },
];

const TAURI_COMMANDS = `# تثبيت Tauri CLI
npm install -D @tauri-apps/cli

# إنشاء مشروع Tauri
npx tauri init

# بناء التطبيق
npm run build && npx tauri build`;

const CAPACITOR_COMMANDS = `# تثبيت Capacitor
npm install @capacitor/core @capacitor/cli

# إنشاء التكوين
npx cap init "قارئ القرآن" "app.lovable.quran"

# إضافة Android
npx cap add android

# بناء ومزامنة
npm run build && npx cap sync

# تشغيل على جهاز
npx cap run android`;

const GITHUB_WORKFLOW = `name: Build Apps

on:
  push:
    tags:
      - 'v*'
  release:
    types: [created]

jobs:
  build-tauri:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - name: Install deps
        run: npm ci
      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        with:
          tagName: \${{ github.ref_name }}
          releaseName: 'v__VERSION__'

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - name: Build APK
        working-directory: android
        run: ./gradlew assembleRelease`;

export function BuildCenterDialog({ children }: BuildCenterDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('تم النسخ');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            مركز البناء - توليد تطبيق
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tauri" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tauri" className="gap-1 text-xs">
              <Terminal className="w-4 h-4" />
              Desktop (Tauri)
            </TabsTrigger>
            <TabsTrigger value="capacitor" className="gap-1 text-xs">
              <Smartphone className="w-4 h-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-1 text-xs">
              <ExternalLink className="w-4 h-4" />
              GitHub Actions
            </TabsTrigger>
          </TabsList>

          {/* Tauri Tab */}
          <TabsContent value="tauri" className="space-y-4 mt-4">
            <div className="page-frame p-4">
              <h3 className="font-arabic font-bold mb-3">قائمة التحقق</h3>
              <div className="space-y-2">
                {TAURI_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step.done ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                      {step.done && <Check className="w-3 h-3" />}
                    </div>
                    <span className={`font-arabic text-sm ${!step.done ? 'text-muted-foreground' : ''}`}>
                      {step.label}
                      {step.optional && <span className="text-xs text-muted-foreground"> (اختياري)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-frame p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-arabic font-bold">أوامر الإعداد</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(TAURI_COMMANDS, 'tauri')}
                  className="gap-1"
                >
                  {copiedSection === 'tauri' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                  <span className="font-arabic">نسخ</span>
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto text-left" dir="ltr">
                {TAURI_COMMANDS}
              </pre>
            </div>

            <div className="text-sm text-muted-foreground font-arabic">
              <p>• يتطلب تثبيت <a href="https://www.rust-lang.org/tools/install" target="_blank" className="text-primary underline">Rust</a></p>
              <p>• على Windows يتطلب <a href="https://visualstudio.microsoft.com/downloads/" target="_blank" className="text-primary underline">Build Tools</a></p>
            </div>
          </TabsContent>

          {/* Capacitor Tab */}
          <TabsContent value="capacitor" className="space-y-4 mt-4">
            <div className="page-frame p-4">
              <h3 className="font-arabic font-bold mb-3">قائمة التحقق</h3>
              <div className="space-y-2">
                {CAPACITOR_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step.done ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                      {step.done && <Check className="w-3 h-3" />}
                    </div>
                    <span className={`font-arabic text-sm ${!step.done ? 'text-muted-foreground' : ''}`}>
                      {step.label}
                      {step.optional && <span className="text-xs text-muted-foreground"> (اختياري)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-frame p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-arabic font-bold">أوامر الإعداد</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(CAPACITOR_COMMANDS, 'capacitor')}
                  className="gap-1"
                >
                  {copiedSection === 'capacitor' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                  <span className="font-arabic">نسخ</span>
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto text-left" dir="ltr">
                {CAPACITOR_COMMANDS}
              </pre>
            </div>

            <div className="text-sm text-muted-foreground font-arabic">
              <p>• يتطلب <a href="https://developer.android.com/studio" target="_blank" className="text-primary underline">Android Studio</a> لبناء Android</p>
              <p>• يتطلب <a href="https://developer.apple.com/xcode/" target="_blank" className="text-primary underline">Xcode</a> لبناء iOS (Mac فقط)</p>
            </div>
          </TabsContent>

          {/* GitHub Workflow Tab */}
          <TabsContent value="workflow" className="space-y-4 mt-4">
            <div className="page-frame p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-arabic font-bold">GitHub Actions Workflow</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(GITHUB_WORKFLOW, 'workflow')}
                  className="gap-1"
                >
                  {copiedSection === 'workflow' ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                  <span className="font-arabic">نسخ</span>
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-64 text-left" dir="ltr">
                {GITHUB_WORKFLOW}
              </pre>
            </div>

            <div className="text-sm text-muted-foreground font-arabic space-y-1">
              <p>• أنشئ ملف <code className="bg-muted px-1 rounded">.github/workflows/build.yml</code></p>
              <p>• سيتم البناء تلقائياً عند إنشاء Release أو tag جديد</p>
              <p>• ستجد الملفات في صفحة Releases</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t text-center">
          <Button asChild variant="outline">
            <a href="https://docs.lovable.dev/features/cloud" target="_blank" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              <span className="font-arabic">اقرأ التوثيق الكامل</span>
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
