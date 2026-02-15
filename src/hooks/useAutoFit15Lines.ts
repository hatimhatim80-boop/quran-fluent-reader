import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Page-level AutoFit for 15-line Mushaf mode.
 * Uses binary search to find the LARGEST font-size (px) where
 * NO line overflows horizontally. One uniform size for all lines.
 * No transform/scale — avoids Arabic glyph distortion.
 */
export function useAutoFit15Lines(
  pageText: string,
  fontFamily: string,
  fontWeight: number,
) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number | null>(null);

  const refit = useCallback(() => {
    const pageEl = pageRef.current;
    if (!pageEl) return;

    const style = getComputedStyle(pageEl);
    const innerW =
      pageEl.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);

    if (innerW <= 0) return;

    // Collect all .quran-line elements inside the page grid
    const lineEls = pageEl.querySelectorAll<HTMLElement>('.quran-line');
    if (lineEls.length === 0) return;

    // Binary search: largest font where every line fits
    const MIN = 10;
    const MAX = 90;
    let lo = MIN;
    let hi = MAX;
    let best = MIN;

    const fits = (fs: number) => {
      for (const el of lineEls) {
        el.style.fontSize = `${fs}px`;
      }
      // Force layout
      void pageEl.offsetWidth;
      for (const el of lineEls) {
        if (el.scrollWidth > innerW + 1) return false;
      }
      return true;
    };

    // Temporarily allow overflow so scrollWidth is measurable
    const prevOverflow = pageEl.style.overflow;
    pageEl.style.overflow = 'visible';
    for (const el of lineEls) {
      (el as HTMLElement).style.overflow = 'visible';
      (el as HTMLElement).style.whiteSpace = 'nowrap';
    }

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fits(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Apply final size
    for (const el of lineEls) {
      el.style.fontSize = `${best}px`;
      (el as HTMLElement).style.overflow = '';
      (el as HTMLElement).style.whiteSpace = '';
    }
    pageEl.style.overflow = prevOverflow;

    setFittedFontSize(best);
  }, []);

  useEffect(() => {
    // Wait for fonts & layout
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        refit();
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [pageText, fontFamily, fontWeight, refit]);

  useEffect(() => {
    const onResize = () => refit();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [refit]);

  return { pageRef, fittedFontSize };
}
