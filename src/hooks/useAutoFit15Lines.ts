import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Page-level AutoFit for 15-line Mushaf mode.
 * Uses an OFF-SCREEN hidden element that mirrors the real page grid
 * (same width, height, padding, grid-template-rows) + binary search
 * to find the LARGEST font-size (px) where NO line overflows horizontally.
 * One uniform size for all lines. No transform/scale.
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

    // Collect text content from all .quran-line elements
    const lineEls = pageEl.querySelectorAll<HTMLElement>('.quran-line');
    if (lineEls.length === 0) return;

    const lineTexts: string[] = [];
    for (const el of lineEls) {
      lineTexts.push(el.textContent || '');
    }

    const rowCount = lineTexts.length;

    // Build off-screen tester that mirrors the real page grid exactly
    const tester = document.createElement('div');
    tester.style.position = 'absolute';
    tester.style.visibility = 'hidden';
    tester.style.left = '-99999px';
    tester.style.top = '-99999px';
    tester.style.width = `${pageEl.clientWidth}px`;
    tester.style.height = `${pageEl.clientHeight}px`;
    tester.style.display = 'grid';
    tester.style.gridTemplateRows = `repeat(${Math.max(15, rowCount)}, 1fr)`;
    tester.style.padding = style.padding;
    tester.style.boxSizing = 'border-box';
    tester.style.overflow = 'visible';
    tester.style.direction = 'rtl';
    document.body.appendChild(tester);

    const testLineEls: HTMLDivElement[] = [];
    for (const text of lineTexts) {
      const d = document.createElement('div');
      // Mirror .auto15-line styles
      d.style.direction = 'rtl';
      d.style.unicodeBidi = 'plaintext';
      d.style.whiteSpace = 'nowrap';
      d.style.overflow = 'visible';
      d.style.textOverflow = 'clip';
      d.style.display = 'flex';
      d.style.alignItems = 'center';
      d.style.fontFamily = fontFamily;
      d.style.fontWeight = String(fontWeight);
      d.style.lineHeight = '1.1';
      d.textContent = text;
      tester.appendChild(d);
      testLineEls.push(d);
    }

    // Binary search: largest font where every line fits
    const MIN = 10;
    const MAX = 90;
    let lo = MIN;
    let hi = MAX;
    let best = MIN;

    const fits = (fs: number) => {
      for (const el of testLineEls) {
        el.style.fontSize = `${fs}px`;
      }
      // Force layout
      void tester.offsetWidth;
      for (const el of testLineEls) {
        if (el.scrollWidth > innerW + 1) return false;
      }
      return true;
    };

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fits(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Clean up tester
    document.body.removeChild(tester);

    // Apply ONE uniform font size to the whole page element
    pageEl.style.fontSize = `${best}px`;

    setFittedFontSize(best);
  }, [fontFamily, fontWeight]);

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
