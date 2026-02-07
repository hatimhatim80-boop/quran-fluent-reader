import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GhareebWord } from '@/types/quran';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface GhareebWordPopoverProps {
  word: GhareebWord;
  index: number;
  isHighlighted: boolean;
  forceOpen?: boolean;
  onSelect: (word: GhareebWord, index: number) => void;
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
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
}: GhareebWordPopoverProps) {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Popover is open if forced (auto-play) or manually opened
  const isOpen = forceOpen || isManualOpen;

  // Single source of truth for meaning - NO duplication
  const meaning = word.meaning?.trim() ? word.meaning : 'لا يوجد معنى';

  const calculatePosition = useCallback((): PopoverPosition | null => {
    if (!wordRef.current || !containerRef.current) return null;

    const wordRect = wordRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const popoverWidth = isMobile ? 220 : 280;
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
  }, [containerRef, isMobile]);

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

  // Auto-position when forceOpen changes
  useEffect(() => {
    if (forceOpen) {
      const pos = calculatePosition();
      if (pos) setPosition(pos);
    }
  }, [forceOpen, calculatePosition]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      if (
        wordRef.current && !wordRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };

    const handleScroll = () => {
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
  }, [isOpen, closePopover]);

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
        onClick={handleClick}
      >
        {children}
      </span>

      {isOpen && position && portalTarget
        ? createPortal(
            <div
              ref={popoverRef}
              className={`ghareeb-popover ${position.flipped ? 'ghareeb-popover--flipped' : ''}`}
              style={
                {
                  left: position.x,
                  top: position.y,
                  width: isMobile ? 220 : 280,
                  '--arrow-x': `${position.arrowX}px`,
                } as React.CSSProperties
              }
            >
              <div className="ghareeb-popover__content">
                <div className="ghareeb-popover__word">{word.wordText}</div>
                <div className="ghareeb-popover__meaning">{meaning}</div>
              </div>
              <div className="ghareeb-popover__arrow" />
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
