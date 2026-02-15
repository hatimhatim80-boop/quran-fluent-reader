import { useEffect, useRef, useState, useCallback } from 'react';

const DESIGN_W = 1000;
const DESIGN_H = 1414;

/**
 * Fixed-canvas approach: the page is always laid out at 1000×1414 design pixels,
 * then uniformly scaled to fit the viewport wrapper.
 * No per-line scaleX — the entire canvas scales as one unit.
 */
export function useAutoFit15Lines(pageText: string, fontFamily: string, fontWeight: number) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const recalc = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const wrapperW = wrapper.clientWidth;
    const wrapperH = wrapper.clientHeight || wrapperW * (DESIGN_H / DESIGN_W);

    const s = Math.min(wrapperW / DESIGN_W, wrapperH / DESIGN_H);
    setScale(s);
  }, []);

  useEffect(() => {
    // Small delay to let DOM settle after font/text changes
    const timer = setTimeout(recalc, 50);
    return () => clearTimeout(timer);
  }, [pageText, fontFamily, fontWeight, recalc]);

  useEffect(() => {
    const onResize = () => recalc();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [recalc]);

  return { canvasRef, wrapperRef, scale, designW: DESIGN_W, designH: DESIGN_H };
}
