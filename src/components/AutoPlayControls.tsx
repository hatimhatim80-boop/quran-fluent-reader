import React from 'react';
import { Play, Pause, Square, SkipForward, SkipBack } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface AutoPlayControlsProps {
  isPlaying: boolean;
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
  if (wordsCount === 0) {
    return (
      <div className="text-center text-muted-foreground font-arabic py-4">
        لا توجد كلمات غريبة في هذه الصفحة
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Playback Controls */}
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

      {/* Speed Control */}
      <div className="space-y-2 px-4" dir="rtl">
        <div className="flex gap-1 flex-wrap justify-center">
          {[0.2, 0.3, 0.5, 0.7, 1, 2, 4].map(p => (
            <button
              key={p}
              onClick={() => onSpeedChange(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-arabic transition-all ${
                Math.abs(speed - p) < 0.05
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {p < 1 ? `${Math.round(p * 1000)}ms` : `${p}s`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4" dir="ltr">
          <span className="text-sm font-arabic text-muted-foreground whitespace-nowrap">
            سريع
          </span>
          <Slider
            value={[speed]}
            onValueChange={([val]) => onSpeedChange(+val.toFixed(2))}
            min={0.1}
            max={30}
            step={speed < 1 ? 0.1 : 0.5}
            className="flex-1"
          />
          <span className="text-sm font-arabic text-muted-foreground whitespace-nowrap">
            بطيء
          </span>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="text-center text-sm text-muted-foreground font-arabic">
        {currentWordIndex >= 0 ? (
          <span>
            الكلمة {currentWordIndex + 1} من {wordsCount} • {speed < 1 ? `${Math.round(speed * 1000)}ms` : `${speed}s`}
          </span>
        ) : (
          <span>{wordsCount} كلمة غريبة في هذه الصفحة</span>
        )}
      </div>
    </div>
  );
}
