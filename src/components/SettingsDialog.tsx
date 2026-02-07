import React, { useState } from 'react';
import { Type, Palette, LayoutGrid, Settings2, RotateCcw, Download, Upload, Zap, Bug, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore, FontSettings, ColorSettings, PopoverSettings } from '@/stores/settingsStore';
import { toast } from 'sonner';

interface SettingsDialogProps {
  children: React.ReactNode;
}

const FONT_OPTIONS = [
  { value: 'amiri', label: 'Amiri', preview: 'الرَّحْمَٰنِ' },
  { value: 'notoNaskh', label: 'Noto Naskh Arabic', preview: 'الرَّحْمَٰنِ' },
  { value: 'scheherazade', label: 'Scheherazade New', preview: 'الرَّحْمَٰنِ' },
  { value: 'uthman', label: 'KFGQPC Uthmanic', preview: 'الرَّحْمَٰنِ' },
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="fonts" className="gap-1 text-xs">
              <Type className="w-4 h-4" />
              الخطوط
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
                    <span className="block text-xl font-arabic mt-1">{opt.preview}</span>
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

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-5 mt-4">
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

            {/* Color preview */}
            <div className="space-y-2">
              <Label className="font-arabic">معاينة التمييز</Label>
              <div className="p-6 rounded-lg border bg-card text-center font-arabic text-2xl">
                كلمة عادية <span className="ghareeb-word ghareeb-word--active">الرَّحْمَٰنِ</span> كلمة عادية
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
