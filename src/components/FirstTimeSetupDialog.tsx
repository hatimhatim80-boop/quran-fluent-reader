import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useSettingsStore, FontSettings } from '@/stores/settingsStore';
import { Settings2, Check, Maximize } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const FONT_PRESETS = [
  { value: 'uthman', label: 'خط حفص العثماني', family: "'KFGQPC HAFS Uthmanic Script', serif" },
  { value: 'uthmanicHafs', label: 'خط حفص الذكي', family: "'UthmanicHafs', serif" },
  { value: 'amiriQuran', label: 'Amiri Quran', family: "'Amiri Quran', serif" },
  { value: 'meQuran', label: 'Me Quran', family: "'me_quran', serif" },
];

const SIZE_PRESETS = [
  { label: 'صغير', quranSize: 1.2, meaningSize: 0.9, lineHeight: 1.6 },
  { label: 'متوسط', quranSize: 1.75, meaningSize: 1.15, lineHeight: 1.9 },
  { label: 'كبير', quranSize: 2.5, meaningSize: 1.4, lineHeight: 2.2 },
];

interface FirstTimeSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FirstTimeSetupDialog({ open, onClose }: FirstTimeSetupDialogProps) {
  const { settings, setFonts, setColors, setDisplay } = useSettingsStore();
  const [step, setStep] = useState(0);

  const handleFinish = () => {
    localStorage.setItem('quran-app-setup-done', '1');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            إعداد التطبيق
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4 mt-4">
            <p className="font-arabic text-sm text-muted-foreground text-center">
              مرحباً بك! اختر الإعدادات المناسبة لك
            </p>

            <Label className="font-arabic font-bold">اختر الخط المفضل</Label>
            <div className="grid grid-cols-2 gap-2">
              {FONT_PRESETS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFonts({ fontFamily: f.value as FontSettings['fontFamily'] })}
                  className={`p-3 rounded-lg border text-right transition-all ${
                    settings.fonts.fontFamily === f.value
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="block text-xl mt-1" style={{ fontFamily: f.family }}>بِسۡمِ ٱللَّهِ</span>
                </button>
              ))}
            </div>

            <Label className="font-arabic font-bold">حجم الخط</Label>
            <div className="grid grid-cols-3 gap-2">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setFonts({ quranFontSize: s.quranSize, meaningFontSize: s.meaningSize, lineHeight: s.lineHeight })}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    settings.fonts.quranFontSize === s.quranSize
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="font-arabic text-sm">{s.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="font-arabic">حجم خط القرآن: <span className="text-primary font-bold">{settings.fonts.quranFontSize}rem</span></Label>
              <Slider
                value={[settings.fonts.quranFontSize]}
                onValueChange={([v]) => setFonts({ quranFontSize: v })}
                min={0.8}
                max={3.5}
                step={0.05}
              />
            </div>

            <Label className="font-arabic font-bold">نمط التمييز</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setColors({ highlightStyle: 'background' })}
                className={`flex-1 p-3 rounded-lg border transition-all text-center ${
                  settings.colors.highlightStyle !== 'text-only'
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border'
                }`}
              >
                <div className="w-full h-5 rounded mb-1 flex items-center justify-center font-arabic text-sm" style={{ background: 'hsl(48 80% 90% / 0.6)' }}>كلمة</div>
                <span className="font-arabic text-xs">خلفية ملونة</span>
              </button>
              <button
                onClick={() => setColors({ highlightStyle: 'text-only' })}
                className={`flex-1 p-3 rounded-lg border transition-all text-center ${
                  settings.colors.highlightStyle === 'text-only'
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border'
                }`}
              >
                <div className="w-full h-5 rounded mb-1 flex items-center justify-center font-arabic text-sm font-bold" style={{ color: 'hsl(48 80% 40%)' }}>كلمة</div>
                <span className="font-arabic text-xs">نص ملون فقط</span>
              </button>
            </div>

            <Label className="font-arabic font-bold">ملاءمة الصفحة مع الشاشة</Label>
            <div
              onClick={() => setDisplay({ autoFitFont: !settings.display.autoFitFont })}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                settings.display.autoFitFont
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Maximize className="w-4 h-4" />
                <span className="font-arabic text-sm">تثبيت حجم النص مع عرض الشاشة</span>
              </div>
              <Switch checked={settings.display.autoFitFont} onCheckedChange={(v) => setDisplay({ autoFitFont: v })} />
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleFinish} className="gap-2 font-arabic">
                <Check className="w-4 h-4" />
                تم - ابدأ القراءة
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
