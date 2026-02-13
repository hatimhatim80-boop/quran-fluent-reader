import React, { useState } from 'react';
import { Type, Palette, LayoutGrid, Settings2, RotateCcw, Download, Upload, Zap, Bug, Check, Rows3, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore, FontSettings, ColorSettings, PopoverSettings } from '@/stores/settingsStore';
import { toast } from 'sonner';
import { DataUpdatePanel } from './DataUpdatePanel';

interface SettingsDialogProps {
  children: React.ReactNode;
}

const FONT_OPTIONS = [
  { value: 'uthman', label: 'خط حفص العثماني', preview: 'بِسۡمِ ٱللَّهِ', family: "'KFGQPC HAFS Uthmanic Script', serif" },
  { value: 'uthmanicHafs', label: 'خط حفص الذكي', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanicHafs', serif" },
  { value: 'amiriQuran', label: 'Amiri Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri Quran', serif" },
  { value: 'amiri', label: 'Amiri', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri', serif" },
  { value: 'scheherazade', label: 'Scheherazade New', preview: 'بِسۡمِ ٱللَّهِ', family: "'Scheherazade New', serif" },
  { value: 'notoNaskh', label: 'Noto Naskh Arabic', preview: 'بِسۡمِ ٱللَّهِ', family: "'Noto Naskh Arabic', serif" },
];

const INTENSITY_OPTIONS = [
  { value: 'soft', label: 'خفيف', color: 'bg-yellow-200' },
  { value: 'medium', label: 'متوسط', color: 'bg-yellow-300' },
  { value: 'strong', label: 'قوي', color: 'bg-yellow-400' },
];

const SHADOW_OPTIONS = [
  { value: 'none', label: 'بدون', shadow: 'none' },
  { value: 'soft', label: 'خفيف', shadow: '0 2px 8px rgba(0,0,0,0.1)' },
  { value: 'medium', label: 'متوسط', shadow: '0 8px 24px rgba(0,0,0,0.15)' },
  { value: 'strong', label: 'قوي', shadow: '0 12px 32px rgba(0,0,0,0.2)' },
];

export function SettingsDialog({ children }: SettingsDialogProps) {
  const { 
    settings, 
    setFonts, 
    setColors, 
    setPopover, 
    setAutoplay, 
    setDisplay,
    setDebugMode,
    resetSettings, 
    exportSettings, 
    importSettings 
  } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quran-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير الإعدادات');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          if (importSettings(json)) {
            toast.success('تم استيراد الإعدادات');
          } else {
            toast.error('فشل استيراد الإعدادات');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين كافة الإعدادات؟')) {
      resetSettings();
      toast.success('تم إعادة تعيين الإعدادات');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            إعدادات التطبيق
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="fonts" className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="fonts" className="gap-1 text-xs">
              <Type className="w-4 h-4" />
              الخطوط
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-1 text-xs">
              <Rows3 className="w-4 h-4" />
              العرض
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-1 text-xs">
              <Palette className="w-4 h-4" />
              الألوان
            </TabsTrigger>
            <TabsTrigger value="popover" className="gap-1 text-xs">
              <LayoutGrid className="w-4 h-4" />
              النوافذ
            </TabsTrigger>
            <TabsTrigger value="autoplay" className="gap-1 text-xs">
              <Zap className="w-4 h-4" />
              التشغيل
            </TabsTrigger>
            <TabsTrigger value="update" className="gap-1 text-xs">
              <RefreshCw className="w-4 h-4" />
              التحديث
            </TabsTrigger>
          </TabsList>

          {/* Fonts Tab */}
          <TabsContent value="fonts" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic font-bold">نوع الخط</Label>
              <div className="grid grid-cols-2 gap-2">
                {FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFonts({ fontFamily: opt.value as FontSettings['fontFamily'] })}
                    className={`p-3 rounded-lg border text-right transition-all ${
                      settings.fonts.fontFamily === opt.value 
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">{opt.label}</span>
                    <span className="block text-xl mt-1" style={{ fontFamily: opt.family }}>{opt.preview}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">حجم خط القرآن: <span className="text-primary font-bold">{settings.fonts.quranFontSize}rem</span></Label>
              <Slider
                value={[settings.fonts.quranFontSize]}
                onValueChange={([v]) => setFonts({ quranFontSize: v })}
                min={1}
                max={3.5}
                step={0.1}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">حجم خط المعنى: <span className="text-primary font-bold">{settings.fonts.meaningFontSize}rem</span></Label>
              <Slider
                value={[settings.fonts.meaningFontSize]}
                onValueChange={([v]) => setFonts({ meaningFontSize: v })}
                min={0.8}
                max={2}
                step={0.05}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">ارتفاع السطر: <span className="text-primary font-bold">{settings.fonts.lineHeight}</span></Label>
              <Slider
                value={[settings.fonts.lineHeight]}
                onValueChange={([v]) => setFonts({ lineHeight: v })}
                min={1.2}
                max={3}
                step={0.1}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">وزن الخط</Label>
              <Select
                value={String(settings.fonts.fontWeight)}
                onValueChange={(v) => setFonts({ fontWeight: parseInt(v) as FontSettings['fontWeight'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">عادي (400)</SelectItem>
                  <SelectItem value="500">متوسط (500)</SelectItem>
                  <SelectItem value="600">ثقيل (600)</SelectItem>
                  <SelectItem value="700">غامق (700)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Live Preview */}
            <div 
              className="p-4 rounded-lg border bg-card"
              style={{
                fontFamily: `var(--quran-font-family)`,
                fontSize: `${settings.fonts.quranFontSize}rem`,
                lineHeight: settings.fonts.lineHeight,
                fontWeight: settings.fonts.fontWeight,
              }}
            >
              <p className="text-center">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            </div>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic font-bold">نمط عرض الصفحة</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDisplay({ mode: 'lines15' })}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    settings.display?.mode === 'lines15'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <Rows3 className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="font-arabic text-sm font-bold block">مصحف المدينة</span>
                  <span className="font-arabic text-[10px] text-muted-foreground">15 سطراً في الصفحة</span>
                </button>
                <button
                  onClick={() => setDisplay({ mode: 'continuous' })}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    settings.display?.mode === 'continuous'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <Type className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <span className="font-arabic text-sm font-bold block">تدفق مستمر</span>
                  <span className="font-arabic text-[10px] text-muted-foreground">نص متصل بدون فواصل</span>
                </button>
              </div>
            </div>

            {settings.display?.mode === 'lines15' && (
              <>
                <div className="space-y-3">
                  <Label className="font-arabic font-bold">عدد الأسطر في الصفحة (الجوال)</Label>
                  <Slider
                    value={[settings.display?.mobileLinesPerPage || 15]}
                    onValueChange={([v]) => setDisplay({ mobileLinesPerPage: v })}
                    min={5}
                    max={15}
                    step={1}
                  />
                  <div className="flex items-center justify-between text-xs font-arabic text-muted-foreground">
                    <span>٥ أسطر</span>
                    <span className="text-primary font-bold text-sm">{settings.display?.mobileLinesPerPage || 15} سطر</span>
                    <span>١٥ سطر</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-arabic font-bold">عدد الأسطر في الصفحة (اللابتوب)</Label>
                  <Slider
                    value={[settings.display?.desktopLinesPerPage || 15]}
                    onValueChange={([v]) => setDisplay({ desktopLinesPerPage: v })}
                    min={5}
                    max={15}
                    step={1}
                  />
                  <div className="flex items-center justify-between text-xs font-arabic text-muted-foreground">
                    <span>٥ أسطر</span>
                    <span className="text-primary font-bold text-sm">{settings.display?.desktopLinesPerPage || 15} سطر</span>
                    <span>١٥ سطر</span>
                  </div>
                  <p className="text-[10px] font-arabic text-muted-foreground">
                    يتم توزيع الكلمات بالتساوي على عدد الأسطر المحدد لكل جهاز
                  </p>
                </div>
              </>
            )}

            {/* Text Direction */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">اتجاه النص</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDisplay({ textDirection: 'rtl' })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    (settings.display?.textDirection || 'rtl') === 'rtl'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="font-arabic text-sm font-bold block">يمين ← يسار</span>
                  <span className="font-arabic text-[10px] text-muted-foreground">RTL (افتراضي)</span>
                </button>
                <button
                  onClick={() => setDisplay({ textDirection: 'ltr' })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    settings.display?.textDirection === 'ltr'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="font-arabic text-sm font-bold block">يسار → يمين</span>
                  <span className="font-arabic text-[10px] text-muted-foreground">LTR</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 text-sm font-arabic text-muted-foreground">
              <Check className="w-4 h-4 inline ml-1 text-green-600" />
              وضع &quot;مصحف المدينة&quot; يعرض كل سطر منفصلاً بمحاذاة مطابقة للمصحف المطبوع
            </div>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-5 mt-4">
            {/* Highlight style: background vs text-only */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">نمط التمييز</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setColors({ highlightStyle: 'background' })}
                  className={`flex-1 p-3 rounded-lg border transition-all text-center ${
                    (settings.colors as any).highlightStyle !== 'text-only'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="w-full h-5 rounded mb-1.5 flex items-center justify-center font-arabic text-sm" style={{ background: 'hsl(48 80% 90% / 0.6)' }}>كلمة</div>
                  <span className="font-arabic text-xs">خلفية ملونة</span>
                </button>
                <button
                  onClick={() => setColors({ highlightStyle: 'text-only' })}
                  className={`flex-1 p-3 rounded-lg border transition-all text-center ${
                    (settings.colors as any).highlightStyle === 'text-only'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="w-full h-5 rounded mb-1.5 flex items-center justify-center font-arabic text-sm font-bold" style={{ color: 'hsl(48 80% 40%)' }}>كلمة</div>
                  <span className="font-arabic text-xs">نص ملون فقط</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-arabic font-bold">شدة التمييز</Label>
              <div className="flex gap-2">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColors({ highlightIntensity: opt.value as ColorSettings['highlightIntensity'] })}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      settings.colors.highlightIntensity === opt.value 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className={`w-full h-2 rounded ${opt.color} mb-2`} />
                    <span className="font-arabic text-sm">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Page background color */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">لون خلفية الصفحة</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'افتراضي', value: '' },
                  { label: 'أبيض', value: '0 0% 100%' },
                  { label: 'كريمي', value: '38 45% 96%' },
                  { label: 'بيج', value: '35 30% 93%' },
                  { label: 'أصفر فاتح', value: '48 60% 95%' },
                  { label: 'أخضر فاتح', value: '140 20% 96%' },
                  { label: 'أزرق فاتح', value: '210 30% 96%' },
                  { label: 'داكن', value: '25 18% 10%' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setColors({ pageBackgroundColor: preset.value })}
                    className={`p-2 rounded-lg border transition-all ${
                      (settings.colors as any).pageBackgroundColor === preset.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div 
                      className="w-full h-6 rounded-md mb-1 border"
                      style={{ background: preset.value ? `hsl(${preset.value})` : 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(38 45% 96%) 100%)' }}
                    />
                    <span className="font-arabic text-[10px]">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color preview */}
            <div className="space-y-2">
              <Label className="font-arabic">معاينة التمييز</Label>
              <div className="p-6 rounded-lg border bg-card text-center font-arabic text-2xl">
                كلمة عادية <span className={`ghareeb-word ghareeb-word--active ${(settings.colors as any).highlightStyle === 'text-only' ? 'ghareeb-word--text-only' : ''}`}>الرَّحْمَٰنِ</span> كلمة عادية
              </div>
            </div>

            {/* Popover Color Presets */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">لون إطار المعنى</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'كريمي', bg: '38 50% 97%', text: '25 30% 18%', border: '35 25% 88%' },
                  { label: 'أبيض', bg: '0 0% 100%', text: '0 0% 15%', border: '0 0% 88%' },
                  { label: 'ذهبي', bg: '42 60% 94%', text: '30 40% 15%', border: '40 40% 78%' },
                  { label: 'أزرق فاتح', bg: '210 40% 96%', text: '210 30% 18%', border: '210 25% 85%' },
                  { label: 'أخضر فاتح', bg: '140 30% 96%', text: '140 25% 18%', border: '140 20% 85%' },
                  { label: 'داكن', bg: '25 18% 12%', text: '38 30% 90%', border: '25 15% 25%' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setColors({ 
                      popoverBackground: preset.bg, 
                      popoverText: preset.text,
                      popoverBorder: preset.border 
                    })}
                    className={`p-2 rounded-lg border transition-all ${
                      settings.colors.popoverBackground === preset.bg
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div 
                      className="w-full h-8 rounded-md mb-1.5 border"
                      style={{ 
                        background: `hsl(${preset.bg})`,
                        borderColor: `hsl(${preset.border})`,
                      }} 
                    />
                    <span className="font-arabic text-[11px]">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Popover Preview */}
            <div className="relative p-6 rounded-lg border bg-muted/30">
              <div 
                className="mx-auto border rounded-lg text-center p-3"
                style={{
                  background: `hsl(${settings.colors.popoverBackground})`,
                  borderColor: `hsl(${settings.colors.popoverBorder})`,
                  maxWidth: 200,
                }}
              >
                <div className="font-arabic text-lg font-bold" style={{ color: `hsl(${settings.colors.popoverText})` }}>وَقَارًا</div>
                <div className="font-arabic text-sm mt-1" style={{ color: `hsl(${settings.colors.popoverText})`, opacity: 0.85 }}>عَظَمَةً وَهَيْبَةً</div>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/30 text-sm font-arabic text-muted-foreground">
              <Check className="w-4 h-4 inline ml-1 text-green-600" />
              يتم تطبيق تغييرات الألوان فوراً على نص المصحف
            </div>
          </TabsContent>

          {/* Popover Tab */}
          <TabsContent value="popover" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic">عرض النافذة: <span className="text-primary font-bold">{settings.popover.width}px</span></Label>
              <Slider
                value={[settings.popover.width]}
                onValueChange={([v]) => setPopover({ width: v })}
                min={120}
                max={350}
                step={10}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">الحشو الداخلي: <span className="text-primary font-bold">{settings.popover.padding}px</span></Label>
              <Slider
                value={[settings.popover.padding]}
                onValueChange={([v]) => setPopover({ padding: v })}
                min={4}
                max={24}
                step={2}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">انحناء الزوايا: <span className="text-primary font-bold">{settings.popover.borderRadius}px</span></Label>
              <Slider
                value={[settings.popover.borderRadius]}
                onValueChange={([v]) => setPopover({ borderRadius: v })}
                min={0}
                max={24}
                step={2}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic font-bold">الظل</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHADOW_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPopover({ shadow: opt.value as PopoverSettings['shadow'] })}
                    className={`p-3 rounded-lg border transition-all ${
                      settings.popover.shadow === opt.value 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div 
                      className="w-12 h-8 bg-card rounded mx-auto mb-2" 
                      style={{ boxShadow: opt.shadow }}
                    />
                    <span className="font-arabic text-sm">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label className="font-arabic">إظهار السهم</Label>
              <Switch
                checked={settings.popover.showArrow}
                onCheckedChange={(v) => setPopover({ showArrow: v })}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">الشفافية: <span className="text-primary font-bold">{settings.popover.opacity}%</span></Label>
              <Slider
                value={[settings.popover.opacity]}
                onValueChange={([v]) => setPopover({ opacity: v })}
                min={50}
                max={100}
                step={5}
              />
            </div>

            {/* Popover Preview */}
            <div className="relative p-8 rounded-lg border bg-muted/30">
              <div 
                className="mx-auto bg-card border rounded-lg text-center"
                style={{
                  width: settings.popover.width,
                  padding: settings.popover.padding,
                  borderRadius: settings.popover.borderRadius,
                  opacity: settings.popover.opacity / 100,
                  boxShadow: SHADOW_OPTIONS.find(s => s.value === settings.popover.shadow)?.shadow || 'none',
                }}
              >
                <div className="ghareeb-popover__word font-arabic text-lg">وَقَارًا</div>
                <div className="ghareeb-popover__meaning font-arabic text-sm mt-1 text-muted-foreground">عَظَمَةً وَهَيْبَةً</div>
              </div>
            </div>
          </TabsContent>

          {/* Autoplay Tab */}
          <TabsContent value="autoplay" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic">سرعة التشغيل: <span className="text-primary font-bold">{settings.autoplay.speed} ثانية/كلمة</span></Label>
              <Slider
                value={[settings.autoplay.speed]}
                onValueChange={([v]) => setAutoplay({ speed: v })}
                min={1}
                max={10}
                step={0.5}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">فجوة التفكير: <span className="text-primary font-bold">{settings.autoplay.thinkingGap}ms</span></Label>
              <Slider
                value={[settings.autoplay.thinkingGap]}
                onValueChange={([v]) => setAutoplay({ thinkingGap: v })}
                min={200}
                max={2000}
                step={100}
              />
              <p className="text-xs text-muted-foreground font-arabic">
                المدة قبل ظهور المعنى
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">الانتقال التلقائي للصفحة التالية</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  عند انتهاء كلمات الصفحة
                </p>
              </div>
              <Switch
                checked={settings.autoplay.autoAdvancePage}
                onCheckedChange={(v) => setAutoplay({ autoAdvancePage: v })}
              />
            </div>

            <div className="h-px bg-border my-4" />

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  وضع التصحيح
                </Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  عرض معلومات تقنية للمطورين
                </p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={setDebugMode}
              />
            </div>
          </TabsContent>

          {/* Update Tab */}
          <TabsContent value="update" className="space-y-5 mt-4">
            <DataUpdatePanel />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 font-arabic">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} className="gap-1 font-arabic">
            <Upload className="w-4 h-4" />
            استيراد
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 font-arabic text-destructive mr-auto">
            <RotateCcw className="w-4 h-4" />
            إعادة تعيين
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
