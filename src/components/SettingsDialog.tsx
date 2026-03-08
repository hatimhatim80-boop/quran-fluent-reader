import React, { useState } from 'react';
import { SettingsLivePreview } from './SettingsLivePreview';
import { Type, Palette, LayoutGrid, Settings2, RotateCcw, Download, Upload, Zap, Bug, Check, Rows3, RefreshCw, Trash2 } from 'lucide-react';
import { hardRefreshClean } from '@/utils/hardRefreshClean';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useSettingsStore, FontSettings, ColorSettings, PopoverSettings, MeaningBoxFontSettings, VerseNumberSettings } from '@/stores/settingsStore';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { toast } from 'sonner';
import { DataUpdatePanel } from './DataUpdatePanel';

const SURAHS_SETTINGS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name, startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

const JUZ_DATA_SETTINGS = Array.from({ length: 30 }, (_, i) => ({
  number: i + 1,
  page: [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582][i],
}));

interface SettingsDialogProps {
  children: React.ReactNode;
}

const FONT_OPTIONS = [
  { value: 'uthman', label: 'خط حفص العثماني', preview: 'بِسۡمِ ٱللَّهِ', family: "'KFGQPC HAFS Uthmanic Script', serif" },
  { value: 'uthmanicHafs', label: 'خط حفص الذكي', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanicHafs', serif" },
  { value: 'uthmanicHafs22', label: 'حفص العثماني v22', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanicHafs22', serif" },
  { value: 'hafsNastaleeq', label: 'حفص نستعليق', preview: 'بِسۡمِ ٱللَّهِ', family: "'HafsNastaleeq', serif" },
  { value: 'uthmanTN', label: 'عثمان طه نسخ', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanTN', serif" },
  { value: 'kfgqpcAnnotated', label: 'KFGQPC المشكّل', preview: 'بِسۡمِ ٱللَّهِ', family: "'KFGQPCAnnotated', serif" },
  { value: 'amiriQuran', label: 'Amiri Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri Quran', serif" },
  { value: 'amiri', label: 'Amiri', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri', serif" },
  { value: 'scheherazade', label: 'Scheherazade New', preview: 'بِسۡمِ ٱللَّهِ', family: "'Scheherazade New', serif" },
  { value: 'notoNaskh', label: 'Noto Naskh Arabic', preview: 'بِسۡمِ ٱللَّهِ', family: "'Noto Naskh Arabic', serif" },
  { value: 'meQuran', label: 'Me Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'me_quran', serif" },
  { value: 'qalam', label: 'Al Qalam Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'Al Qalam Quran', serif" },
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
    setMeaningBox,
    setVerseNumber,
    setDebugMode,
    resetSettings,
    resetFonts,
    resetColors,
    resetPopover,
    resetAutoplay,
    resetDisplay,
    resetMeaningBox,
    resetVerseNumber,
    exportSettings, 
    importSettings 
  } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetFonts(); toast.success('تم إرجاع إعدادات الخطوط للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </Button>
            </div>
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

              {/* Custom Font */}
              <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 space-y-2">
                <button
                  onClick={() => setFonts({ fontFamily: 'custom' })}
                  className={`w-full p-2 rounded-lg border text-center transition-all ${
                    settings.fonts.fontFamily === 'custom'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="text-xs text-muted-foreground">🔗 خط مخصص (رابط CSS)</span>
                </button>
                {settings.fonts.fontFamily === 'custom' && (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      placeholder="رابط CSS للخط (مثل: https://fonts.googleapis.com/...)"
                      value={(settings.fonts as any).customFontUrl || ''}
                      onChange={(e) => setFonts({ customFontUrl: e.target.value } as any)}
                      className="w-full text-xs p-2 rounded border bg-background text-foreground placeholder:text-muted-foreground"
                      dir="ltr"
                    />
                    <input
                      type="text"
                      placeholder="اسم عائلة الخط (font-family)"
                      value={(settings.fonts as any).customFontFamily || ''}
                      onChange={(e) => setFonts({ customFontFamily: e.target.value } as any)}
                      className="w-full text-xs p-2 rounded border bg-background text-foreground placeholder:text-muted-foreground"
                      dir="ltr"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">حجم خط القرآن: <span className="text-primary font-bold">{settings.fonts.quranFontSize}rem</span></Label>
              <Slider
                value={[settings.fonts.quranFontSize]}
                onValueChange={([v]) => setFonts({ quranFontSize: v })}
                min={0.8}
                max={3.5}
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
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetDisplay(); toast.success('تم إرجاع إعدادات العرض للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </Button>
            </div>


            {/* Text direction */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">اتجاه النص</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplay({ textDirection: 'rtl' })}
                  className={`flex-1 py-2 rounded-lg border text-sm font-arabic transition-all ${settings.display.textDirection === 'rtl' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'}`}
                >
                  يمين لليسار (RTL)
                </button>
                <button
                  onClick={() => setDisplay({ textDirection: 'ltr' })}
                  className={`flex-1 py-2 rounded-lg border text-sm font-arabic transition-all ${settings.display.textDirection === 'ltr' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'}`}
                >
                  يسار لليمين (LTR)
                </button>
              </div>
            </div>

            {/* Display Mode */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">طريقة العرض</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDisplay({ mode: 'madinah' })}
                  className={`rounded-lg border-2 p-3 text-center transition-all font-arabic text-sm ${settings.display.mode !== 'continuous' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/40'}`}
                >
                  مصحف منسق
                  <p className="text-[10px] text-muted-foreground mt-1">15 سطراً ثابتاً لكل صفحة</p>
                </button>
                <button
                  onClick={() => setDisplay({ mode: 'continuous' })}
                  className={`rounded-lg border-2 p-3 text-center transition-all font-arabic text-sm ${settings.display.mode === 'continuous' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/40'}`}
                >
                  تدفق مستمر
                  <p className="text-[10px] text-muted-foreground mt-1">نص متواصل بدون أسطر ثابتة</p>
                </button>
              </div>
            </div>

            {/* Text align */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">محاذاة النص</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['right', 'left', 'center', 'justify'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => setDisplay({ textAlign: align })}
                    className={`py-2 rounded-lg border text-xs font-arabic transition-all ${settings.display.textAlign === align ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'}`}
                  >
                    {align === 'right' ? 'يمين' : align === 'left' ? 'يسار' : align === 'center' ? 'وسط' : 'ضبط'}
                  </button>
                ))}
              </div>
            </div>

            {/* Balance last line */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">توازن السطر الأخير</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">ضبط توزيع كلمات السطر الأخير</p>
              </div>
              <Switch
                checked={settings.display.balanceLastLine ?? false}
                onCheckedChange={(v) => setDisplay({ balanceLastLine: v })}
              />
            </div>

            {/* Auto-fit font */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">ضبط الخط تلقائياً</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">يضبط حجم الخط ليناسب عرض الشاشة</p>
              </div>
              <Switch
                checked={settings.display.autoFitFont ?? false}
                onCheckedChange={(v) => setDisplay({ autoFitFont: v })}
              />
            </div>

            {/* Spacing Mode */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">نمط المسافات بين الكلمات</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDisplay({ spacingMode: 'natural' })}
                  className={`rounded-lg border-2 p-3 text-center transition-all font-arabic text-sm ${settings.display.spacingMode === 'natural' || !settings.display.spacingMode ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/40'}`}
                >
                  طبيعي
                  <p className="text-[10px] text-muted-foreground mt-1">كمصحف Quran Repeat Tutor</p>
                </button>
                <button
                  onClick={() => setDisplay({ spacingMode: 'spaced' })}
                  className={`rounded-lg border-2 p-3 text-center transition-all font-arabic text-sm ${settings.display.spacingMode === 'spaced' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/40'}`}
                >
                  متباعد
                  <p className="text-[10px] text-muted-foreground mt-1">مسافات إضافية بين الكلمات</p>
                </button>
              </div>
              {settings.display.spacingMode === 'spaced' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="font-arabic text-xs">مقدار التباعد</Label>
                    <span className="text-xs font-arabic text-muted-foreground">{settings.display.wordSpacing ?? 0.05}em</span>
                  </div>
                  <Slider
                    value={[settings.display.wordSpacing ?? 0.05]}
                    min={0}
                    max={2}
                    step={0.01}
                    onValueChange={([v]) => setDisplay({ wordSpacing: v })}
                  />
                  <div className="flex justify-between text-[10px] font-arabic text-muted-foreground">
                    <span>قليل</span>
                    <span>كثير</span>
                  </div>
                </div>
              )}

            {/* Verse Number Circle Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label className="font-arabic font-bold">دائرة رقم الآية</Label>
                <Button variant="ghost" size="sm" onClick={() => { resetVerseNumber(); toast.success('تم إرجاع إعدادات الدائرة للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>

              {/* Preview */}
              <div className="flex justify-center py-3">
                <span
                  className="inline-flex items-center justify-center font-bold"
                  style={{
                    fontSize: `${(settings.verseNumber?.fontSize ?? 0.52) * 24}px`,
                    minWidth: `${(settings.verseNumber?.circleSize ?? 2) * 14}px`,
                    height: `${(settings.verseNumber?.circleSize ?? 2) * 14}px`,
                    border: `${settings.verseNumber?.borderWidth ?? 2.5}px solid hsl(${settings.verseNumber?.borderColor ?? '43 60% 55%'})`,
                    borderRadius: settings.verseNumber?.shape === 'circle' ? '50%' : settings.verseNumber?.shape === 'rounded' ? '25%' : settings.verseNumber?.shape === 'square' ? '4px' : '0',
                    background: `hsl(${settings.verseNumber?.bgColor ?? '45 70% 83%'})`,
                    color: `hsl(${settings.verseNumber?.numberColor ?? '38 70% 28%'})`,
                    display: settings.verseNumber?.visible !== false ? 'inline-flex' : 'none',
                  }}
                >
                  ١٢٣
                </span>
              </div>

              {/* Visible toggle */}
              <div className="flex items-center justify-between">
                <Label className="font-arabic text-sm">إظهار الدائرة</Label>
                <Switch
                  checked={settings.verseNumber?.visible !== false}
                  onCheckedChange={(v) => setVerseNumber({ visible: v })}
                />
              </div>

              {/* Shape */}
              <div className="space-y-2">
                <Label className="font-arabic text-sm">الشكل</Label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { value: 'circle', label: 'دائرة' },
                    { value: 'rounded', label: 'مستدير' },
                    { value: 'square', label: 'مربع' },
                    { value: 'none', label: 'بدون' },
                  ] as const).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setVerseNumber({ shape: s.value })}
                      className={`py-1.5 rounded-lg border text-xs font-arabic transition-all ${(settings.verseNumber?.shape ?? 'circle') === s.value ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic text-sm">حجم الرقم</Label>
                  <span className="text-xs text-muted-foreground">{(settings.verseNumber?.fontSize ?? 0.52).toFixed(2)}em</span>
                </div>
                <Slider
                  value={[settings.verseNumber?.fontSize ?? 0.52]}
                  min={0.3}
                  max={1.2}
                  step={0.02}
                  onValueChange={([v]) => setVerseNumber({ fontSize: v })}
                />
              </div>

              {/* Circle size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic text-sm">حجم الدائرة</Label>
                  <span className="text-xs text-muted-foreground">{(settings.verseNumber?.circleSize ?? 2).toFixed(1)}em</span>
                </div>
                <Slider
                  value={[settings.verseNumber?.circleSize ?? 2]}
                  min={1}
                  max={4}
                  step={0.1}
                  onValueChange={([v]) => setVerseNumber({ circleSize: v })}
                />
              </div>

              {/* Border width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic text-sm">سماكة الحدود</Label>
                  <span className="text-xs text-muted-foreground">{(settings.verseNumber?.borderWidth ?? 2.5).toFixed(1)}px</span>
                </div>
                <Slider
                  value={[settings.verseNumber?.borderWidth ?? 2.5]}
                  min={0}
                  max={5}
                  step={0.5}
                  onValueChange={([v]) => setVerseNumber({ borderWidth: v })}
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="font-arabic text-xs">لون الرقم</Label>
                  <Input
                    value={settings.verseNumber?.numberColor ?? '38 70% 28%'}
                    onChange={(e) => setVerseNumber({ numberColor: e.target.value })}
                    className="text-xs h-8 font-mono"
                    dir="ltr"
                    placeholder="H S% L%"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-arabic text-xs">لون الحدود</Label>
                  <Input
                    value={settings.verseNumber?.borderColor ?? '43 60% 55%'}
                    onChange={(e) => setVerseNumber({ borderColor: e.target.value })}
                    className="text-xs h-8 font-mono"
                    dir="ltr"
                    placeholder="H S% L%"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-arabic text-xs">لون الخلفية</Label>
                  <Input
                    value={settings.verseNumber?.bgColor ?? '45 70% 83%'}
                    onChange={(e) => setVerseNumber({ bgColor: e.target.value })}
                    className="text-xs h-8 font-mono"
                    dir="ltr"
                    placeholder="H S% L%"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-5 mt-4">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetColors(); toast.success('تم إرجاع إعدادات الألوان للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </Button>
            </div>
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

            {/* Word background color chooser - only for background highlight mode */}
            {(settings.colors.highlightStyle !== 'text-only') && (
              <div className="space-y-3">
                <Label className="font-arabic font-bold">لون خلفية الكلمة الغريبة</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'متنوع', value: '' },
                    { label: 'ذهبي', value: '48 80% 75%' },
                    { label: 'أزرق', value: '200 70% 80%' },
                    { label: 'وردي', value: '340 60% 85%' },
                    { label: 'أخضر', value: '140 55% 78%' },
                    { label: 'بنفسجي', value: '270 50% 82%' },
                    { label: 'برتقالي', value: '25 80% 78%' },
                    { label: 'رمادي', value: '0 0% 88%' },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setColors({ highlightColor: c.value })}
                      className={`p-1.5 rounded-lg border transition-all ${
                        (settings.colors.highlightColor || '') === c.value
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <div 
                        className="w-full h-5 rounded-md mb-1" 
                        style={{ 
                          background: c.value 
                            ? `hsl(${c.value} / 0.55)` 
                            : 'linear-gradient(90deg, hsl(48 80% 75% / 0.55), hsl(200 70% 80% / 0.5), hsl(340 60% 85% / 0.5), hsl(140 55% 78% / 0.5), hsl(270 50% 82% / 0.5))'
                        }} 
                      />
                      <span className="font-arabic text-[9px]">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Word text color chooser - only for text-only highlight mode */}
            {(settings.colors.highlightStyle === 'text-only') && (
              <div className="space-y-3">
                <Label className="font-arabic font-bold">لون الكلمة الغريبة</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'أزرق', value: '210 80% 35%' },
                    { label: 'أحمر', value: '0 75% 40%' },
                    { label: 'أخضر', value: '140 60% 30%' },
                    { label: 'بنفسجي', value: '270 60% 40%' },
                    { label: 'برتقالي', value: '25 80% 40%' },
                    { label: 'وردي', value: '340 65% 45%' },
                    { label: 'ذهبي', value: '45 80% 35%' },
                    { label: 'فيروزي', value: '180 60% 30%' },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setColors({ highlightTextColor: c.value })}
                      className={`p-1.5 rounded-lg border transition-all ${
                        (settings.colors.highlightTextColor || '210 80% 35%') === c.value
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <div 
                        className="w-full h-5 rounded-md mb-1 flex items-center justify-center font-arabic text-sm font-bold"
                        style={{ color: `hsl(${c.value})` }}
                      >
                        كلمة
                      </div>
                      <span className="font-arabic text-[9px]">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  { label: 'كريمي', bg: '38 50% 97%', word: '25 30% 18%', meaning: '25 20% 35%', border: '35 25% 88%' },
                  { label: 'أبيض', bg: '0 0% 100%', word: '0 0% 15%', meaning: '0 0% 30%', border: '0 0% 88%' },
                  { label: 'ذهبي', bg: '42 60% 94%', word: '30 40% 15%', meaning: '30 30% 30%', border: '40 40% 78%' },
                  { label: 'أزرق فاتح', bg: '210 40% 96%', word: '210 30% 18%', meaning: '210 20% 35%', border: '210 25% 85%' },
                  { label: 'أخضر فاتح', bg: '140 30% 96%', word: '140 25% 18%', meaning: '140 20% 35%', border: '140 20% 85%' },
                  { label: 'داكن', bg: '25 18% 12%', word: '38 30% 90%', meaning: '38 25% 70%', border: '25 15% 25%' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setColors({ 
                      popoverBackground: preset.bg, 
                      popoverWordColor: preset.word,
                      popoverMeaningColor: preset.meaning,
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

            {/* Separate word/meaning color controls */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">لون الكلمة داخل الإطار</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'داكن', value: '25 30% 18%' },
                  { label: 'بني', value: '30 40% 25%' },
                  { label: 'أزرق', value: '210 50% 30%' },
                  { label: 'أخضر', value: '140 40% 25%' },
                  { label: 'ذهبي', value: '36 55% 42%' },
                  { label: 'أحمر', value: '0 50% 35%' },
                  { label: 'فاتح', value: '38 30% 90%' },
                  { label: 'أبيض', value: '0 0% 95%' },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setColors({ popoverWordColor: c.value })}
                    className={`p-1.5 rounded-lg border transition-all ${
                      (settings.colors.popoverWordColor || '25 30% 18%') === c.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="w-full h-4 rounded-md mb-1" style={{ background: `hsl(${c.value})` }} />
                    <span className="font-arabic text-[9px]">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-arabic font-bold">لون المعنى داخل الإطار</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'رمادي', value: '25 20% 35%' },
                  { label: 'بني', value: '30 30% 30%' },
                  { label: 'أزرق', value: '210 40% 35%' },
                  { label: 'أخضر', value: '140 30% 30%' },
                  { label: 'ذهبي', value: '36 45% 40%' },
                  { label: 'أحمر', value: '0 40% 35%' },
                  { label: 'فاتح', value: '38 25% 70%' },
                  { label: 'أبيض', value: '0 0% 85%' },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setColors({ popoverMeaningColor: c.value })}
                    className={`p-1.5 rounded-lg border transition-all ${
                      (settings.colors.popoverMeaningColor || '25 20% 35%') === c.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="w-full h-4 rounded-md mb-1" style={{ background: `hsl(${c.value})` }} />
                    <span className="font-arabic text-[9px]">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>



            {/* Container border color */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">لون إطار الحاوية</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'افتراضي', value: '' },
                  { label: 'ذهبي', value: '36 45% 60%' },
                  { label: 'بيج', value: '35 25% 82%' },
                  { label: 'رمادي', value: '0 0% 80%' },
                  { label: 'أزرق', value: '210 30% 75%' },
                  { label: 'أخضر', value: '140 25% 70%' },
                  { label: 'بني', value: '25 30% 50%' },
                  { label: 'داكن', value: '25 15% 25%' },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setColors({ containerBorderColor: c.value })}
                    className={`p-1.5 rounded-lg border transition-all ${
                      (settings.colors.containerBorderColor || '') === c.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="w-full h-4 rounded-md mb-1 border-2" style={{ borderColor: c.value ? `hsl(${c.value})` : 'hsl(var(--border))' }} />
                    <span className="font-arabic text-[9px]">{c.label}</span>
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
                <div className="font-arabic font-bold" style={{ color: `hsl(${settings.colors.popoverWordColor || '25 30% 18%'})`, fontSize: `${settings.meaningBox?.wordFontSize || 1.4}rem` }}>وَقَارًا</div>
                <div className="font-arabic mt-1" style={{ color: `hsl(${settings.colors.popoverMeaningColor || '25 20% 35%'})`, fontSize: `${settings.meaningBox?.meaningFontSize || 1.1}rem` }}>عَظَمَةً وَهَيْبَةً</div>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/30 text-sm font-arabic text-muted-foreground">
              <Check className="w-4 h-4 inline ml-1 text-green-600" />
              يتم تطبيق تغييرات الألوان فوراً على نص المصحف
            </div>
          </TabsContent>

          {/* Popover Tab */}
          <TabsContent value="popover" className="space-y-5 mt-4">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetPopover(); resetMeaningBox(); toast.success('تم إرجاع إعدادات النوافذ للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </Button>
            </div>

            {/* Meaning box font sizes */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">حجم خط الكلمة في الإطار: <span className="text-primary">{(settings.meaningBox?.wordFontSize || 1.4).toFixed(2)}rem</span></Label>
              <Slider
                value={[settings.meaningBox?.wordFontSize || 1.4]}
                onValueChange={([v]) => setMeaningBox({ wordFontSize: v })}
                min={0.8}
                max={2.5}
                step={0.05}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic font-bold">حجم خط المعنى في الإطار: <span className="text-primary">{(settings.meaningBox?.meaningFontSize || 1.1).toFixed(2)}rem</span></Label>
              <Slider
                value={[settings.meaningBox?.meaningFontSize || 1.1]}
                onValueChange={([v]) => setMeaningBox({ meaningFontSize: v })}
                min={0.6}
                max={2}
                step={0.05}
              />
            </div>
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
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetAutoplay(); toast.success('تم إرجاع إعدادات التشغيل للافتراضي'); }} className="gap-1 font-arabic text-xs text-muted-foreground hover:text-primary h-7 px-2">
                <RotateCcw className="w-3 h-3" />
                الافتراضي
              </Button>
            </div>
            <div className="space-y-3">
              <Label className="font-arabic">سرعة التشغيل: <span className="text-primary font-bold">{settings.autoplay.speed < 1 ? `${(settings.autoplay.speed * 1000).toFixed(0)}ms` : `${settings.autoplay.speed} ثانية`}/كلمة</span></Label>
              <Slider
                value={[settings.autoplay.speed]}
                onValueChange={([v]) => setAutoplay({ speed: +v.toFixed(2) })}
                min={0.1}
                max={30}
                step={0.1}
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

            <div className="space-y-3">
              <Label className="font-arabic">تكرار الصفحة: <span className="text-primary font-bold">{settings.autoplay.pageRepeatCount || 1} مرة</span></Label>
              <Slider
                value={[settings.autoplay.pageRepeatCount || 1]}
                onValueChange={([v]) => setAutoplay({ pageRepeatCount: v })}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground font-arabic">
                عدد مرات تكرار الصفحة قبل الانتقال للتالية
              </p>
            </div>

            {/* Auto Next Page */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">انتقال تلقائي للصفحة التالية</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  ينتقل تلقائياً بعد انتهاء الصفحة الحالية
                </p>
              </div>
              <Switch
                checked={settings.autoplay.autoAdvancePage ?? false}
                onCheckedChange={(v) => setAutoplay({ autoAdvancePage: v })}
              />
            </div>

            {/* Auto-advance delay — only shown when autoAdvancePage is enabled */}
            {settings.autoplay.autoAdvancePage && (
              <div className="space-y-3">
                <Label className="font-arabic">تأخير الانتقال: <span className="text-primary font-bold">{settings.autoplay.autoAdvanceDelay ?? 1.5} ثانية</span></Label>
                <Slider
                  value={[settings.autoplay.autoAdvanceDelay ?? 1.5]}
                  onValueChange={([v]) => setAutoplay({ autoAdvanceDelay: v })}
                  min={0.5}
                  max={10}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground font-arabic">
                  المدة بين نهاية الصفحة والانتقال للتالية
                </p>
              </div>
            )}

            {/* Keep Screen Awake */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">تثبيت الشاشة</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  منع إطفاء الشاشة أثناء التشغيل التلقائي
                </p>
              </div>
              <Switch
                checked={settings.autoplay.keepScreenAwake ?? false}
                onCheckedChange={(v) => setAutoplay({ keepScreenAwake: v })}
              />
            </div>

            {/* Auto-play on word click */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-arabic">تشغيل تلقائي عند النقر على كلمة</Label>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  يبدأ عرض المعاني فور النقر على أي كلمة
                </p>
              </div>
              <Switch
                checked={settings.autoplay.autoPlayOnWordClick ?? false}
                onCheckedChange={(v) => setAutoplay({ autoPlayOnWordClick: v })}
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

            {/* Hard Refresh */}
            <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
              <div>
                <p className="font-arabic font-bold text-sm text-destructive flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  تنظيف الكاش وإعادة التحميل
                </p>
                <p className="text-xs text-muted-foreground font-arabic mt-1">
                  يمسح Service Worker + Cache + localStorage + IndexedDB ثم يُعيد تحميل التطبيق من الصفر. مفيد عند ظهور أخطاء بسبب نسخة قديمة.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2 font-arabic"
                onClick={async () => {
                  if (confirm('سيتم مسح جميع البيانات المحفوظة وإعادة تحميل التطبيق. هل أنت متأكد؟')) {
                    await hardRefreshClean();
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                تنظيف الكاش وإعادة التحميل
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Live Preview */}
        <SettingsLivePreview visible={showPreview} onToggle={() => setShowPreview(!showPreview)} />

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
