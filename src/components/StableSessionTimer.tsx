import React, { memo } from 'react';
import { Clock } from 'lucide-react';

function formatSessionTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = ms / 1000;
  if (totalSec < 10) return `${totalSec.toFixed(1)}ث`;
  const wholeSec = Math.floor(totalSec);
  const h = Math.floor(wholeSec / 3600);
  const m = Math.floor((wholeSec % 3600) / 60);
  const s = wholeSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const StableSessionTimer = memo(function StableSessionTimer({
  sessionMs,
  itemMs = 0,
  completed = false,
  paused = false,
  compact = false,
}: {
  sessionMs: number;
  itemMs?: number;
  completed?: boolean;
  paused?: boolean;
  compact?: boolean;
}) {
  const sessionLabel = completed ? 'انتهت' : paused ? 'متوقفة' : `الكلي: ${formatSessionTime(sessionMs)}`;
  const itemVisible = !completed && itemMs > 0;
  return (
    <div className="flex items-center justify-center gap-2 pointer-events-none flex-nowrap h-7 overflow-hidden" dir="rtl">
      <div className="flex items-center justify-center gap-1.5 bg-muted/40 px-3 py-1 rounded-full w-[8.75rem] h-7 shrink-0 [contain:layout_style_paint]">
        <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
        <span className="text-[11px] leading-none font-mono text-muted-foreground tabular-nums whitespace-nowrap inline-block text-center w-[6.6rem] [font-variant-numeric:tabular-nums]">
          {sessionLabel}
        </span>
      </div>
      {!compact && (
        <div className={`flex items-center justify-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full w-[7rem] h-7 shrink-0 [contain:layout_style_paint] transition-opacity ${itemVisible ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!itemVisible}>
          <span className="text-[11px] leading-none font-mono text-primary tabular-nums whitespace-nowrap inline-block text-center w-[5.3rem] [font-variant-numeric:tabular-nums]">
            المقطع: {formatSessionTime(itemVisible ? itemMs : 0)}
          </span>
        </div>
      )}
    </div>
  );
});