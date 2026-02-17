import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye } from 'lucide-react';

interface HiddenBarsOverlayProps {
  onShow: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

/**
 * Invisible overlay that shows "إظهار الأزرار" button for 3 seconds on double-tap.
 */
export function HiddenBarsOverlay({ onShow, onNextPage, onPrevPage }: HiddenBarsOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }
    lastTapRef.current = now;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTime: Date.now() };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeRef.current && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
      const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.startY);
      const elapsed = Date.now() - swipeRef.current.startTime;
      const absDx = Math.abs(dx);
      if (absDx > 60 && elapsed < 400 && absDx > dy * 1.5) {
        if (dx < 0) onNextPage?.();
        else onPrevPage?.();
      }
    }
    swipeRef.current = null;
  }, [onNextPage, onPrevPage]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      />
      {/* Button appears for 3s after double-tap */}
      {visible && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <button
            onClick={(e) => { e.stopPropagation(); onShow(); }}
            className="bg-background/90 backdrop-blur-md border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-lg"
            title="إظهار الأزرار"
          >
            <Eye className="w-4 h-4 text-foreground" />
            <span className="font-arabic text-sm text-foreground">إظهار الأزرار</span>
          </button>
        </div>
      )}
    </>
  );
}
