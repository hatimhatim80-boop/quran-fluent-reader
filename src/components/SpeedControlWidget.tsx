import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Timer, ChevronUp, ChevronDown, X, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface SpeedControlWidgetProps {
  /** Current speed in seconds */
  value: number;
  /** Called when speed changes */
  onChange: (value: number) => void;
  /** Label to show */
  label?: string;
  /** Min value */
  min?: number;
  /** Max value */
  max?: number;
}

const SUB_SECOND_PRESETS = [0.2, 0.3, 0.5, 0.7, 1];
const FULL_PRESETS = [0.3, 0.5, 1, 2, 4, 8];

export function SpeedControlWidget({
  value,
  onChange,
  label = 'سرعة الظهور',
  min = 0.1,
  max = 30,
}: SpeedControlWidgetProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatValue = (v: number) => {
    if (v < 1) return `${Math.round(v * 1000)}ms`;
    return `${v.toFixed(1)}s`;
  };

  const formatValueArabic = (v: number) => {
    if (v < 1) return `${Math.round(v * 1000)} مللي ثانية لكل كلمة`;
    return `${v.toFixed(1)} ثانية لكل كلمة`;
  };

  const clamp = (v: number) => Math.max(min, Math.min(max, +v.toFixed(2)));

  const step = value < 1 ? 0.1 : value < 5 ? 0.5 : 1;

  const showButton = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!expanded) {
      timerRef.current = setTimeout(() => setVisible(false), 4000);
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (visible) {
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, [expanded]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Tap zone
  if (!visible) {
    return (
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40"
        style={{ width: '40%', height: '10%', touchAction: 'pan-y' }}
        onClick={showButton}
      />
    );
  }

  if (!expanded) {
    return (
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-fade-in">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg text-xs font-arabic"
          title={label}
        >
          <Timer className="w-3.5 h-3.5 text-foreground" />
          <span className="text-foreground">{formatValue(value)}</span>
        </button>
      </div>
    );
  }

  const presets = value <= 1 ? SUB_SECOND_PRESETS : FULL_PRESETS;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 w-64 space-y-3 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-arabic font-bold text-foreground">{label}</span>
        <button onClick={() => { setExpanded(false); setVisible(false); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Current value display */}
      <div className="text-center text-[11px] font-arabic text-muted-foreground">
        {formatValueArabic(value)}
      </div>
      
      {/* +/- controls with large value */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-xl font-bold font-arabic text-primary min-w-[5rem] text-center tabular-nums">
          {formatValue(value)}
        </span>
        <button
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-second fine slider: 0.1 – 1.0 */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-arabic text-muted-foreground">
          <span>سريع 100ms</span>
          <span>1 ثانية</span>
        </div>
        <Slider
          value={[Math.min(value, 1)]}
          onValueChange={([v]) => onChange(clamp(v))}
          min={0.1}
          max={1}
          step={0.1}
        />
      </div>

      {/* Full range slider: 1 – max */}
      {max > 1 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-arabic text-muted-foreground">
            <span>1 ثانية</span>
            <span>{max} ثانية</span>
          </div>
          <Slider
            value={[Math.max(value, 1)]}
            onValueChange={([v]) => onChange(clamp(v))}
            min={1}
            max={max}
            step={0.5}
          />
        </div>
      )}
      
      {/* Preset chips */}
      <div className="flex flex-wrap gap-1 justify-center">
        {presets.filter(v => v >= min && v <= max).map(preset => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-arabic transition-all ${
              Math.abs(value - preset) < 0.05
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {formatValue(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}
