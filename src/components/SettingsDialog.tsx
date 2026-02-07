import React, { useState } from 'react';
import { X, Type, Palette, LayoutGrid, Settings2, RotateCcw, Download, Upload } from 'lucide-react';
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
  { value: 'amiri', label: 'Amiri' },
  { value: 'notoNaskh', label: 'Noto Naskh Arabic' },
  { value: 'scheherazade', label: 'Scheherazade New' },
  { value: 'uthman', label: 'KFGQPC Uthmanic' },
];

const INTENSITY_OPTIONS = [
  { value: 'soft', label: 'خفيف' },
  { value: 'medium', label: 'متوسط' },
  { value: 'strong', label: 'قوي' },
];

const SHADOW_OPTIONS = [
  { value: 'none', label: 'بدون' },
  { value: 'soft', label: 'خفيف' },
  { value: 'medium', label: 'متوسط' },
  { value: 'strong', label: 'قوي' },
];

export function SettingsDialog({ children }: SettingsDialogProps) {
  const { settings, setFonts, setColors, setPopover, setAutoplay, resetSettings, exportSettings, importSettings } = useSettingsStore();
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
          <TabsList className="grid w-full grid-cols-3">
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
          </TabsList>

          {/* Fonts Tab */}
          <TabsContent value="fonts" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic">نوع الخط</Label>
              <Select
                value={settings.fonts.fontFamily}
                onValueChange={(v) => setFonts({ fontFamily: v as FontSettings['fontFamily'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">حجم خط القرآن: {settings.fonts.quranFontSize}rem</Label>
              <Slider
                value={[settings.fonts.quranFontSize]}
                onValueChange={([v]) => setFonts({ quranFontSize: v })}
                min={1}
                max={3}
                step={0.1}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">حجم خط المعنى: {settings.fonts.meaningFontSize}rem</Label>
              <Slider
                value={[settings.fonts.meaningFontSize]}
                onValueChange={([v]) => setFonts({ meaningFontSize: v })}
                min={0.8}
                max={2}
                step={0.05}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">ارتفاع السطر: {settings.fonts.lineHeight}</Label>
              <Slider
                value={[settings.fonts.lineHeight]}
                onValueChange={([v]) => setFonts({ lineHeight: v })}
                min={1.2}
                max={2.5}
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
                  <SelectItem value="400">عادي</SelectItem>
                  <SelectItem value="500">متوسط</SelectItem>
                  <SelectItem value="600">ثقيل</SelectItem>
                  <SelectItem value="700">غامق</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div 
              className="p-4 rounded-lg border bg-card"
              style={{
                fontFamily: settings.fonts.fontFamily === 'amiri' ? 'Amiri' : 'Noto Naskh Arabic',
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
              <Label className="font-arabic">شدة التمييز</Label>
              <Select
                value={settings.colors.highlightIntensity}
                onValueChange={(v) => setColors({ highlightIntensity: v as ColorSettings['highlightIntensity'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENSITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color preview */}
            <div className="space-y-2">
              <Label className="font-arabic">معاينة التمييز</Label>
              <div className="p-4 rounded-lg border bg-card text-center font-arabic text-xl">
                <span className="ghareeb-word ghareeb-word--active">الرَّحْمَٰنِ</span>
              </div>
            </div>
          </TabsContent>

          {/* Popover Tab */}
          <TabsContent value="popover" className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label className="font-arabic">عرض النافذة: {settings.popover.width}px</Label>
              <Slider
                value={[settings.popover.width]}
                onValueChange={([v]) => setPopover({ width: v })}
                min={120}
                max={350}
                step={10}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">الحشو الداخلي: {settings.popover.padding}px</Label>
              <Slider
                value={[settings.popover.padding]}
                onValueChange={([v]) => setPopover({ padding: v })}
                min={4}
                max={24}
                step={2}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">انحناء الزوايا: {settings.popover.borderRadius}px</Label>
              <Slider
                value={[settings.popover.borderRadius]}
                onValueChange={([v]) => setPopover({ borderRadius: v })}
                min={0}
                max={24}
                step={2}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">الظل</Label>
              <Select
                value={settings.popover.shadow}
                onValueChange={(v) => setPopover({ shadow: v as PopoverSettings['shadow'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHADOW_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="font-arabic">إظهار السهم</Label>
              <Switch
                checked={settings.popover.showArrow}
                onCheckedChange={(v) => setPopover({ showArrow: v })}
              />
            </div>

            <div className="space-y-3">
              <Label className="font-arabic">الشفافية: {settings.popover.opacity}%</Label>
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
                className="ghareeb-popover__content mx-auto"
                style={{
                  width: settings.popover.width,
                  padding: settings.popover.padding,
                  borderRadius: settings.popover.borderRadius,
                  opacity: settings.popover.opacity / 100,
                  boxShadow: settings.popover.shadow === 'none' ? 'none' :
                    settings.popover.shadow === 'soft' ? '0 2px 8px rgba(0,0,0,0.1)' :
                    settings.popover.shadow === 'strong' ? '0 12px 32px rgba(0,0,0,0.2)' :
                    '0 8px 24px rgba(0,0,0,0.15)',
                }}
              >
                <div className="ghareeb-popover__word">وَقَارًا</div>
                <div className="ghareeb-popover__meaning">عَظَمَةً وَهَيْبَةً</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} className="gap-1">
            <Upload className="w-4 h-4" />
            <span className="font-arabic">استيراد</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-destructive">
            <RotateCcw className="w-4 h-4" />
            <span className="font-arabic">إعادة تعيين</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
