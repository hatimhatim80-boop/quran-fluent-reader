import React, { useEffect, useState, useRef, useCallback } from 'react';
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

export function HybridMushafPageView({ pageNumber, hidePageBadge }: HybridMushafPageViewProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);

  const debugMode = useSettingsStore((s) => s.settings.debugMode);

  // Reset on page change
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    setImgDimensions(null);
  }, [pageNumber]);

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true);
    if (imgRef.current) {
      setImgDimensions({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, []);

  const pngUrl = getPngUrl(pageNumber);

  // Calculate aspect ratio for container sizing
  const aspectRatio = imgDimensions ? imgDimensions.h / imgDimensions.w : 1.6; // ~standard mushaf ratio

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

      {/* Main hybrid container */}
      <div
        ref={containerRef}
        className="hybridContainer"
        style={{ aspectRatio: `1 / ${aspectRatio}` }}
      >
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

/** Inner component that renders PageView with transparent text */
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

  if (!pageData) return null;

  const meaningActive = currentWordIndex >= 0;

  return (
    <PageView
      page={pageData}
      ghareebWords={pageWords}
      highlightedWordIndex={currentWordIndex}
      meaningEnabled={meaningActive}
      isPlaying={false}
      onWordClick={handleWordClick}
      onRenderedWordsChange={handleRenderedWordsChange}
      hidePageBadge={hidePageBadge}
    />
  );
}
