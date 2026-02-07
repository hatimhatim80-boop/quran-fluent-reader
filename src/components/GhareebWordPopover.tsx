import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GhareebWord } from '@/types/quran';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface GhareebWordPopoverProps {
  word: GhareebWord;
  index: number;
  isHighlighted: boolean;
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
  onSelect,
  children,
  containerRef,
}: GhareebWordPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = useCallback(() => {
    if (!wordRef.current || !containerRef.current) return null;

    const wordRect = wordRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const popoverWidth = isMobile ? 220 : 260;
    const popoverHeight = 90; // Approximate height
    const arrowHeight = 8;
    const padding = 12;

    // Calculate center position above the word
    let x = wordRect.left + wordRect.width / 2 - popoverWidth / 2;
    let y = wordRect.top - popoverHeight - arrowHeight;
    let flipped = false;

    // Clamp horizontally within container
    const minX = containerRect.left + padding;
    const maxX = containerRect.right - popoverWidth - padding;
    x = Math.max(minX, Math.min(maxX, x));

    // Calculate arrow position (relative to popover)
    const wordCenterX = wordRect.left + wordRect.width / 2;
    let arrowX = wordCenterX - x;
    arrowX = Math.max(16, Math.min(popoverWidth - 16, arrowX));

    // Flip below if not enough space above
    if (y < containerRect.top + padding) {
      y = wordRect.bottom + arrowHeight;
      flipped = true;
    }

    return { x, y, arrowX, flipped };
  }, [containerRef, isMobile]);

  const openPopover = useCallback(() => {
    const pos = calculatePosition();
    if (pos) {
      setPosition(pos);
      setIsOpen(true);
      onSelect(word, index);
    }
  }, [calculatePosition, onSelect, word, index]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  // Handle click/tap
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  };

  // Handle hover (desktop only)
  const handleMouseEnter = () => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => {
      openPopover();
    }, 100);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    closePopover();
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
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
    document.addEventListener('touchstart', handleOutsideClick as any);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick as any);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, closePopover]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const pos = calculatePosition();
      if (pos) setPosition(pos);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, calculatePosition]);

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <span
        ref={wordRef}
        className={`ghareeb-word ${isHighlighted ? 'ghareeb-word--active' : ''}`}
        data-ghareeb-index={index}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>

      {isOpen && position && createPortal(
        <div
          ref={popoverRef}
          className={`ghareeb-popover ${position.flipped ? 'ghareeb-popover--flipped' : ''}`}
          style={{
            left: position.x,
            top: position.y,
            maxWidth: isMobile ? 220 : 260,
            '--arrow-x': `${position.arrowX}px`,
          } as React.CSSProperties}
          onMouseEnter={() => !isMobile && setIsOpen(true)}
          onMouseLeave={() => !isMobile && closePopover()}
        >
          <div className="ghareeb-popover__content">
            <div className="ghareeb-popover__word font-arabic">
              {word.wordText}
            </div>
            <div className="ghareeb-popover__meaning font-arabic">
              {word.meaning}
            </div>
          </div>
          <div className="ghareeb-popover__arrow" />
        </div>,
        document.body
      )}
    </>
  );
}
