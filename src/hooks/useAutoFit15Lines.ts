import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that uses binary search to find the optimal font size
 * so that all 15 lines (white-space: nowrap) fit within the container width.
 *
 * Returns a ref to attach to the .mushafPageAuto15 container
 * and the computed font size in px.
 */
export function useAutoFit15Lines(pageText: string, fontFamily: string, fontWeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedFontPx, setFittedFontPx] = useState<number>(20);

  const fitFont = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const lines = container.querySelectorAll<HTMLElement>('.auto15-line');
    if (lines.length === 0) return;

    // Binary search for max font size where no line overflows
    let lo = 8;   // min font px
    let hi = 80;  // max font px
    const ITERATIONS = 15;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const mid = (lo + hi) / 2;
      container.style.fontSize = `${mid}px`;

      let overflow = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].scrollWidth > containerWidth + 1) {
          overflow = true;
          break;
        }
      }

      if (overflow) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    // Use the lower bound (safe fit)
    const finalSize = Math.floor(lo * 100) / 100;
    container.style.fontSize = `${finalSize}px`;
    setFittedFontPx(finalSize);
  }, []);

  useEffect(() => {
    // Wait for fonts to load then fit
    const timer = setTimeout(fitFont, 80);
    return () => clearTimeout(timer);
  }, [pageText, fontFamily, fontWeight, fitFont]);

  // Re-fit on resize
  useEffect(() => {
    const handleResize = () => fitFont();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitFont]);

  return { containerRef, fittedFontPx };
}
