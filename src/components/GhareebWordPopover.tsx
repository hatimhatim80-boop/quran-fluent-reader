import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GhareebWord } from '@/types/quran';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettingsStore } from '@/stores/settingsStore';
import { dispatchWordInspection } from './DevDebugPanel';

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
}

interface PopoverPosition {
  x: number;
  y: number;
  arrowX: number;
  flipped: boolean;
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
}: GhareebWordPopoverProps) {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Get settings for live updates
  const { settings } = useSettingsStore();
  const popoverSettings = settings.popover;
  const fontSettings = settings.fonts;
  const colorSettings = settings.colors;

  // Popover is open if forced (auto-play) or manually opened
  const isOpen = forceOpen || isManualOpen;

  // Single source of truth for meaning - NO duplication
  const meaning = word.meaning?.trim() ? word.meaning : 'لا يوجد معنى';

  // Get popover width from settings
  const popoverWidth = popoverSettings.width || (isMobile ? 220 : 280);

  const calculatePosition = useCallback((): PopoverPosition | null => {
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

    // Clamp within container
    const minX = padding;
    const maxX = Math.max(padding, containerWidth - popoverWidth - padding);
    x = Math.max(minX, Math.min(maxX, x));

    // Arrow within popover
    let arrowX = wordCenterX - x;
    arrowX = Math.max(20, Math.min(popoverWidth - 20, arrowX));

    // Flip below if not enough space above
    if (y < padding) {
      y = wordRect.bottom - containerRect.top + arrowHeight + verticalOffset;
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

  // Auto-position when forceOpen changes (autoplay)
  useEffect(() => {
    if (!forceOpen) return;

    let rafId: number | null = null;
    const start = performance.now();
    const maxDurationMs = 450;

    const tick = () => {
      const pos = calculatePosition();
      if (pos) setPosition(pos);

      if (performance.now() - start < maxDurationMs) {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [forceOpen, calculatePosition]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Dispatch inspection event for DEV debug panel
    if (process.env.NODE_ENV !== 'production') {
      dispatchWordInspection({
        uniqueKey: word.uniqueKey,
        originalWord: word.wordText,
        surahNumber: word.surahNumber,
        verseNumber: word.verseNumber,
        wordIndex: word.wordIndex,
        meaning: word.meaning || '',
        tokenIndex: index,
        assemblyId: dataAssemblyId,
        matchedMeaningId: word.uniqueKey,
        meaningPreview: (word.meaning || '').slice(0, 60) + ((word.meaning || '').length > 60 ? '...' : ''),
        selectionSource: 'popover-click',
      });
    }
    
    if (isManualOpen) {
      closePopover();
    } else {
      openPopover();
    }
  };

  // Close on outside tap/click or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (forceOpen) return;

      if (
        wordRef.current && !wordRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };

    const handleScroll = () => {
      if (forceOpen) {
        const pos = calculatePosition();
        if (pos) setPosition(pos);
        return;
      }

      closePopover();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, forceOpen, calculatePosition, closePopover]);

  // Reposition on resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const pos = calculatePosition();
      if (pos) setPosition(pos);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, calculatePosition]);

  const portalTarget = containerRef.current;

  // Build dynamic styles from settings
  const shadowMap: Record<string, string> = {
    none: 'none',
    soft: '0 2px 8px rgba(0, 0, 0, 0.08)',
    medium: '0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.08)',
    strong: '0 12px 32px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.12)',
  };

  const popoverStyle: React.CSSProperties = {
    left: position?.x,
    top: position?.y,
    width: popoverWidth,
    '--arrow-x': `${position?.arrowX}px`,
  } as React.CSSProperties;

  const contentStyle: React.CSSProperties = {
    padding: popoverSettings.padding,
    borderRadius: popoverSettings.borderRadius,
    opacity: popoverSettings.opacity / 100,
    boxShadow: shadowMap[popoverSettings.shadow] || shadowMap.medium,
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

  return (
    <>
      <span
        ref={wordRef}
        className={`ghareeb-word ${isHighlighted ? 'ghareeb-word--active' : ''}`}
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
              className={`ghareeb-popover ${position.flipped ? 'ghareeb-popover--flipped' : ''}`}
              style={popoverStyle}
            >
              <div className="ghareeb-popover__content" style={contentStyle}>
                <div className="ghareeb-popover__word" style={wordStyle}>{word.wordText}</div>
                <div className="ghareeb-popover__meaning" style={meaningStyle}>{meaning}</div>
              </div>
              {popoverSettings.showArrow && <div className="ghareeb-popover__arrow" />}
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
