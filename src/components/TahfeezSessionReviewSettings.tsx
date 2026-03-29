import React, { useEffect } from 'react';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TahfeezSessionReviewSettingsProps {
  showDebugBadge?: boolean;
}

export function TahfeezSessionReviewSettings({ showDebugBadge = false }: TahfeezSessionReviewSettingsProps) {
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
  } = useTahfeezStore();

  const applyAyahCountMode = () => setAutoBlankMode('ayah-count');

  // Force autoBlankMode='ayah-count' on mount so the distributed engine is always used
  useEffect(() => {
    setAutoBlankMode('ayah-count');
  }, [setAutoBlankMode]);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3 font-arabic" dir="rtl" data-testid="tahfeez-session-review-settings">
      {showDebugBadge && (
        <div className="text-[11px] font-semibold text-primary">DEBUG: session-settings-mounted</div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">نوع المراجعة</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'ayah' as const, label: 'آيات' },
            { value: 'word' as const, label: 'كلمات' },
            { value: 'mixed' as const, label: 'مختلط' },
          ].map((opt) => (
            <Button
              key={opt.value}
              variant={reviewMode === opt.value ? 'default' : 'outline'}
              size="sm"
              className="text-[11px] h-7 px-2.5"
              onClick={() => {
                setReviewMode(opt.value);
                applyAyahCountMode();
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          عدد الآيات المخفية: <span className="text-primary font-bold">{hiddenAyatCount}</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 5, 10].map((n) => (
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

      <div className="border border-dashed border-border rounded-md p-2 bg-muted/30 text-[11px] text-muted-foreground space-y-0.5">
        <p>reviewMode = {reviewMode}</p>
        <p>hiddenAyatCount = {hiddenAyatCount}</p>
        <p>hiddenWordsMode = {hiddenWordsMode}</p>
        <p>hiddenWordsCount = {hiddenWordsCount}</p>
        <p>hiddenWordsPercentage = {hiddenWordsPercentage}</p>
        <p>distributionMode = {distributionMode}</p>
      </div>
    </div>
  );
}