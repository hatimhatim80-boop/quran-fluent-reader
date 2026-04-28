import React, { useState, useRef, useCallback, useEffect } from "react";
import { GhareebWord } from "@/types/quran";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettingsStore } from "@/stores/settingsStore";
import { useHighlightOverrideStore, makePositionKey } from "@/stores/highlightOverrideStore";
import { dispatchWordInspection } from "./DevDebugPanel";
import { DEFAULT_GHAREEB_SOURCE_SETTINGS, GHAREEB_SOURCE_LABELS } from "@/services/ghareebSourceSettings";

interface GhareebWordPopoverProps {
  word: GhareebWord;
  index: number;
  isHighlighted: boolean;
  forceOpen?: boolean;
  onSelect: (word: GhareebWord, index: number) => void;
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  dataAssemblyId?: string;
  dataLineIndex?: number;
  dataTokenIndex?: number;
  pageNumber?: number;
  wasSeen?: boolean;
  extraClassName?: string;
  onExtraClick?: (e: React.MouseEvent) => void;
  activeHighlightStyle?: 'default' | 'color' | 'bg' | 'border';
}

export function GhareebWordPopover({
  word,
  index,
  isHighlighted,
  forceOpen = false,
  onSelect,
  children,
  containerRef,
  dataAssemblyId,
  dataLineIndex,
  dataTokenIndex,
  pageNumber,
  wasSeen = false,
  extraClassName,
  onExtraClick,
  activeHighlightStyle = 'default',
}: GhareebWordPopoverProps) {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { settings } = useSettingsStore();
  const popoverSettings = settings.popover;
  const fontSettings = settings.fonts;
  const colorSettings = settings.colors;
  const ghareebSourceSettings = settings.ghareebSources ?? DEFAULT_GHAREEB_SOURCE_SETTINGS;
  const [askedSource, setAskedSource] = useState<'muyassar' | 'new' | null>(null);

  const popoverMaxWidth = popoverSettings.width || (isMobile ? 260 : 320);
  const popoverMinWidth = isMobile ? 120 : 140;
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  // Compute meaning using override store, then fallback to word.meaning
  const effectivePageNumber = pageNumber ?? word.pageNumber ?? 0;
  const posKey = makePositionKey(effectivePageNumber, dataLineIndex ?? 0, dataTokenIndex ?? 0);
  const identityKey = `${word.surahNumber}_${word.verseNumber}_${word.wordIndex}`;

  const getEffectiveMeaning = useHighlightOverrideStore((s) => s.getEffectiveMeaning);
  const meaningInfo = getEffectiveMeaning(posKey, identityKey, word.meaning || "");
  
  const isSharedWord = !!word.meaningsBySource?.muyassar && !!word.meaningsBySource?.new;
  const sourceMeaning = (() => {
    if (!isSharedWord) return word.meaning;
    if (ghareebSourceSettings.sharedMeaningMode === 'new') return word.meaningsBySource?.new || word.meaning;
    if (ghareebSourceSettings.sharedMeaningMode === 'both') {
      return `${GHAREEB_SOURCE_LABELS.muyassar}: ${word.meaningsBySource?.muyassar || ''}\n\n${GHAREEB_SOURCE_LABELS.new}: ${word.meaningsBySource?.new || ''}`;
    }
    if (ghareebSourceSettings.sharedMeaningMode === 'ask' && askedSource) {
      return word.meaningsBySource?.[askedSource] || word.meaning;
    }
    return word.meaningsBySource?.muyassar || word.meaning;
  })();

  // Resolve meaningId references: if source is 'override-ref', the meaning field contains
  // a uniqueKey that needs to be resolved. Use word.meaning as final fallback.
  let effectiveMeaning = meaningInfo.meaning || sourceMeaning || "⚠️ لا يوجد معنى";
  if (meaningInfo.source === 'override-ref' && meaningInfo.meaning) {
    // meaningId was returned as-is; use word.meaning which was pre-resolved in PageView
    effectiveMeaning = sourceMeaning || meaningInfo.meaning || "⚠️ لا يوجد معنى";
  }

  // Close manual popover when another word is selected (isHighlighted becomes false)
  useEffect(() => {
    if (!isHighlighted && isManualOpen) {
      setIsManualOpen(false);
      setPosition(null);
      setMeasuredHeight(null);
      setMeasuredWidth(null);
    }
  }, [isHighlighted, isManualOpen]);

  const isOpen = forceOpen || isManualOpen;

  const calculatePosition = useCallback((actualHeight?: number, actualWidth?: number) => {
    if (!wordRef.current || !containerRef.current) return null;
    const wordRect = wordRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverHeight = actualHeight || measuredHeight || 80;
    const effectiveWidth = actualWidth || measuredWidth || popoverMinWidth;
    const arrowHeight = 10;
    const verticalOffset = 6;
    const padding = 12;

    const containerWidth = containerRect.width;
    const wordCenterX = wordRect.left - containerRect.left + wordRect.width / 2;
    let x = wordCenterX - effectiveWidth / 2;
    let y = wordRect.top - containerRect.top - popoverHeight - arrowHeight - verticalOffset;
    let flipped = false;

    const minX = padding;
    const maxX = Math.max(padding, containerWidth - effectiveWidth - padding);
    x = Math.max(minX, Math.min(maxX, x));

    let arrowX = wordCenterX - x;
    arrowX = Math.max(20, Math.min(effectiveWidth - 20, arrowX));

    if (y < padding) {
      y = wordRect.bottom - containerRef.current.getBoundingClientRect().top + arrowHeight + verticalOffset;
      flipped = true;
    }

    return { x, y, arrowX, flipped };
  }, [containerRef, popoverMinWidth, measuredHeight, measuredWidth]);

  const closePopover = useCallback(() => {
    setIsManualOpen(false);
    setPosition(null);
  }, []);

  const openPopover = useCallback(() => {
    const pos = calculatePosition();
    if (!pos) return;
    setPosition(pos);
    setIsManualOpen(true);
    onSelect(word, index);
  }, [calculatePosition, index, onSelect, word]);

  // Measure actual popover size after render and reposition
  useEffect(() => {
    if (!isOpen || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const h = rect.height;
    const w = rect.width;
    if (h > 0 && (h !== measuredHeight || w !== measuredWidth)) {
      const newH = h;
      const newW = w;
      setMeasuredHeight(newH);
      setMeasuredWidth(newW);
      const pos = calculatePosition(newH, newW);
      if (pos) setPosition(pos);
    }
  // Only re-run when open state or popover ref changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // AUTO-PLAY: Calculate position when forceOpen becomes true
  useEffect(() => {
    if (forceOpen && !position) {
      const pos = calculatePosition();
      if (pos) setPosition(pos);
    }
    if (!forceOpen && !isManualOpen) {
      setPosition(null);
      setMeasuredHeight(null);
      setMeasuredWidth(null);
    }
  }, [forceOpen, isManualOpen, calculatePosition, position]);

  // Keep position updated during autoplay — only recalculate on scroll/resize,
  // NOT on every animation frame, to prevent vibration/shaking.
  useEffect(() => {
    if (!forceOpen) return;

    // Calculate once immediately when forceOpen fires
    const recalc = () => {
      const h = popoverRef.current?.getBoundingClientRect().height || undefined;
      const pos = calculatePosition(h);
      if (pos) setPosition(prev => {
        // Only update if position actually changed (prevent unnecessary re-renders)
        if (!prev) return pos;
        if (Math.abs(prev.x - pos.x) < 1 && Math.abs(prev.y - pos.y) < 1) return prev;
        return pos;
      });
    };

    recalc();

    // Listen to scroll on the container (word may scroll with the page)
    const container = containerRef.current;
    const scrollParent = container?.closest('[class*="overflow"]') || window;
    scrollParent.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', recalc);
      window.removeEventListener('resize', recalc);
    };
  }, [forceOpen, calculatePosition, containerRef]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (process.env.NODE_ENV !== "production") {
      dispatchWordInspection({
        uniqueKey: word.uniqueKey,
        originalWord: word.wordText,
        surahNumber: word.surahNumber,
        verseNumber: word.verseNumber,
        wordIndex: word.wordIndex,
        meaning: effectiveMeaning,
        tokenIndex: index,
        assemblyId: dataAssemblyId,
        matchedMeaningId: word.uniqueKey,
        meaningPreview: effectiveMeaning.slice(0, 60) + (effectiveMeaning.length > 60 ? "..." : ""),
        selectionSource: "popover-click",
      });
    }

    isManualOpen ? closePopover() : openPopover();
  };

  // باقي useEffects كما هو...

  const portalTarget = containerRef.current;

  const popoverStyle = {
    left: position?.x,
    top: position?.y,
    maxWidth: popoverMaxWidth,
    minWidth: popoverMinWidth,
    width: 'fit-content',
    "--arrow-x": `${position?.arrowX}px`,
  } as React.CSSProperties;

  const contentStyle: React.CSSProperties = {
    padding: popoverSettings.padding,
    borderRadius: popoverSettings.borderRadius,
    opacity: popoverSettings.opacity / 100,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    background: `linear-gradient(180deg, hsl(${colorSettings.popoverBackground}) 0%, hsl(${colorSettings.popoverBackground}) 100%)`,
    borderColor: `hsl(${colorSettings.popoverBorder})`,
  };

  const meaningBoxSettings = settings.meaningBox || { wordFontSize: 1.4, meaningFontSize: 1.1 };
  const wordColor = colorSettings.popoverWordColor || colorSettings.popoverText || '25 30% 18%';
  const meaningColor = colorSettings.popoverMeaningColor || colorSettings.popoverText || '25 20% 35%';

  const wordStyle: React.CSSProperties = {
    color: `hsl(${wordColor})`,
    fontSize: `${meaningBoxSettings.wordFontSize}rem`,
  };

  const meaningStyle: React.CSSProperties = {
    fontSize: `${meaningBoxSettings.meaningFontSize}rem`,
    color: `hsl(${meaningColor})`,
  };

  const globalHighlightStyle = settings.colors.highlightStyle || 'background';
  // Determine effective highlight mode: prop > global setting
  const effectiveHighlightMode = activeHighlightStyle !== 'default'
    ? activeHighlightStyle
    : (globalHighlightStyle === 'text-only' ? 'color' : 'bg');

  const wordClasses = [
    "ghareeb-word quran-word",
    effectiveHighlightMode === 'color' ? "ghareeb-word--text-only" : "",
    isHighlighted ? "ghareeb-word--active" : "",
    wasSeen && !isHighlighted ? "ghareeb-word--seen" : "",
    extraClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  // Build inline styles based on the effective highlight mode
  const activeWordStyle: Record<string, string> = (() => {
    if (!isHighlighted) return {};
    const hlColor = settings.colors.highlightColor || '0 85% 45%';
    const base: Record<string, string> = {
      '--ghareeb-active-color': 'hsl(var(--primary))',
      '--ghareeb-active-bg': 'transparent',
      '--ghareeb-active-border': 'transparent',
      '--ghareeb-active-shadow': 'none',
    };
    if (effectiveHighlightMode === 'color') {
      base['--ghareeb-active-color'] = `hsl(${hlColor})`;
    } else if (effectiveHighlightMode === 'bg') {
      base['--ghareeb-active-bg'] = `hsl(${hlColor} / 0.35)`;
    } else if (effectiveHighlightMode === 'border') {
      base['--ghareeb-active-border'] = `hsl(${hlColor})`;
    }
    return base;
  })();

  return (
    <>
      <span
        ref={wordRef}
        className={wordClasses}
        style={activeWordStyle}
        data-ghareeb-index={index}
        data-ghareeb-key={word.uniqueKey}
        data-color-idx={index % 5}
        data-surah-number={word.surahNumber}
        data-verse={word.verseNumber}
        data-word-index={word.wordIndex}
        data-assembly-id={dataAssemblyId}
        data-line-index={dataLineIndex}
        data-token-index={dataTokenIndex}
        onClick={onExtraClick || handleClick}
      >
        {children}
      </span>

      {isOpen && position && portalTarget
        ? createPortal(
            <div
              ref={popoverRef}
              className={`ghareeb-popover ${position.flipped ? "ghareeb-popover--flipped" : ""}`}
              style={popoverStyle}
            >
              <div className="ghareeb-popover__content" style={contentStyle}>
                <div className="ghareeb-popover__word" style={wordStyle}>
                  {word.wordText}
                </div>
                <div className="ghareeb-popover__meaning" style={meaningStyle}>
                  {isSharedWord && ghareebSourceSettings.sharedMeaningMode === 'ask' && !askedSource ? (
                    <div className="space-y-2">
                      <div>اختر مصدر المعنى:</div>
                      <div className="flex flex-col gap-1.5">
                        <button className="rounded-md border border-border px-2 py-1 text-xs font-arabic hover:bg-primary/10" onClick={() => setAskedSource('muyassar')}>الميسر في غريب القرآن</button>
                        <button className="rounded-md border border-border px-2 py-1 text-xs font-arabic hover:bg-primary/10" onClick={() => setAskedSource('new')}>الكتاب الجديد</button>
                      </div>
                    </div>
                  ) : effectiveMeaning}
                </div>
              </div>
              {popoverSettings.showArrow && <div className="ghareeb-popover__arrow" />}
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
