import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuranData } from '@/hooks/useQuranData';
import { useQuranComWords, QuranComWord } from '@/hooks/useQuranComWords';
import { PageView } from './PageView';
import { GhareebWord } from '@/types/quran';
import { MeaningBox } from './MeaningBox';
import { makePositionKey } from '@/stores/highlightOverrideStore';
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
 * Text area: 10.5% to 93.5%, 15 lines evenly distributed.
 */
const TEXT_AREA_TOP = 10.5;
const TEXT_AREA_BOTTOM = 93.5;
const LINE_SLOT_HEIGHT = (TEXT_AREA_BOTTOM - TEXT_AREA_TOP) / 15;
const TEXT_AREA_LEFT = 6;
const TEXT_AREA_RIGHT = 94;
const TEXT_AREA_WIDTH = TEXT_AREA_RIGHT - TEXT_AREA_LEFT;

function getLineTop(lineIndex: number): number {
  return TEXT_AREA_TOP + lineIndex * LINE_SLOT_HEIGHT;
}

/** Match a ghareeb word to an API word using location key */
function buildLocationKey(surahNumber: number, verseNumber: number, wordIndex: number): string {
  return `${surahNumber}:${verseNumber}:${wordIndex}`;
}

export function HybridMushafPageView({ pageNumber, hidePageBadge }: HybridMushafPageViewProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const debugMode = useSettingsStore((s) => s.settings.debugMode);

  // Fetch word positions from quran.com API
  const { data: apiWords, loading: apiLoading, error: apiError } = useQuranComWords(pageNumber);

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

  // Determine if API overlay is ready
  const useApiOverlay = !!apiWords && !apiError;

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

        {/* Layer B: Word boxes from API or text fallback */}
        {useApiOverlay ? (
          <div className={`hybridTextLayer ${debugOverlay ? 'hybridTextLayer--debug' : ''} ${imgLoaded || imgError ? 'hybridTextLayer--ready' : ''}`}>
            <ApiWordOverlay
              pageNumber={pageNumber}
              apiWords={apiWords}
              debugOverlay={debugOverlay}
              hidePageBadge={hidePageBadge ?? true}
            />
          </div>
        ) : (
          <div className={`hybridTextLayer ${debugOverlay ? 'hybridTextLayer--debug' : ''} ${imgLoaded || imgError ? 'hybridTextLayer--ready' : ''}`}>
            <FallbackTextOverlay
              pageNumber={pageNumber}
              hidePageBadge={hidePageBadge ?? true}
              debugOverlay={debugOverlay}
            />
          </div>
        )}
      </div>

      {/* API status indicator in debug mode */}
      {debugMode && (
        <div className="text-center mt-1">
          <span className="text-[9px] text-muted-foreground/50 font-mono">
            {apiLoading ? '⏳ API loading...' : apiError ? `❌ API: ${apiError}` : apiWords ? `✅ API: ${apiWords.allWords.length} words, ${apiWords.lines.length} lines` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** 
 * API-based word overlay: renders transparent click targets 
 * positioned precisely using quran.com line_number data 
 */
function ApiWordOverlay({
  pageNumber,
  apiWords,
  debugOverlay,
  hidePageBadge,
}: {
  pageNumber: number;
  apiWords: NonNullable<ReturnType<typeof useQuranComWords>['data']>;
  debugOverlay: boolean;
  hidePageBadge: boolean;
}) {
  const {
    getPageGhareebWords,
    currentWordIndex,
    setCurrentWordIndex,
  } = useQuranData();

  const ghareebWords = getPageGhareebWords;
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [renderedWords, setRenderedWords] = useState<GhareebWord[]>([]);

  // Build ghareeb lookup by location key
  const ghareebByLocation = useMemo(() => {
    const map = new Map<string, { word: GhareebWord; index: number }>();
    ghareebWords.forEach((gw, idx) => {
      // Try exact location match
      const key = buildLocationKey(gw.surahNumber, gw.verseNumber, gw.wordIndex);
      map.set(key, { word: gw, index: idx });
    });
    return map;
  }, [ghareebWords]);

  // Build word boxes with ghareeb matching
  const wordBoxes = useMemo(() => {
    const boxes: Array<{
      apiWord: QuranComWord;
      lineIndex: number; // 0-based
      top: number; // %
      left: number; // %
      width: number; // %
      height: number; // %
      ghareeb: { word: GhareebWord; index: number } | null;
      globalIndex: number;
    }> = [];

    let globalIdx = 0;

    for (const line of apiWords.lines) {
      const lineIndex = line.lineNumber - 1; // Convert to 0-based
      if (lineIndex < 0 || lineIndex >= 15) continue;

      const top = getLineTop(lineIndex);
      const height = LINE_SLOT_HEIGHT;
      const wordsInLine = line.words.length;

      // Distribute words RTL across the text area
      // In RTL, first word (position 1) is rightmost
      const wordWidth = TEXT_AREA_WIDTH / Math.max(wordsInLine, 1);

      for (let i = 0; i < wordsInLine; i++) {
        const apiWord = line.words[i];
        // RTL: first word at right edge, last at left edge
        const left = TEXT_AREA_RIGHT - wordWidth * (i + 1);

        // Try to match with ghareeb
        const ghareeb = ghareebByLocation.get(apiWord.location) ?? null;

        boxes.push({
          apiWord,
          lineIndex,
          top,
          left,
          width: wordWidth,
          height,
          ghareeb,
          globalIndex: globalIdx++,
        });
      }
    }

    return boxes;
  }, [apiWords, ghareebByLocation]);

  // Build rendered ghareeb words list (in reading order)
  useEffect(() => {
    const matched = wordBoxes
      .filter((b) => b.ghareeb)
      .map((b) => b.ghareeb!.word);
    setRenderedWords(matched);
  }, [wordBoxes]);

  const handleWordClick = useCallback(
    (box: typeof wordBoxes[0]) => {
      if (box.ghareeb) {
        setCurrentWordIndex(box.ghareeb.index);
      }
    },
    [setCurrentWordIndex]
  );

  const meaningActive = currentWordIndex >= 0;
  const activeGhareeb = meaningActive ? ghareebWords[currentWordIndex] : null;

  return (
    <div className="absolute inset-0">
      {wordBoxes.map((box) => {
        const isGhareeb = !!box.ghareeb;
        const isActive = isGhareeb && box.ghareeb!.index === currentWordIndex;
        const isHovered = box.globalIndex === hoveredIndex;
        const isEnd = box.apiWord.char_type_name === 'end';

        return (
          <div
            key={`${box.apiWord.location}-${box.globalIndex}`}
            className={`absolute cursor-pointer transition-colors duration-150 rounded-sm ${
              isActive
                ? 'hybridWordBox--active'
                : isGhareeb
                ? isHovered
                  ? 'hybridWordBox--ghareeb-hover'
                  : 'hybridWordBox--ghareeb'
                : isHovered && debugOverlay
                ? 'hybridWordBox--hover'
                : ''
            } ${debugOverlay ? 'hybridWordBox--debug' : ''} ${isEnd ? 'hybridWordBox--end' : ''}`}
            style={{
              top: `${box.top}%`,
              left: `${box.left}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
            }}
            onClick={() => handleWordClick(box)}
            onMouseEnter={() => setHoveredIndex(box.globalIndex)}
            onMouseLeave={() => setHoveredIndex(-1)}
            title={debugOverlay ? `${box.apiWord.location}: ${box.apiWord.text_uthmani}` : undefined}
          >
            {/* Show text in debug mode */}
            {debugOverlay && (
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-arabic text-destructive/60 overflow-hidden pointer-events-none">
                {box.apiWord.text_uthmani}
              </span>
            )}
          </div>
        );
      })}

      {/* Meaning box for active ghareeb word */}
      {activeGhareeb && meaningActive && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
          <MeaningBox
            positionKey={makePositionKey(activeGhareeb.surahNumber, activeGhareeb.verseNumber, activeGhareeb.wordIndex)}
            identityKey={activeGhareeb.uniqueKey}
            defaultMeaning={activeGhareeb.meaning}
            wordText={activeGhareeb.wordText}
            surahName={activeGhareeb.surahName}
            verseNumber={activeGhareeb.verseNumber}
            onClose={() => setCurrentWordIndex(-1)}
          />
        </div>
      )}

      {/* Debug: hovered word info */}
      {debugOverlay && hoveredIndex >= 0 && wordBoxes[hoveredIndex] && (
        <div className="absolute top-2 left-2 bg-card/95 border border-border rounded-lg px-3 py-2 text-xs shadow-lg z-10 pointer-events-none">
          <div className="font-arabic text-foreground text-base mb-1">
            {wordBoxes[hoveredIndex].apiWord.text_uthmani}
          </div>
          <div className="font-mono text-muted-foreground">
            Key: {wordBoxes[hoveredIndex].apiWord.location}
          </div>
          <div className="font-mono text-muted-foreground">
            Line: {wordBoxes[hoveredIndex].lineIndex + 1} | 
            {wordBoxes[hoveredIndex].ghareeb ? ' ✅ غريب' : ' ○ عادي'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Fallback: original text-based overlay when API is not available */
function FallbackTextOverlay({
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

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayRef.current) return;
    const lines = overlayRef.current.querySelectorAll('.quran-line');
    let realLineIndex = 0;
    lines.forEach((line) => {
      const el = line as HTMLElement;
      const text = el.textContent?.trim();
      if (!text) {
        el.style.display = 'none';
        return;
      }
      el.style.top = `${getLineTop(realLineIndex)}%`;
      realLineIndex++;
      if (realLineIndex > 15) {
        el.style.display = 'none';
      }
    });
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
