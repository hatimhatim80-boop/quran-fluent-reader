import React, { useEffect, useState } from 'react';
import { StableSessionTimer } from '@/components/StableSessionTimer';

type TimerPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
const STORAGE_KEY = 'local.session_timer_position.v1';

const positionClass: Record<TimerPosition, string> = {
  'top-right': 'top-3 right-3',
  'top-left': 'top-3 left-3',
  'bottom-right': 'bottom-4 right-3',
  'bottom-left': 'bottom-4 left-3',
};

export function FloatingSessionTimer({ sessionMs, itemMs, completed, paused }: { sessionMs: number; itemMs?: number; completed?: boolean; paused?: boolean }) {
  const [position, setPosition] = useState<TimerPosition>(() => (localStorage.getItem(STORAGE_KEY) as TimerPosition) || 'top-left');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, position); } catch {} }, [position]);

  const cyclePosition = () => {
    const order: TimerPosition[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    setPosition(order[(order.indexOf(position) + 1) % order.length]);
  };

  return (
    <div className={`fixed z-[70] ${positionClass[position]} max-w-[calc(100vw-1.5rem)] pointer-events-auto`} dir="rtl">
      <button onClick={cyclePosition} className="block rounded-full bg-background/85 border border-border/70 shadow-lg backdrop-blur-md px-1.5 py-1" title="تغيير موضع العداد">
        <StableSessionTimer sessionMs={sessionMs} itemMs={itemMs} completed={completed} paused={paused} compact />
      </button>
    </div>
  );
}