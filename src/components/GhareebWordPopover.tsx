import React, { useState, useRef, useCallback } from "react";
import { GhareebWord } from "@/types/quran";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettingsStore } from "@/stores/settingsStore";
import { useHighlightOverrideStore, makePositionKey } from "@/stores/highlightOverrideStore";
import { dispatchWordInspection } from "./DevDebugPanel";

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

  const popoverWidth = popoverSettings.width || (isMobile ? 220 : 280);

  // Compute meaning using override store, then fallback to word.meaning
  const effectivePageNumber = pageNumber ?? word.pageNumber ?? 0;
  const posKey = makePositionKey(effectivePageNumber, dataLineIndex ?? 0, dataTokenIndex ?? 0);
  const identityKey = `${word.surahNumber}_${word.verseNumber}_${word.wordIndex}`;

  const getEffectiveMeaning = useHighlightOverrideStore((s) => s.getEffectiveMeaning);
  const meaningInfo = getEffectiveMeaning(posKey, identityKey, word.meaning || "");
  const effectiveMeaning = meaningInfo.meaning || word.meaning || "⚠️ لا يوجد معنى";

  const isOpen = forceOpen || isManualOpen;

  const calculatePosition = useCallback(() => {
    if (!wordRef.current || !containerRef.current) return null;
    const wordRect = wordRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 120;
    const arrowHeight = 10;
    const verticalOffset = 12;
    const padding = 12;

    const containerWidth = containerRect.width;
    const wordCenterX = wordRect.left - containerRect.left + wordRect.width / 2;
    let x = wordCenterX - popoverWidth / 2;
    let y = wordRect.top - containerRect.top - popoverHeight - arrowHeight - verticalOffset;
    let flipped = false;

    const minX = padding;
    const maxX = Math.max(padding, containerWidth - popoverWidth - padding);
    x = Math.max(minX, Math.min(maxX, x));

    let arrowX = wordCenterX - x;
    arrowX = Math.max(20, Math.min(popoverWidth - 20, arrowX));

    if (y < padding) {
      y = wordRect.bottom - containerRef.current.getBoundingClientRect().top + arrowHeight + verticalOffset;
      flipped = true;
    }

    return { x, y, arrowX, flipped };
  }, [containerRef, popoverWidth]);

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
    width: popoverWidth,
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

  const wordStyle: React.CSSProperties = {
    color: `hsl(${colorSettings.popoverText})`,
  };

  const meaningStyle: React.CSSProperties = {
    fontSize: `${fontSettings.meaningFontSize}rem`,
    color: `hsl(${colorSettings.popoverText})`,
  };

  const wordClasses = [
    "ghareeb-word",
    isHighlighted ? "ghareeb-word--active" : "",
    wasSeen && !isHighlighted ? "ghareeb-word--seen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <span
        ref={wordRef}
        className={wordClasses}
        data-ghareeb-index={index}
        data-ghareeb-key={word.uniqueKey}
        data-surah-number={word.surahNumber}
        data-verse={word.verseNumber}
        data-word-index={word.wordIndex}
        data-assembly-id={dataAssemblyId}
        data-line-index={dataLineIndex}
        data-token-index={dataTokenIndex}
        onClick={handleClick}
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
                  {effectiveMeaning}
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
