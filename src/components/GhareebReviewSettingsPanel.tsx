import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';

const HIGHLIGHT_PRESETS = [
  { value: '48 80% 90%', label: 'ذهبي فاتح' },
  { value: '210 75% 88%', label: 'أزرق هادئ' },
  { value: '150 45% 86%', label: 'أخضر فاتح' },
  { value: '20 70% 88%', label: 'برتقالي فاتح' },
];

const POPOVER_BG_PRESETS = [
  { value: '38 50% 97%', label: 'عاجي' },
  { value: '45 30% 95%', label: 'رملي' },
  { value: '210 30% 97%', label: 'ثلجي' },
  { value: '32 35% 93%', label: 'بيج' },
];

const POPOVER_WORD_PRESETS = [
  { value: '25 30% 18%', label: 'بني داكن' },
  { value: '222 35% 18%', label: 'كحلي' },
  { value: '0 0% 12%', label: 'أسود هادئ' },
];

const POPOVER_MEANING_PRESETS = [
  { value: '25 20% 35%', label: 'بني متوسط' },
  { value: '220 18% 32%', label: 'رمادي مزرق' },
  { value: '145 20% 30%', label: 'زيتوني' },
];

function resolveSelectValue(value: string, options: Array<{ value: string }>, fallback: string) {
  return options.some((item) => item.value === value) ? value : fallback;
}

interface GhareebReviewSettingsPanelProps {
  className?: string;
  highlightStyle?: 'color' | 'bg' | 'border';
  onHighlightStyleChange?: (value: 'color' | 'bg' | 'border') => void;
}

