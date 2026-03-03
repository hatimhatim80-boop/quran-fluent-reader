import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Timer, ChevronUp, ChevronDown, X } from 'lucide-react';
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
  /** Step */
  step?: number;
}

export function SpeedControlWidget({
  value,
  onChange,
  label = 'سرعة الظهور',
  min = 0.1,
  max = 30,
  step = 0.1,
}: SpeedControlWidgetProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatValue = (v: number) => {
    if (v < 1) return `${(v * 1000).toFixed(0)}ms`;
    return `${v.toFixed(1)}s`;
  };

  const showButton = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Auto-hide after 4s if not expanded
    if (!expanded) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, 4000);
    }
  }, [expanded]);

  // Keep visible while expanded
  useEffect(() => {
    if (expanded) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (visible) {
      // Start auto-hide timer when collapsing
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, [expanded]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Tap zone to trigger button appearance (like HiddenBarsOverlay)
  if (!visible) {
    return (
      <div
        className="fixed bottom-16 left-0 z-40"
        style={{ width: '20%', height: '10%', touchAction: 'pan-y' }}
        onClick={showButton}
      />
    );
  }

  if (!expanded) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
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

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 w-56 space-y-3 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-arabic font-bold text-foreground">{label}</span>
        <button onClick={() => { setExpanded(false); setVisible(false); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          disabled={value <= min}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <span className="text-lg font-bold font-arabic text-primary min-w-[4rem] text-center">
          {formatValue(value)}
        </span>
        <button
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
          disabled={value >= max}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(+v.toFixed(2))}
        min={min}
        max={max}
        step={step}
      />
      
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1 justify-center">
        {[0.3, 0.5, 1, 2, 4, 8].filter(v => v >= min && v <= max).map(preset => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`px-2 py-1 rounded-md text-[10px] font-arabic transition-all ${
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
