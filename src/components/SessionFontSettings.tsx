import React, { useEffect, useMemo, useState } from 'react';
import { Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useSettingsStore, FontSettings } from '@/stores/settingsStore';
import type { SessionType } from '@/stores/sessionsStore';
import { getSessionFontSettings, saveSessionFontSettings } from '@/services/localSessionFontStore';

const FONT_OPTIONS = [
  { value: 'uthmanicHafs', label: 'عثماني حفص' },
  { value: 'uthmanicHafs22', label: 'عثماني حفص v22' },
  { value: 'hafsNastaleeq', label: 'حفص نستعليق' },
  { value: 'uthmanTN', label: 'Uthman TN' },
  { value: 'kfgqpcAnnotated', label: 'KFGQPC Annotated' },
  { value: 'amiri', label: 'Amiri' },
  { value: 'amiriQuran', label: 'Amiri Quran' },
  { value: 'scheherazade', label: 'Scheherazade New' },
  { value: 'meQuran', label: 'Me Quran' },
  { value: 'qalam', label: 'Al Qalam Quran' },
] as const;

export function SessionFontSettings({ sessionType = 'default', compact = false }: { sessionType?: SessionType | 'default'; compact?: boolean }) {
  const fonts = useSettingsStore((s) => s.settings.fonts);
  const setFonts = useSettingsStore((s) => s.setFonts);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionFontSettings(sessionType).then((saved) => {
      if (!cancelled && saved) setFonts(saved);
      if (!cancelled) setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [sessionType, setFonts]);

  const updateFonts = (patch: Partial<FontSettings>) => {
    const next = { ...fonts, ...patch };
    setFonts(patch);
    void saveSessionFontSettings(sessionType, {
      fontFamily: next.fontFamily,
      quranFontSize: next.quranFontSize,
      lineHeight: next.lineHeight,
      fontWeight: next.fontWeight,
    });
  };

  const selectedLabel = useMemo(() => FONT_OPTIONS.find((f) => f.value === fonts.fontFamily)?.label || fonts.fontFamily, [fonts.fontFamily]);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'} dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-arabic font-bold text-foreground">
          <Type className="w-4 h-4 text-primary" />
          <span>خط الجلسة</span>
        </div>
        <span className="text-[11px] font-arabic text-muted-foreground truncate max-w-[9rem]">{selectedLabel}</span>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-arabic text-muted-foreground">نوع الخط</label>
        <Select value={fonts.fontFamily} onValueChange={(v) => updateFonts({ fontFamily: v as FontSettings['fontFamily'] })} disabled={!hydrated}>
          <SelectTrigger className="h-9 text-xs font-arabic"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((font) => <SelectItem key={font.value} value={font.value} className="text-xs font-arabic">{font.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-arabic text-muted-foreground">حجم الخط: <span className="text-primary font-bold">{fonts.quranFontSize.toFixed(2)}rem</span></label>
        <Slider value={[fonts.quranFontSize]} onValueChange={([v]) => updateFonts({ quranFontSize: v })} min={0.8} max={3.5} step={0.05} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-arabic text-muted-foreground">تباعد الأسطر: <span className="text-primary font-bold">{fonts.lineHeight.toFixed(1)}</span></label>
        <Slider value={[fonts.lineHeight]} onValueChange={([v]) => updateFonts({ lineHeight: v })} min={1.2} max={3} step={0.1} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-arabic text-muted-foreground">وزن الخط</label>
        <Select value={String(fonts.fontWeight)} onValueChange={(v) => updateFonts({ fontWeight: Number(v) as FontSettings['fontWeight'] })}>
          <SelectTrigger className="h-9 text-xs font-arabic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="400">عادي 400</SelectItem>
            <SelectItem value="500">متوسط 500</SelectItem>
            <SelectItem value="600">ثقيل 600</SelectItem>
            <SelectItem value="700">غامق 700</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}