import React, { useEffect } from 'react';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface TahfeezSessionReviewSettingsProps {
  showDebugBadge?: boolean;
}

export function TahfeezSessionReviewSettings({ showDebugBadge: _showDebugBadge = false }: TahfeezSessionReviewSettingsProps) {
  const {
    reviewMode,
    setReviewMode,
    hiddenAyatCount,
    setHiddenAyatCount,
    setAyahCount,
    hiddenWordsMode,
    setHiddenWordsMode,
    hiddenWordsCount,
    setHiddenWordsCount,
    hiddenWordsPercentage,
    setHiddenWordsPercentage,
    distributionMode,
    setDistributionMode,
    setAutoBlankMode,
    wordBlankPosition,
    setWordBlankPosition,
    revealedAyahColor,
    setRevealedAyahColor,
    revealedAyahStyle,
    setRevealedAyahStyle,
    showHiddenWordsPreview,
    setShowHiddenWordsPreview,
  } = useTahfeezStore();

  const applyAyahCountMode = () => setAutoBlankMode('ayah-count');

  // Force autoBlankMode='ayah-count' on mount so the distributed engine is always used
  useEffect(() => {
    setAutoBlankMode('ayah-count');
  }, [setAutoBlankMode]);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3 font-arabic" dir="rtl" data-testid="tahfeez-session-review-settings">

      {/* Review mode: ayah / word / mixed */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">نوع المراجعة</p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={reviewMode === 'ayah' ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7 px-2.5"
            onClick={() => {
              setReviewMode('ayah');
              applyAyahCountMode();
            }}
          >
            إخفاء آيات
          </Button>
          <Button
            variant={reviewMode === 'word' ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7 px-2.5"
            onClick={() => {
              setReviewMode('word');
              applyAyahCountMode();
            }}
          >
            إخفاء كلمات
          </Button>
          <Button
            variant={reviewMode === 'mixed' ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7 px-2.5"
            onClick={() => {
              setReviewMode('mixed');
              applyAyahCountMode();
            }}
          >
            مختلط
          </Button>
        </div>
      </div>

      {/* Hidden ayat count — shown for ayah and mixed modes */}
      {(reviewMode === 'ayah' || reviewMode === 'mixed') && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            عدد الآيات المخفية: <span className="text-primary font-bold">{hiddenAyatCount}</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 5].map((n) => (
              <Button
                key={n}
                variant={hiddenAyatCount === n ? 'default' : 'outline'}
                size="sm"
                className="text-[11px] h-7 px-3 min-w-[2.2rem]"
                onClick={() => {
                  setHiddenAyatCount(n);
                  setAyahCount(n);
                  applyAyahCountMode();
                }}
              >
                {n}
              </Button>
            ))}
          </div>
          <Slider
            value={[hiddenAyatCount]}
            onValueChange={([v]) => {
              setHiddenAyatCount(v);
              setAyahCount(v);
              applyAyahCountMode();
            }}
            min={1}
            max={15}
            step={1}
          />
        </div>
      )}

      {/* Word hiding settings — shown for word and mixed modes */}
      {(reviewMode === 'word' || reviewMode === 'mixed') && (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">وضع الكلمات</p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={hiddenWordsMode === 'fixed-count' ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7 px-2.5"
            onClick={() => {
              setHiddenWordsMode('fixed-count');
              applyAyahCountMode();
            }}
          >
            عدد ثابت
          </Button>
          <Button
            variant={hiddenWordsMode === 'percentage' ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7 px-2.5"
            onClick={() => {
              setHiddenWordsMode('percentage');
              applyAyahCountMode();
            }}
          >
            نسبة مئوية
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          عدد الكلمات المخفية: <span className="text-primary font-bold">{hiddenWordsCount}</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 5, 10].map((n) => (
            <Button
              key={n}
              variant={hiddenWordsCount === n ? 'default' : 'outline'}
              size="sm"
              className="text-[11px] h-7 px-3 min-w-[2.2rem]"
              disabled={hiddenWordsMode !== 'fixed-count'}
              onClick={() => {
                setHiddenWordsCount(n);
                applyAyahCountMode();
              }}
            >
              {n}
            </Button>
          ))}
        </div>
        <Slider
          value={[hiddenWordsCount]}
          onValueChange={([v]) => {
            setHiddenWordsCount(v);
            applyAyahCountMode();
          }}
          min={1}
          max={20}
          step={1}
          disabled={hiddenWordsMode !== 'fixed-count'}
        />
      </div>

      {hiddenWordsMode === 'percentage' && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            النسبة المئوية: <span className="text-primary font-bold">{hiddenWordsPercentage}%</span>
          </label>
          <Slider
            value={[hiddenWordsPercentage]}
            onValueChange={([v]) => {
              setHiddenWordsPercentage(v);
              applyAyahCountMode();
            }}
            min={5}
            max={90}
            step={5}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">طريقة التوزيع</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'sequential' as const, label: 'متتابع' },
            { value: 'page-scattered' as const, label: 'موزع بالصفحة' },
            { value: 'range-scattered' as const, label: 'موزع بالنطاق' },
            { value: 'scope-scattered' as const, label: 'موزع بالنطاق الكامل' },
          ].map((opt) => (
            <Button
              key={opt.value}
              variant={distributionMode === opt.value ? 'default' : 'outline'}
              size="sm"
              className="text-[11px] h-7 px-2.5"
              onClick={() => {
                setDistributionMode(opt.value);
                applyAyahCountMode();
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Word blank position */}
      <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">موضع الكلمات المخفية</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'start' as const, label: 'من الأول' },
              { value: 'middle' as const, label: 'من الوسط' },
              { value: 'end' as const, label: 'من الآخر' },
              { value: 'mixed' as const, label: 'مختلط' },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={wordBlankPosition === opt.value ? 'default' : 'outline'}
                size="sm"
                className="text-[11px] h-7 px-2.5"
                onClick={() => {
                  setWordBlankPosition(opt.value);
                  applyAyahCountMode();
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

      {/* Revealed ayah highlight settings */}
      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">تمييز الآية بعد كشفها</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'primary' as const, label: 'أساسي' },
            { value: 'green' as const, label: 'أخضر' },
            { value: 'blue' as const, label: 'أزرق' },
            { value: 'orange' as const, label: 'برتقالي' },
            { value: 'purple' as const, label: 'بنفسجي' },
          ] as const).map((opt) => (
            <Button
              key={opt.value}
              variant={revealedAyahColor === opt.value ? 'default' : 'outline'}
              size="sm"
              className="text-[11px] h-7 px-2.5"
              onClick={() => setRevealedAyahColor(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'text-only' as const, label: 'لون النص' },
            { value: 'background' as const, label: 'خلفية' },
            { value: 'border' as const, label: 'إطار' },
          ] as const).map((opt) => (
            <Button
              key={opt.value}
              variant={revealedAyahStyle === opt.value ? 'default' : 'outline'}
              size="sm"
              className="text-[11px] h-7 px-2.5"
              onClick={() => setRevealedAyahStyle(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Hidden words preview toggle */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <div className="space-y-0.5">
          <p className="text-xs text-foreground">إظهار الكلمات المخفية أسفل الصفحة</p>
          <p className="text-[11px] text-muted-foreground">معطّل افتراضيًا حتى لا تُكشف الإجابة أثناء المراجعة.</p>
        </div>
        <Switch checked={showHiddenWordsPreview} onCheckedChange={setShowHiddenWordsPreview} />
      </div>

    </div>
  );
}