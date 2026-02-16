import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Auto-fit for autoFlow15 mode — Madinah Mushaf style.
 * 
 * No binary search, no transform, no grid 1fr.
 * Simple math:
 *   lineHeightPx = innerHeight / 15
 *   fontSize = lineHeightPx * 0.82
 * 
 * Each .quran-line gets a fixed height. Short pages stay natural.
 */
export function useAutoFlowFit(
  pageText: string,
  fontFamily: string,
  fontWeight: number,
  _lineHeight: number,
  _targetLines = 15,
  enabled = true,
  _maxHeightPx?: number,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number | null>(null);

  const refit = useCallback(() => {
    if (!enabled) { setFittedFontSize(null); return; }
    const pageEl = containerRef.current;
    if (!pageEl || !pageText) return;

    const computed = getComputedStyle(pageEl);
    const innerHeight =
      pageEl.clientHeight -
      parseFloat(computed.paddingTop) -
      parseFloat(computed.paddingBottom);

    if (innerHeight <= 0) return;

    const lineHeightPx = innerHeight / 15;

    // 0.82 ratio suits Mushaf Arabic fonts
    const fontSize = lineHeightPx * 0.82;

    // Apply font size to the page element
    pageEl.style.fontSize = `${fontSize}px`;

    // Apply fixed height to each .quran-line
    const lines = pageEl.querySelectorAll<HTMLElement>('.quran-line');
    lines.forEach(line => {
      line.style.height = `${lineHeightPx}px`;
    });

    setFittedFontSize(fontSize);
  }, [pageText, fontFamily, fontWeight, enabled]);

  useEffect(() => {
    if (!enabled) { setFittedFontSize(null); return; }
    // Wait for fonts & layout
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        refit();
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [refit, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => refit();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [refit, enabled]);

  return { containerRef, fittedFontSize };
}
