import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Auto-fit font size for continuous flow mode with 15 lines.
 * Binary-searches for the largest font-size (px) where the flowing text
 * wraps into at most `targetLines` lines within the container's width.
 */
export function useAutoFlowFit(
  pageText: string,
  fontFamily: string,
  fontWeight: number,
  lineHeight: number,
  targetLines = 15,
  enabled = true,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number | null>(null);

  const refit = useCallback(() => {
    if (!enabled) { setFittedFontSize(null); return; }
    const el = containerRef.current;
    if (!el || !pageText) return;

    const style = getComputedStyle(el);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const innerW = el.clientWidth - padL - padR;
    if (innerW <= 0) return;

    // Build off-screen tester that mimics the continuous flow rendering
    const tester = document.createElement('div');
    tester.style.cssText = `
      position:absolute; visibility:hidden; left:-99999px; top:-99999px;
      width:${innerW}px; direction:rtl; unicode-bidi:plaintext;
      font-family:${fontFamily}; font-weight:${fontWeight};
      line-height:${lineHeight}; text-align:justify;
      white-space:normal; word-break:normal; overflow-wrap:normal;
    `;
    
    // Render text similar to how PageView does it (inline spans per line)
    const lines = pageText.split('\n');
    for (const line of lines) {
      const span = document.createElement('span');
      span.textContent = line + ' ';
      tester.appendChild(span);
    }
    
    document.body.appendChild(tester);

    const MIN = 8;
    const MAX = 60;
    let lo = MIN;
    let hi = MAX;
    let best = MIN;

    const fits = (fs: number) => {
      tester.style.fontSize = `${fs}px`;
      void tester.offsetWidth;
      const lineH = fs * lineHeight;
      const maxHeight = lineH * targetLines;
      return tester.scrollHeight <= maxHeight + 1;
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

    document.body.removeChild(tester);
    setFittedFontSize(best);
  }, [pageText, fontFamily, fontWeight, lineHeight, targetLines, enabled]);

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
