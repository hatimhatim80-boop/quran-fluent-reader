import React, { useState } from 'react';
import { Play, Pause, Square, SkipForward, SkipBack, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface AutoPlayControlsProps {
  isPlaying: boolean;
  /** Speed in seconds */
  speed: number;
  wordsCount: number;
  currentWordIndex: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSpeedChange: (speed: number) => void;
}

const SUB_SECOND_PRESETS = [0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1.0];
const FULL_PRESETS = [1, 2, 3, 4, 6, 8];

function formatSpeed(v: number): string {
  if (v < 1) return `${Math.round(v * 1000)}ms`;
  return `${v}s`;
}

function formatSpeedArabic(v: number): string {
  if (v < 1) return `${Math.round(v * 1000)} مللي ثانية لكل كلمة`;
  return `${v.toFixed(1)} ثانية لكل كلمة`;
}

export function AutoPlayControls({
  isPlaying,
  speed,
  wordsCount,
  currentWordIndex,
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  onSpeedChange,
}: AutoPlayControlsProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  const clamp = (v: number) => Math.max(0.1, Math.min(30, +v.toFixed(2)));
  const step = speed < 1 ? 0.1 : speed < 5 ? 0.5 : 1;

  if (wordsCount === 0) {
    return (
      <div className="text-center text-muted-foreground font-arabic py-4">
        لا توجد كلمات غريبة في هذه الصفحة
      </div>
    );
  }

  const handleInputSubmit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0) {
      onSpeedChange(clamp(parsed));
    }
    setShowInput(false);
    setInputValue('');
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Playback Controls — RTL-correct: right arrow = prev (earlier), left arrow = next (later) */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <button
          onClick={onPrev}
          disabled={currentWordIndex <= 0}
          className="nav-button w-10 h-10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="الكلمة السابقة"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        {isPlaying ? (
          <button
            onClick={onPause}
            className="control-button w-12 h-12 rounded-full flex items-center justify-center"
            title="إيقاف مؤقت"
          >
            <Pause className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="control-button w-12 h-12 rounded-full flex items-center justify-center"
            title="تشغيل"
          >
            <Play className="w-6 h-6 mr-[-2px]" />
          </button>
        )}

        <button
          onClick={onStop}
          className="nav-button w-10 h-10 rounded-lg"
          title="إيقاف"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={onNext}
          disabled={currentWordIndex >= wordsCount - 1}
          className="nav-button w-10 h-10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          title="الكلمة التالية"
        >
          <SkipBack className="w-5 h-5" />
        </button>
      </div>

      {/* Speed: current value + ±  */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onSpeedChange(clamp(speed - step))}
          disabled={speed <= 0.1}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {showInput ? (
          <form onSubmit={e => { e.preventDefault(); handleInputSubmit(); }} className="flex items-center gap-1">
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="30"
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={handleInputSubmit}
              className="w-20 h-8 text-center text-sm font-arabic"
              placeholder={String(speed)}
            />
            <span className="text-[10px] text-muted-foreground font-arabic">ثانية</span>
          </form>
        ) : (
          <button
            onClick={() => { setShowInput(true); setInputValue(String(speed)); }}
            className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm font-arabic tabular-nums min-w-[4rem] text-center"
            title="اضغط لإدخال قيمة مخصصة"
          >
            {formatSpeed(speed)}
          </button>
        )}

        <button
          onClick={() => onSpeedChange(clamp(speed + step))}
          disabled={speed >= 30}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-second preset chips */}
      <div className="px-2">
        <div className="flex gap-1 flex-wrap justify-center">
          {SUB_SECOND_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => onSpeedChange(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${
                Math.abs(speed - p) < 0.05
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {formatSpeed(p)}
            </button>
          ))}
        </div>
        {/* Full-second presets */}
        <div className="flex gap-1 flex-wrap justify-center mt-1">
          {FULL_PRESETS.filter(p => p > 1).map(p => (
            <button
              key={p}
              onClick={() => onSpeedChange(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${
                Math.abs(speed - p) < 0.05
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {formatSpeed(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-second fine slider: 0.1 – 1.0 */}
      <div className="space-y-1 px-4">
        <div className="flex justify-between text-[10px] font-arabic text-muted-foreground">
          <span>سريع 100ms</span>
          <span>1 ثانية</span>
        </div>
        <Slider
          value={[Math.min(speed, 1)]}
          onValueChange={([v]) => onSpeedChange(clamp(v))}
          min={0.1}
          max={1}
          step={0.1}
        />
      </div>

      {/* Full range slider: 1 – 30 */}
      <div className="space-y-1 px-4">
        <div className="flex justify-between text-[10px] font-arabic text-muted-foreground">
          <span>1 ثانية</span>
          <span>30 ثانية</span>
        </div>
        <Slider
          value={[Math.max(speed, 1)]}
          onValueChange={([v]) => onSpeedChange(clamp(v))}
          min={1}
          max={30}
          step={0.5}
        />
      </div>

      {/* Progress Indicator */}
      <div className="text-center text-[11px] text-muted-foreground font-arabic space-y-0.5">
        <div>{formatSpeedArabic(speed)}</div>
        {currentWordIndex >= 0 ? (
          <div>الكلمة {currentWordIndex + 1} من {wordsCount}</div>
        ) : (
          <div>{wordsCount} كلمة غريبة في هذه الصفحة</div>
        )}
      </div>
    </div>
  );
}
