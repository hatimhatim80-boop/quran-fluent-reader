import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that measures each .auto15-line's scrollWidth and applies
 * transform: scaleX(available / scrollWidth) clamped between 0.90–1.0
 * so every line fits within the container without clipping.
 *
 * Also sets a base font size via binary search, then fine-tunes with scaleX.
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

    // Reset transforms before measuring for font size
    lines.forEach(line => {
      line.style.transform = '';
    });

    // Binary search for max font size where no line overflows
    let lo = 8;
    let hi = 80;
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

    // Now apply scaleX per-line for any remaining overflow
    fitMushafLines(container);
  }, []);

  useEffect(() => {
    const timer = setTimeout(fitFont, 80);
    return () => clearTimeout(timer);
  }, [pageText, fontFamily, fontWeight, fitFont]);

  useEffect(() => {
    const handleResize = () => fitFont();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitFont]);

  return { containerRef, fittedFontPx };
}

/**
 * Measures each .auto15-line inside pageEl and applies
 * transform: scaleX(available / scrollWidth) clamped [0.90, 1.0]
 * with transform-origin: right center (set in CSS).
 */
function fitMushafLines(pageEl: HTMLElement) {
  const lines = pageEl.querySelectorAll<HTMLElement>('.auto15-line');
  if (!lines.length) return;

  const available = pageEl.clientWidth;
  if (available <= 0) return;

  lines.forEach(line => {
    // Reset transform to measure natural width
    line.style.transform = '';
    const scrollW = line.scrollWidth;

    if (scrollW > available) {
      const scale = Math.max(0.90, Math.min(1.0, available / scrollW));
      line.style.transform = `scaleX(${scale})`;
    } else {
      line.style.transform = '';
    }
  });
}
