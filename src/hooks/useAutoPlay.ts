import { useState, useEffect, useCallback, useRef } from 'react';
import { GhareebWord } from '@/types/quran';

interface UseAutoPlayProps {
  words: GhareebWord[];
  currentWordIndex: number;
  setCurrentWordIndex: (index: number) => void;
  onPageEnd?: () => void;
}

export function useAutoPlay({
  words,
  currentWordIndex,
  setCurrentWordIndex,
  onPageEnd,
}: UseAutoPlayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // seconds per word
  const thinkingGap = 800; // 0.8s gap before showing meaning
  
  // Use refs to avoid stale closures in setTimeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(currentWordIndex);
  const wordsRef = useRef(words);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);

  // Keep refs in sync
  useEffect(() => {
    currentIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  useEffect(() => {
    wordsRef.current = words;
    console.log('[autoplay] Words updated, count:', words.length);
  }, [words]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Scroll active word into view
  const scrollToActiveWord = useCallback((index: number) => {
    const wordEl = document.querySelector(`[data-ghareeb-index="${index}"]`);
    if (wordEl) {
      wordEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, []);

  // Schedule next word using setTimeout chain
  const scheduleNext = useCallback(() => {
    if (!isPlayingRef.current) {
      console.log('[autoplay] Not playing, stopping schedule');
      return;
    }

    const currentWords = wordsRef.current;
    const currentIdx = currentIndexRef.current;
    const delayMs = speedRef.current * 1000;

    console.log('[autoplay] Scheduling next step:', {
      currentIndex: currentIdx,
      totalWords: currentWords.length,
      delayMs,
    });

    timeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) {
        console.log('[autoplay] Stopped during timeout, aborting');
        return;
      }

      const nextIdx = currentIndexRef.current + 1;
      const total = wordsRef.current.length;

      console.log('[autoplay] Advancing:', {
        from: currentIndexRef.current,
        to: nextIdx,
        total,
        word: wordsRef.current[currentIndexRef.current]?.wordText || 'N/A',
        key: wordsRef.current[currentIndexRef.current]?.uniqueKey || 'N/A',
      });

      if (nextIdx < total) {
        // Advance to next word
        setCurrentWordIndex(nextIdx);
        currentIndexRef.current = nextIdx;
        // Scroll to new word
        scrollToActiveWord(nextIdx);
        // Schedule the next step
        scheduleNext();
      } else {
        // Reached end
        console.log('[autoplay] Finished all words');
        setIsPlaying(false);
        isPlayingRef.current = false;
        onPageEnd?.();
      }
    }, delayMs);
  }, [setCurrentWordIndex, onPageEnd, scrollToActiveWord]);

  const play = useCallback(() => {
    // Prevent double timers - if already playing, pause instead
    if (isPlayingRef.current) {
      console.log('[autoplay] Already playing, pausing instead');
      setIsPlaying(false);
      isPlayingRef.current = false;
      clearTimer();
      return;
    }

    if (wordsRef.current.length === 0) {
      console.log('[autoplay] No words to play');
      return;
    }

    clearTimer();
    
    // Always start from beginning
    console.log('[autoplay] Starting playback, words:', wordsRef.current.length);
    setCurrentWordIndex(0);
    currentIndexRef.current = 0;
    setIsPlaying(true);
    isPlayingRef.current = true;

    // Log first word
    const firstWord = wordsRef.current[0];
    console.log('[autoplay] First word:', {
      index: 0,
      text: firstWord?.wordText,
      key: firstWord?.uniqueKey,
      meaning: firstWord?.meaning ? 'found' : 'NOT FOUND',
    });

    // Scroll to first word
    scrollToActiveWord(0);

    // Schedule first advance after delay
    scheduleNext();
  }, [clearTimer, setCurrentWordIndex, scheduleNext, scrollToActiveWord]);

  const pause = useCallback(() => {
    console.log('[autoplay] Paused at index:', currentIndexRef.current);
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (wordsRef.current.length === 0) return;
    
    console.log('[autoplay] Resuming from index:', currentIndexRef.current);
    setIsPlaying(true);
    isPlayingRef.current = true;
    scheduleNext();
  }, [scheduleNext]);

  const stop = useCallback(() => {
    console.log('[autoplay] Stopped');
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTimer();
    setCurrentWordIndex(-1);
    currentIndexRef.current = -1;
  }, [clearTimer, setCurrentWordIndex]);

  const nextWord = useCallback(() => {
    const total = wordsRef.current.length;
    if (currentIndexRef.current < total - 1) {
      const nextIdx = currentIndexRef.current + 1;
      setCurrentWordIndex(nextIdx);
      currentIndexRef.current = nextIdx;
      
      console.log('[autoplay] Manual next:', nextIdx);
      
      // If playing, restart the timer
      if (isPlayingRef.current) {
        clearTimer();
        scheduleNext();
      }
    }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  const prevWord = useCallback(() => {
    if (currentIndexRef.current > 0) {
      const prevIdx = currentIndexRef.current - 1;
      setCurrentWordIndex(prevIdx);
      currentIndexRef.current = prevIdx;
      
      console.log('[autoplay] Manual prev:', prevIdx);
      
      // If playing, restart the timer
      if (isPlayingRef.current) {
        clearTimer();
        scheduleNext();
      }
    }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  // Jump to specific word (for manual click during playback)
  const jumpTo = useCallback((index: number) => {
    if (index < 0 || index >= wordsRef.current.length) return;
    
    console.log('[autoplay] Jump to:', index);
    setCurrentWordIndex(index);
    currentIndexRef.current = index;
    
    // If playing, restart timer from new position
    if (isPlayingRef.current) {
      clearTimer();
      scheduleNext();
    }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  // Reset when words change (page change) while playing
  useEffect(() => {
    if (!isPlaying) return;
    
    console.log('[autoplay] Page changed while playing, resetting to 0');
    clearTimer();
    setCurrentWordIndex(0);
    currentIndexRef.current = 0;
    
    // Restart playback from beginning of new page
    if (words.length > 0) {
      scheduleNext();
    }
  }, [words, isPlaying, clearTimer, setCurrentWordIndex, scheduleNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    resume,
    stop,
    nextWord,
    prevWord,
    jumpTo,
  };
}
