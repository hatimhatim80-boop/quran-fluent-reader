import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { MeaningQuizConfig, GhareebHighlightStyle } from './GhareebMeaningQuizSetup';
import { MEANING_SOURCE_LABELS, MeaningSource } from '@/hooks/useAllGhareebSources';
import { toast } from 'sonner';

interface Props {
  config: MeaningQuizConfig;
  onChange: (next: MeaningQuizConfig) => void;
  onSourceChange?: (src: MeaningSource) => void | Promise<void>;
  onClose: () => void;
}

const HIGHLIGHT_STYLE_OPTIONS: { value: GhareebHighlightStyle; label: string }[] = [
  { value: 'textColor', label: 'لون الكلمة' },
  { value: 'background', label: 'خلفية' },
  { value: 'border', label: 'إطار' },
  { value: 'none', label: 'بدون' },
];

const DURATION_PRESETS = [1000, 2000, 3000, 5000];
const REPEAT_PRESETS = [0, 1, 2, 3, 5];
const SOURCE_OPTIONS: MeaningSource[] = ['muyassar', 'duroobi', 'both'];

export function MeaningQuizLiveSettings({ config, onChange, onSourceChange, onClose }: Props) {
  const [pendingSource, setPendingSource] = useState<MeaningSource | null>(null);

  const set = <K extends keyof MeaningQuizConfig>(k: K, v: MeaningQuizConfig[K]) =>
    onChange({ ...config, [k]: v });

  const requestSourceChange = (src: MeaningSource) => {
    if (src === config.meaningSource) return;
    setPendingSource(src);
  };

  const confirmSourceChange = async () => {
    if (!pendingSource) return;
    const src = pendingSource;
    setPendingSource(null);
    if (onSourceChange) {
      try {
        await onSourceChange(src);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[MeaningQuiz] source change failed', e);
        toast.error('تعذر تغيير المصدر');
        return;
      }
    } else {
      set('meaningSource', src);
    }
    toast.success(`تم تبديل المصدر إلى: ${MEANING_SOURCE_LABELS[src]}`);
  };

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-auto" dir="rtl">
      <div className="sticky top-0 bg-card/90 border-b border-border px-3 py-2 flex items-center justify-between">
        <span className="font-arabic text-sm font-bold text-primary">إعدادات الجلسة</span>
        <button onClick={onClose} className="nav-button w-7 h-7 rounded-full" aria-label="إغلاق">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 font-arabic max-w-md mx-auto">
        {/* Highlight ghareeb words */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">تمييز كلمات الغريب في الصفحة</Label>
            <Switch
              checked={config.ghareebWordsHighlightEnabled}
              onCheckedChange={(v) => set('ghareebWordsHighlightEnabled', v)}
            />
          </div>
          {config.ghareebWordsHighlightEnabled && (
            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set('ghareebWordsHighlightStyle', opt.value)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                    config.ghareebWordsHighlightStyle === opt.value
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Correct highlight duration */}
        <section className="space-y-2">
          <Label className="text-sm">مدة بقاء تمييز الإجابة الصحيحة</Label>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((ms) => (
              <button
                key={ms}
                onClick={() => set('correctHighlightDurationMs', ms)}
                className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                  config.correctHighlightDurationMs === ms
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {(ms / 1000).toFixed(1)} ث
              </button>
            ))}
          </div>
        </section>

        {/* Repeat correct word */}
        <section className="space-y-2">
          <Label className="text-sm">عدد مرات إعادة الكلمة الصحيحة</Label>
          <div className="flex flex-wrap gap-1.5">
            {REPEAT_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => set('correctWordReviewRepeatCount', n)}
                className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                  config.correctWordReviewRepeatCount === n
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {n === 0 ? 'بدون' : `${n}×`}
              </button>
            ))}
          </div>
        </section>

        {/* Reschedule correct word using SRS intervals */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-sm">إعادة الكلمة الصحيحة بمدد المراجعة الذكية</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">يعمل فقط داخل تدريب المعنى بالمراجعة الذكية</p>
            </div>
            <Switch
              checked={!!config.rescheduleCorrectAsSRS}
              onCheckedChange={(v) => set('rescheduleCorrectAsSRS', v)}
            />
          </div>
        </section>

        {/* Show correct on wrong (hint) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">إظهار تلميح للجواب بعد الخطأ</Label>
            <Switch
              checked={config.hintEnabled}
              onCheckedChange={(v) => set('hintEnabled', v)}
            />
          </div>
        </section>

        {/* Show surah name */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">إظهار اسم السورة</Label>
            <Switch
              checked={config.showSurahName !== false}
              onCheckedChange={(v) => set('showSurahName', v)}
            />
          </div>
        </section>

        {/* Auto-advance on empty click */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">الانتقال بالضغط على أي مكان بعد الإجابة</Label>
            <Switch
              checked={config.advanceOnEmptyClick}
              onCheckedChange={(v) => set('advanceOnEmptyClick', v)}
            />
          </div>
        </section>

        {/* Meaning source */}
        <section className="space-y-2">
          <Label className="text-sm">مصدر معاني الغريب</Label>
          <div className="flex flex-col gap-1.5">
            {SOURCE_OPTIONS.map((src) => (
              <button
                key={src}
                onClick={() => requestSourceChange(src)}
                className={`text-xs text-right px-3 py-2 rounded-md border transition-colors ${
                  config.meaningSource === src
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {MEANING_SOURCE_LABELS[src]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            تغيير المصدر يعيد بناء أسئلة الجلسة الحالية.
          </p>
        </section>

        <div className="pt-2">
          <Button onClick={onClose} className="w-full">تطبيق وإغلاق</Button>
        </div>
      </div>

      {/* Source-change confirm overlay */}
      {pendingSource && (
        <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-4 max-w-xs w-full font-arabic" dir="rtl">
            <p className="text-sm text-foreground mb-3">
              تغيير مصدر الغريب سيعيد بناء أسئلة الجلسة الحالية، هل تريد المتابعة؟
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              المصدر الجديد: {MEANING_SOURCE_LABELS[pendingSource]}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPendingSource(null)}>
                إلغاء
              </Button>
              <Button size="sm" className="flex-1" onClick={confirmSourceChange}>
                متابعة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
