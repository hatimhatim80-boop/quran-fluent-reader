import React, { useState, useCallback, useRef } from 'react';
import { useSvgWordBoxes } from '@/hooks/useSvgWordBoxes';
import { SvgWordEntry, WordBox } from '@/types/svgWordBoxes';
import { useSettingsStore } from '@/stores/settingsStore';
import { AlertTriangle, Bug } from 'lucide-react';

interface SvgOverlayPageViewProps {
  pageNumber: number;
  /** SVG source URL (e.g., /qpc-svg/page-001.svg) */
  svgUrl?: string;
  /** Callback when a word box is clicked */
  onWordClick?: (word: SvgWordEntry, index: number) => void;
  /** Currently highlighted word index */
  highlightedIndex?: number;
  /** Show debug overlay with bounding boxes */
  showDebug?: boolean;
  /** Hide page badge */
  hidePageBadge?: boolean;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export function SvgOverlayPageView({
  pageNumber,
  svgUrl,
  onWordClick,
  highlightedIndex = -1,
  showDebug = false,
  hidePageBadge = false,
}: SvgOverlayPageViewProps) {
  const { data, loading, error } = useSvgWordBoxes(pageNumber, true);
  const debugMode = useSettingsStore((s) => s.settings.debugMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const effectiveDebug = showDebug || debugMode;

  const resolvedSvgUrl = svgUrl || `/qpc-svg/page-${pad3(pageNumber)}.svg`;

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!data || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      // Find which word box contains the click point
      for (let i = 0; i < data.words.length; i++) {
        const { box } = data.words[i];
        if (
          relX >= box.x &&
          relX <= box.x + box.w &&
          relY >= box.y &&
          relY <= box.y + box.h
        ) {
          onWordClick?.(data.words[i], i);
          return;
        }
      }
    },
    [data, onWordClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!data || !containerRef.current || !effectiveDebug) return;

      const rect = containerRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      for (let i = 0; i < data.words.length; i++) {
        const { box } = data.words[i];
        if (
          relX >= box.x &&
          relX <= box.x + box.w &&
          relY >= box.y &&
          relY <= box.y + box.h
        ) {
          setHoveredIndex(i);
          return;
        }
      }
      setHoveredIndex(-1);
    },
    [data, effectiveDebug]
  );

  if (loading) {
    return (
      <div className="mushafPage text-center py-8">
        <p className="font-arabic text-muted-foreground text-sm">جاري تحميل بيانات الإحداثيات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mushafPage text-center py-8">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
          <p className="font-arabic text-destructive text-sm">
            لا تتوفر بيانات إحداثيات لهذه الصفحة
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mushafPage">
      {/* Page badge */}
      {!hidePageBadge && (
        <div className="text-center mb-2">
          <span className="text-xs text-muted-foreground font-arabic">
            صفحة {pageNumber}
            {effectiveDebug && data && (
              <span className="text-[10px] text-muted-foreground/60 mr-2 font-mono">
                [{data.words.length} word boxes]
              </span>
            )}
          </span>
        </div>
      )}

      {/* SVG + Overlay Container */}
      <div
        ref={containerRef}
        className="relative w-full mx-auto select-none"
        style={{ aspectRatio: data ? `${data.viewBox.w} / ${data.viewBox.h}` : '1000 / 1414' }}
        onClick={handleOverlayClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(-1)}
      >
        {/* SVG Background */}
        <img
          src={resolvedSvgUrl}
          alt={`صفحة ${pageNumber}`}
          className="absolute inset-0 w-full h-full object-contain"
          loading="lazy"
          draggable={false}
        />

        {/* Word Overlays */}
        {data?.words.map((word, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const isHovered = idx === hoveredIndex;

          return (
            <div
              key={word.key}
              className={`absolute cursor-pointer transition-colors duration-150 rounded-sm ${
                isHighlighted
                  ? 'bg-primary/30 ring-2 ring-primary/50'
                  : isHovered
                  ? 'bg-accent/20'
                  : effectiveDebug
                  ? 'border border-primary/20'
                  : ''
              }`}
              style={{
                left: `${word.box.x * 100}%`,
                top: `${word.box.y * 100}%`,
                width: `${word.box.w * 100}%`,
                height: `${word.box.h * 100}%`,
              }}
              title={effectiveDebug ? `${word.key}: ${word.text}` : word.text}
            />
          );
        })}

        {/* Debug: hovered word info */}
        {effectiveDebug && hoveredIndex >= 0 && data?.words[hoveredIndex] && (
          <div className="absolute top-2 left-2 bg-card/95 border border-border rounded-lg px-3 py-2 text-xs shadow-lg z-10 pointer-events-none">
            <div className="font-arabic text-foreground text-base mb-1">
              {data.words[hoveredIndex].text}
            </div>
            <div className="font-mono text-muted-foreground">
              Key: {data.words[hoveredIndex].key}
            </div>
            <div className="font-mono text-muted-foreground">
              Box: ({data.words[hoveredIndex].box.x.toFixed(3)}, {data.words[hoveredIndex].box.y.toFixed(3)})
              {data.words[hoveredIndex].box.w.toFixed(3)}×{data.words[hoveredIndex].box.h.toFixed(3)}
            </div>
            <div className="font-mono text-muted-foreground">
              Index: {hoveredIndex + 1}/{data.words.length}
            </div>
          </div>
        )}
      </div>

      {/* Debug: Mismatch warning */}
      {effectiveDebug && data?.debug && data.debug.wordsCount !== data.debug.boxesCount && (
        <div className="mt-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-300/50 rounded p-2 flex items-center gap-2">
          <Bug className="w-4 h-4 text-orange-500 shrink-0" />
          <p className="text-xs font-mono text-orange-700 dark:text-orange-300">
            Mismatch: {data.debug.wordsCount} layout words vs {data.debug.boxesCount} SVG boxes
          </p>
        </div>
      )}

      {/* Debug: word count */}
      {effectiveDebug && data && (
        <div className="text-center mt-1">
          <span className="text-[9px] text-muted-foreground/40 font-mono">
            {data.words.length} mapped words | viewBox: {data.viewBox.w}×{data.viewBox.h}
          </span>
        </div>
      )}
    </div>
  );
}
