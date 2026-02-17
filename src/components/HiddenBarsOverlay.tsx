import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye } from 'lucide-react';

interface HiddenBarsOverlayProps {
  onShow: () => void;
}

/**
 * Invisible overlay that shows "إظهار الأزرار" button for 3 seconds on double-tap.
 */
export function HiddenBarsOverlay({ onShow }: HiddenBarsOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      // Double-tap detected
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    }
    lastTapRef.current = now;
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <>
      {/* Full-screen invisible tap zone */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleTap}
        style={{ touchAction: 'manipulation' }}
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
