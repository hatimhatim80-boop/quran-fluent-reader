import React from 'react';
import { Button } from '@/components/ui/button';
import type { SessionRevealMode, SessionAudioMode } from '@/stores/reviewSessionStore';
import { QuranAudioManager } from '@/components/QuranAudioManager';

interface SessionRevealAudioSettingsProps {
  revealMode: SessionRevealMode;
  onRevealMode: (mode: SessionRevealMode) => void;
  wordRevealInterval: number;
  onWordRevealInterval: (seconds: number) => void;
  audioMode: SessionAudioMode;
  onAudioMode: (mode: SessionAudioMode) => void;
  reciterId: string;
  onReciterChange: (id: string) => void;
  /** Pages of the current session, used as the audio download scope. */
  sessionPages: number[];
}

const REVEAL_OPTIONS: { value: SessionRevealMode; label: string }[] = [
  { value: 'smart', label: 'الكشف الذكي الحالي' },
  { value: 'wordByWordManual', label: 'كلمة كلمة بالضغط' },
  { value: 'wordByWordAuto', label: 'كلمة كلمة تلقائيًا' },
];

const SPEEDS = [0.5, 1, 1.5, 2, 3];

const AUDIO_OPTIONS: { value: SessionAudioMode; label: string }[] = [
  { value: 'none', label: 'بدون تشغيل تلقائي' },
  { value: 'previous', label: 'الآية السابقة' },
  { value: 'current', label: 'الآية المخفية' },
  { value: 'previous-then-current', label: 'السابقة ثم المخفية' },
];

/** Reveal + recitation options; every change is applied and saved immediately. */
export function SessionRevealAudioSettings({
  revealMode,
  onRevealMode,
  wordRevealInterval,
  onWordRevealInterval,
  audioMode,
  onAudioMode,
  reciterId,
  onReciterChange,
  sessionPages,
}: SessionRevealAudioSettingsProps) {
  return (
    <div className="space-y-3 font-arabic" dir="rtl" data-testid="session-reveal-audio-settings">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">طريقة كشف الآية المخفية</p>
        <div className="flex flex-wrap gap-1.5">
          {REVEAL_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={revealMode === opt.value ? 'default' : 'outline'}
              className="text-[11px] h-7 px-2.5 font-arabic"
              onClick={() => onRevealMode(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {revealMode === 'wordByWordAuto' && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">سرعة كشف الكلمات</p>
          <div className="flex flex-wrap gap-1.5">
            {SPEEDS.map(s => (
              <Button
                key={s}
                size="sm"
                variant={wordRevealInterval === s ? 'default' : 'outline'}
                className="text-[11px] h-7 px-2.5 font-arabic"
                onClick={() => onWordRevealInterval(s)}
              >
                {s} ثانية
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-2.5">
        <p className="text-xs text-muted-foreground">التلاوة عند الآية المخفية</p>
        <div className="flex flex-wrap gap-1.5">
          {AUDIO_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={audioMode === opt.value ? 'default' : 'outline'}
              className="text-[11px] h-7 px-2.5 font-arabic"
              onClick={() => onAudioMode(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          التلاوة مستقلة تمامًا عن النص: تبقى الآية مخفية حتى تضغط للكشف عنها.
        </p>
      </div>

      <QuranAudioManager pages={sessionPages} reciterId={reciterId} onReciterChange={onReciterChange} />
    </div>
  );
}
