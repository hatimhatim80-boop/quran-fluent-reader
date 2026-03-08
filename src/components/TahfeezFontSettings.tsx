import React, { useState } from 'react';
import { useSettingsStore, FontSettings } from '@/stores/settingsStore';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Type } from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'uthmanicHafs', label: 'عثماني حفص', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanicHafs', serif" },
  { value: 'uthmanicHafs22', label: 'عثماني حفص v22', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanicHafs22', serif" },
  { value: 'hafsNastaleeq', label: 'حفص نستعليق', preview: 'بِسۡمِ ٱللَّهِ', family: "'HafsNastaleeq', serif" },
  { value: 'uthmanTN', label: 'Uthman TN', preview: 'بِسۡمِ ٱللَّهِ', family: "'UthmanTN', serif" },
  { value: 'kfgqpcAnnotated', label: 'KFGQPC Annotated', preview: 'بِسۡمِ ٱللَّهِ', family: "'KFGQPCAnnotated', serif" },
  { value: 'amiri', label: 'Amiri', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri', serif" },
  { value: 'amiriQuran', label: 'Amiri Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'Amiri Quran', serif" },
  { value: 'scheherazade', label: 'Scheherazade New', preview: 'بِسۡمِ ٱللَّهِ', family: "'Scheherazade New', serif" },
  { value: 'meQuran', label: 'Me Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'me_quran', serif" },
  { value: 'qalam', label: 'Al Qalam Quran', preview: 'بِسۡمِ ٱللَّهِ', family: "'Al Qalam Quran', serif" },
];

export function TahfeezFontSettings() {
  const { settings, setFonts } = useSettingsStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-arabic text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          <span className="font-bold">إعدادات الخط</span>
          <span className="text-xs opacity-70">({FONT_OPTIONS.find(f => f.value === settings.fonts.fontFamily)?.label || settings.fonts.fontFamily})</span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="space-y-4 pt-2 animate-fade-in">
          {/* Font family */}
          <div className="space-y-2">
            <label className="text-xs font-arabic text-muted-foreground">نوع الخط</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFonts({ fontFamily: opt.value as FontSettings['fontFamily'] })}
                  className={`p-2 rounded-lg border text-right transition-all ${
                    settings.fonts.fontFamily === opt.value
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                  <span className="block text-base mt-0.5" style={{ fontFamily: opt.family }}>{opt.preview}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="space-y-1.5">
            <label className="text-xs font-arabic text-muted-foreground">
              حجم الخط: <span className="text-primary font-bold">{settings.fonts.quranFontSize}rem</span>
            </label>
            <Slider
              value={[settings.fonts.quranFontSize]}
              onValueChange={([v]) => setFonts({ quranFontSize: v })}
              min={0.8}
              max={3.5}
              step={0.05}
            />
          </div>

          {/* Line height */}
          <div className="space-y-1.5">
            <label className="text-xs font-arabic text-muted-foreground">
              ارتفاع السطر: <span className="text-primary font-bold">{settings.fonts.lineHeight}</span>
            </label>
            <Slider
              value={[settings.fonts.lineHeight]}
              onValueChange={([v]) => setFonts({ lineHeight: v })}
              min={1.2}
              max={3}
              step={0.1}
            />
          </div>

          {/* Font weight */}
          <div className="space-y-1.5">
            <label className="text-xs font-arabic text-muted-foreground">وزن الخط</label>
            <Select
              value={String(settings.fonts.fontWeight)}
              onValueChange={(v) => setFonts({ fontWeight: parseInt(v) as FontSettings['fontWeight'] })}
            >
              <SelectTrigger className="h-8 text-xs">
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

          {/* Preview */}
          <div
            className="p-3 rounded-lg border bg-card text-center"
            style={{
              fontFamily: 'var(--quran-font-family)',
              fontSize: `${settings.fonts.quranFontSize}rem`,
              lineHeight: settings.fonts.lineHeight,
              fontWeight: settings.fonts.fontWeight,
            }}
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </div>
        </div>
      )}
    </div>
  );
}
