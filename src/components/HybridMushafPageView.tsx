import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { PageView } from './PageView';
import { GhareebWord } from '@/types/quran';
import { useSettingsStore } from '@/stores/settingsStore';
import { Loader2, Bug } from 'lucide-react';

interface HybridMushafPageViewProps {
  pageNumber: number;
  hidePageBadge?: boolean;
}

/** PNG image URL from quran.i8x.net API */
function getPngUrl(page: number): string {
  return `https://quran.i8x.net/data/quran_image/${page}.png`;
}

/**
 * Calibrated line-top positions (% from top of image).
 * These are measured from the Madinah Mushaf PNG layout:
 * - Text area starts ~10.5% from top (below ornamental header)
 * - Text area ends ~93.5% from top (above page number)
 * - 15 lines evenly distributed in that range
 * - Each line slot height ≈ (93.5 - 10.5) / 15 = 5.53%
 */
const TEXT_AREA_TOP = 10.5;
const TEXT_AREA_BOTTOM = 93.5;
const LINE_SLOT_HEIGHT = (TEXT_AREA_BOTTOM - TEXT_AREA_TOP) / 15;

function getLineTop(lineIndex: number): number {
  return TEXT_AREA_TOP + lineIndex * LINE_SLOT_HEIGHT;
}

export function HybridMushafPageView({ pageNumber, hidePageBadge }: HybridMushafPageViewProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const debugMode = useSettingsStore((s) => s.settings.debugMode);

  // Reset on page change
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [pageNumber]);

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true);
  }, []);

  const pngUrl = getPngUrl(pageNumber);

  // Debug baselines: 15 lines showing calibrated positions
  const debugBaselines = useMemo(() => {
    if (!debugOverlay) return null;
    return Array.from({ length: 15 }, (_, i) => (
      <div
        key={i}
        className="hybridDebugBaseline"
        style={{ top: `${getLineTop(i)}%` }}
        data-line-label={`L${i + 1} (${getLineTop(i).toFixed(1)}%)`}
      />
    ));
  }, [debugOverlay]);

  return (
    <div className="hybridMushafRoot">
      {/* Debug toggle */}
      {debugMode && (
        <button
          onClick={() => setDebugOverlay(!debugOverlay)}
          className={`hybridDebugToggle ${debugOverlay ? 'hybridDebugToggle--active' : ''}`}
          title="إظهار/إخفاء طبقة النص"
        >
          <Bug className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Main container - PNG defines the size */}
      <div ref={containerRef} className="hybridContainer">
        {/* Layer A: PNG Background */}
        {!imgError && (
          <img
            ref={imgRef}
            src={pngUrl}
            alt={`صفحة ${pageNumber}`}
            className={`hybridPngLayer ${imgLoaded ? 'hybridPngLoaded' : ''}`}
            onLoad={handleImgLoad}
            onError={() => setImgError(true)}
            loading="eager"
            draggable={false}
          />
        )}

        {/* Loading spinner */}
        {!imgLoaded && !imgError && (
          <div className="hybridSpinner">
            <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
          </div>
        )}

        {/* Debug baselines */}
        {debugBaselines}

        {/* Layer B: Transparent interactive text overlay */}
        <div className={`hybridTextLayer ${debugOverlay ? 'hybridTextLayer--debug' : ''} ${imgLoaded || imgError ? 'hybridTextLayer--ready' : ''}`}>
          <HybridPageContent
            pageNumber={pageNumber}
            hidePageBadge={hidePageBadge ?? true}
            debugOverlay={debugOverlay}
          />
        </div>
      </div>
    </div>
  );
}

/** Inner component that renders PageView with line positioning via CSS custom properties */
function HybridPageContent({
  pageNumber,
  hidePageBadge,
  debugOverlay,
}: {
  pageNumber: number;
  hidePageBadge: boolean;
  debugOverlay: boolean;
}) {
  const {
    getCurrentPageData,
    getPageGhareebWords,
    currentWordIndex,
    setCurrentWordIndex,
  } = useQuranData();

  const pageData = getCurrentPageData();
  const pageWords = getPageGhareebWords;

  const [renderedWords, setRenderedWords] = useState<GhareebWord[]>([]);

  const handleRenderedWordsChange = useCallback((words: GhareebWord[]) => {
    setRenderedWords(words);
  }, []);

  const handleWordClick = useCallback((_: GhareebWord, index: number) => {
    setCurrentWordIndex(index);
  }, [setCurrentWordIndex]);

  // After PageView renders, inject absolute positioning on each .quran-line
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayRef.current) return;
    // Find all rendered quran-lines and position them absolutely
    const lines = overlayRef.current.querySelectorAll('.quran-line');
    let realLineIndex = 0;
    lines.forEach((line) => {
      const el = line as HTMLElement;
      // Skip empty lines (no text content)
      const text = el.textContent?.trim();
      if (!text) {
        el.style.display = 'none';
        return;
      }
      el.style.top = `${getLineTop(realLineIndex)}%`;
      realLineIndex++;
      // Hide lines beyond 15
      if (realLineIndex > 15) {
        el.style.display = 'none';
      }
    });

    // Also position bismillah elements
    const bismillahs = overlayRef.current.querySelectorAll('.bismillah');
    // Bismillah is typically part of the line count, handled above
  }, [pageData, pageNumber]);

  if (!pageData) return null;

  const meaningActive = currentWordIndex >= 0;

  return (
    <div ref={overlayRef}>
      <PageView
        page={pageData}
        ghareebWords={pageWords}
        highlightedWordIndex={currentWordIndex}
        meaningEnabled={meaningActive}
        isPlaying={false}
        onWordClick={handleWordClick}
        onRenderedWordsChange={handleRenderedWordsChange}
        hidePageBadge={hidePageBadge}
        forceDisplayMode="lines15"
      />
    </div>
  );
}