export function GhareebReviewSettingsPanel({ className, highlightStyle, onHighlightStyleChange }: GhareebReviewSettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const setFonts = useSettingsStore((s) => s.setFonts);
  const setDisplay = useSettingsStore((s) => s.setDisplay);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const setPopover = useSettingsStore((s) => s.setPopover);
  const setMeaningBox = useSettingsStore((s) => s.setMeaningBox);
  const setColors = useSettingsStore((s) => s.setColors);

  // Safe defaults – single merge source to avoid duplicated definitions
  const defaults = {
    fonts: { quranFontSize: 1.35, lineHeight: 2.2, font: 'uthmanicHafs' as const },
    display: { mode: 'continuous' as const, textAlign: 'justify' as const },
    autoplay: { speed: 1, thinkingGap: 500, autoPlayOnWordClick: false },
    popover: { width: 220, padding: 14 },
    meaningBox: { wordFontSize: 1.4, meaningFontSize: 1.1 },
    colors: {
      highlightColor: '48 80% 90%',
      popoverBackground: '38 50% 97%',
      popoverWordColor: '25 30% 18%',
      popoverMeaningColor: '25 20% 35%',
    },
  };

  const fonts = { ...defaults.fonts, ...settings.fonts };
  const display = { ...defaults.display, ...settings.display };
  const autoplay = { ...defaults.autoplay, ...settings.autoplay };
  const popover = { ...defaults.popover, ...settings.popover };
  const meaningBox = { ...defaults.meaningBox, ...settings.meaningBox };
  const colors = { ...defaults.colors, ...settings.colors };

  const highlightValue = resolveSelectValue(
    colors.highlightColor,
    HIGHLIGHT_PRESETS,
    HIGHLIGHT_PRESETS[0].value,
  );
  const popoverBgValue = resolveSelectValue(
    colors.popoverBackground,
    POPOVER_BG_PRESETS,
    POPOVER_BG_PRESETS[0].value,
  );
  const popoverWordValue = resolveSelectValue(
    colors.popoverWordColor,
    POPOVER_WORD_PRESETS,
    POPOVER_WORD_PRESETS[0].value,
  );
  const popoverMeaningValue = resolveSelectValue(
    colors.popoverMeaningColor,
    POPOVER_MEANING_PRESETS,
    POPOVER_MEANING_PRESETS[0].value,
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className={cn('font-arabic h-8 gap-1 shadow-sm', className)}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          إعدادات المراجعة
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[min(94vw,390px)] sm:max-w-[390px] overflow-y-auto px-4 py-5" dir="rtl">
        <SheetHeader>
          <SheetTitle className="font-arabic text-base">التحكم أثناء مراجعة الغريب</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-6 font-arabic">
          <section className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">إعدادات الصفحة</h4>

            <div className="space-y-2">
              <Label className="text-xs">نمط العرض</Label>
              <Select
                value={display.mode}
                onValueChange={(v) => setDisplay({ mode: v as any })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">مستمر</SelectItem>
                  <SelectItem value="madinah">مصحف المدينة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">حجم خط الصفحة: {fonts.quranFontSize.toFixed(2)}rem</Label>
              <Slider
                value={[fonts.quranFontSize]}
                onValueChange={([v]) => setFonts({ quranFontSize: +v.toFixed(2) })}
                min={0.8}
                max={2.2}
                step={0.05}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">ارتفاع السطر: {fonts.lineHeight.toFixed(1)}</Label>
              <Slider
                value={[fonts.lineHeight]}
                onValueChange={([v]) => setFonts({ lineHeight: +v.toFixed(1) })}
                min={1.4}
                max={3}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">محاذاة النص</Label>
              <Select
                value={display.textAlign}
                onValueChange={(v) => setDisplay({ textAlign: v as any })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="justify">ضبط كامل</SelectItem>
                  <SelectItem value="right">يمين</SelectItem>
                  <SelectItem value="center">وسط</SelectItem>
                  <SelectItem value="left">يسار</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">إعدادات التشغيل</h4>

            <div className="space-y-2">
              <Label className="text-xs">
                سرعة التشغيل: {autoplay.speed < 1 ? `${Math.round(autoplay.speed * 1000)}ms` : `${autoplay.speed}s`} / كلمة
              </Label>
              <Slider
                value={[autoplay.speed]}
                onValueChange={([v]) => setAutoplay({ speed: +v.toFixed(2) })}
                min={0.1}
                max={30}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">زمن الانتظار قبل الإظهار: {autoplay.thinkingGap}ms</Label>
              <Slider
                value={[autoplay.thinkingGap]}
                onValueChange={([v]) => setAutoplay({ thinkingGap: v })}
                min={200}
                max={2500}
                step={50}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-xs">تشغيل تلقائي عند الضغط على الكلمة</span>
              <Switch
                checked={autoplay.autoPlayOnWordClick}
                onCheckedChange={(v) => setAutoplay({ autoPlayOnWordClick: v })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">إعدادات إطار المعنى</h4>

            <div className="space-y-2">
              <Label className="text-xs">عرض الإطار: {popover.width}px</Label>
              <Slider
                value={[popover.width]}
                onValueChange={([v]) => setPopover({ width: Math.round(v) })}
                min={100}
                max={500}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">حشوة الإطار: {popover.padding}px</Label>
              <Slider
                value={[popover.padding]}
                onValueChange={([v]) => setPopover({ padding: Math.round(v) })}
                min={0}
                max={36}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">حجم كلمة الإطار: {meaningBox.wordFontSize.toFixed(2)}rem</Label>
              <Slider
                value={[meaningBox.wordFontSize]}
                onValueChange={([v]) => setMeaningBox({ wordFontSize: +v.toFixed(2) })}
                min={1}
                max={2.5}
                step={0.05}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">حجم معنى الإطار: {meaningBox.meaningFontSize.toFixed(2)}rem</Label>
              <Slider
                value={[meaningBox.meaningFontSize]}
                onValueChange={([v]) => setMeaningBox({ meaningFontSize: +v.toFixed(2) })}
                min={0.9}
                max={2}
                step={0.05}
              />
            </div>
          </section>

          <section className="space-y-3 pb-4">
            <h4 className="text-sm font-bold text-foreground">إعدادات الألوان والتمييز</h4>

            <div className="space-y-2">
              <Label className="text-xs">نوع تمييز الكلمة النشطة</Label>
              <Select
                value={highlightStyle || 'color'}
                onValueChange={(v) => onHighlightStyleChange?.(v as 'color' | 'bg' | 'border')}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">لون النص فقط</SelectItem>
                  <SelectItem value="bg">خلفية الكلمة</SelectItem>
                  <SelectItem value="border">إطار الكلمة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">لون تمييز الكلمة</Label>
              <Select value={highlightValue} onValueChange={(v) => setColors({ highlightColor: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HIGHLIGHT_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">خلفية إطار المعنى</Label>
              <Select value={popoverBgValue} onValueChange={(v) => setColors({ popoverBackground: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POPOVER_BG_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">لون كلمة الإطار</Label>
              <Select value={popoverWordValue} onValueChange={(v) => setColors({ popoverWordColor: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POPOVER_WORD_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">لون معنى الإطار</Label>
              <Select value={popoverMeaningValue} onValueChange={(v) => setColors({ popoverMeaningColor: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POPOVER_MEANING_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}