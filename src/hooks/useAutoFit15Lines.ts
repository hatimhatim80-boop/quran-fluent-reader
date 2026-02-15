import { useEffect, useRef, useState, useCallback } from 'react';

const DESIGN_W = 550;
const DESIGN_H = 778;

/**
 * Fixed-canvas approach: the page is always laid out at 1000×1414 design pixels,
 * then uniformly scaled to fit the viewport wrapper.
 * Uses min(scaleW, scaleH) so the entire page is visible without scrolling.
 */
export function useAutoFit15Lines(pageText: string, fontFamily: string, fontWeight: number) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const recalc = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const wrapperW = wrapper.clientWidth;
    // Scale based on available width so text fills the line
    const s = wrapperW / DESIGN_W;
    setScale(Math.max(0.15, s));
  }, []);

  useEffect(() => {
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
