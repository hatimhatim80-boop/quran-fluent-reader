import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Hook that automatically calculates the optimal font size so that
 * the longest line of text fills the container width exactly.
 * 
 * Returns the computed font size in rem, or null if auto-fit is disabled.
 * Attach the returned ref to the quran-page container.
 */
export function useAutoFitFont(pageText: string) {
  const autoFitEnabled = useSettingsStore((s) => s.settings.display?.autoFitFont ?? false);
  const baseFontSize = useSettingsStore((s) => s.settings.fonts.quranFontSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number | null>(null);

  useEffect(() => {
    if (!autoFitEnabled || !containerRef.current) {
      setFittedFontSize(null);
      return;
    }

    // Wait for fonts to load and layout to settle
    const timer = setTimeout(() => {
      fitFont();
    }, 100);

    return () => clearTimeout(timer);
  }, [autoFitEnabled, pageText, baseFontSize]);

  // Also re-fit on window resize
  useEffect(() => {
    if (!autoFitEnabled) return;
    
    const handleResize = () => {
      if (containerRef.current) fitFont();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFitEnabled, pageText]);

  function fitFont() {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    // Find all quran-line elements
    const lines = container.querySelectorAll<HTMLElement>('.quran-line');
    if (lines.length === 0) return;

    // Get current font size in px
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    let currentFontPx = baseFontSize * rootFontSize;

    // Find the widest line's scroll width at current font size
    let maxScrollWidth = 0;
    lines.forEach((line) => {
      if (line.scrollWidth > maxScrollWidth) {
        maxScrollWidth = line.scrollWidth;
      }
    });

    if (maxScrollWidth <= 0) return;

    // Scale factor: how much to multiply font size so widest line = container width
    // Use 0.98 factor to leave a tiny margin
    const scale = (containerWidth * 0.98) / maxScrollWidth;
    const newFontPx = currentFontPx * scale;

    // Clamp between 0.8rem and 4rem
    const newFontRem = Math.max(0.8, Math.min(4, newFontPx / rootFontSize));

    // Round to 2 decimal places
    setFittedFontSize(Math.round(newFontRem * 100) / 100);
  }

  return { containerRef, fittedFontSize: autoFitEnabled ? fittedFontSize : null };
}
