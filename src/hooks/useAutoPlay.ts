import { useState, useEffect, useCallback, useRef } from 'react';
import { GhareebWord } from '@/types/quran';
import { useSettingsStore } from '@/stores/settingsStore';

interface UseAutoPlayProps {
  words: GhareebWord[];
  currentWordIndex: number;
  setCurrentWordIndex: (index: number) => void;
  onPageEnd?: () => void;
  /** Called when a new page loads while playing - used to restart auto-play */
  onPageStart?: () => void;
}

export function useAutoPlay({
  words,
  currentWordIndex,
  setCurrentWordIndex,
  onPageEnd,
  onPageStart,
}: UseAutoPlayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // seconds per word
  const thinkingGap = 800; // 0.8s gap before showing meaning
  const pageRepeatCount = useSettingsStore(s => s.settings.autoplay.pageRepeatCount) || 1;
  const repeatCountRef = useRef(0);
  
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

  // Scroll active word into view (skip if inside a fixed-canvas container)
  const scrollToActiveWord = useCallback((index: number) => {
    const wordEl = document.querySelector(`[data-ghareeb-index="${index}"]`);
    if (wordEl) {
      // Don't scroll if the word is inside a fixed mushaf page (lines15/auto15)
      const inFixedPage = wordEl.closest('.mushafPage, .mushafPageAuto15');
      if (inFixedPage) return;
      wordEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, []);

  // Schedule next word using setTimeout chain - NEVER stops on missing meaning
  const scheduleNext = useCallback(() => {
    // Double-check we're still playing
    if (!isPlayingRef.current) {
      console.log('[autoplay] Not playing, stopping schedule');
      return;
    }

    const delayMs = speedRef.current * 1000;
    const currentIdx = currentIndexRef.current;
    const total = wordsRef.current.length;

    console.log('[autoplay] ⏱️ Scheduling next step:', {
      currentIndex: currentIdx,
      totalWords: total,
      delayMs,
    });

    // Clear any existing timer before setting new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      // Re-check playing state inside timeout
      if (!isPlayingRef.current) {
        console.log('[autoplay] Stopped during timeout, aborting');
        return;
      }

      const nextIdx = currentIndexRef.current + 1;
      const totalWords = wordsRef.current.length;
      const currentWord = wordsRef.current[currentIndexRef.current];
      const hasMeaning = currentWord?.meaning?.trim();

      console.log('[autoplay] ➡️ Advancing:', {
        from: currentIndexRef.current,
        to: nextIdx,
        total: totalWords,
        word: currentWord?.wordText || 'N/A',
        key: currentWord?.uniqueKey || 'N/A',
        meaning: hasMeaning ? 'found' : 'لا يوجد معنى (continuing)',
      });

      if (nextIdx < totalWords) {
        // Advance to next word
        setCurrentWordIndex(nextIdx);
        currentIndexRef.current = nextIdx;
        // Scroll to new word
        scrollToActiveWord(nextIdx);
        // Schedule the next step - ALWAYS continue
        scheduleNext();
      } else {
        // Reached end of page - check repeat
        repeatCountRef.current += 1;
        if (repeatCountRef.current < pageRepeatCount) {
          // Restart from beginning
          console.log('[autoplay] 🔁 Repeating page, round', repeatCountRef.current + 1, 'of', pageRepeatCount);
          setCurrentWordIndex(0);
          currentIndexRef.current = 0;
          scrollToActiveWord(0);
          scheduleNext();
        } else {
          // Done with all repeats
          console.log('[autoplay] ✅ Finished all', totalWords, 'words ×', pageRepeatCount, 'repeats');
          repeatCountRef.current = 0;
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (onPageEnd) {
            const advanceDelay = (useSettingsStore.getState().settings.autoplay.autoAdvanceDelay || 1.5) * 1000;
            timeoutRef.current = setTimeout(() => {
              onPageEnd();
            }, advanceDelay);
          }
        }
      }
    }, delayMs);
  }, [setCurrentWordIndex, onPageEnd, scrollToActiveWord]);

  const play = useCallback(() => {
    // IGNORE if already playing - prevent double timers
    if (isPlayingRef.current) {
      console.log('[autoplay] Already playing, ignoring play request');
      return;
    }

    if (wordsRef.current.length === 0) {
      console.log('[autoplay] No words to play');
      return;
    }

    clearTimer();
    
    // Always start from beginning
    console.log('[autoplay] ▶️ Starting playback, total words:', wordsRef.current.length, '× repeats:', pageRepeatCount);
    repeatCountRef.current = 0;
    setCurrentWordIndex(0);
    currentIndexRef.current = 0;
    setIsPlaying(true);
    isPlayingRef.current = true;

    // Log first word with meaning status
    const firstWord = wordsRef.current[0];
    const hasMeaning = firstWord?.meaning?.trim();
    console.log('[autoplay] First word:', {
      index: 0,
      text: firstWord?.wordText,
      key: firstWord?.uniqueKey,
      meaning: hasMeaning ? 'found' : 'لا يوجد معنى',
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
    if (words.length === 0) return;
    
    console.log('[autoplay] Page changed while playing, resetting to 0, words:', words.length);
    clearTimer();
    setCurrentWordIndex(0);
    currentIndexRef.current = 0;
    isPlayingRef.current = true;
    scrollToActiveWord(0);
    
    // Notify parent that a new page started (so Tahfeez can reset quiz state)
    onPageStart?.();

    // Small delay to ensure DOM is updated with new words before scheduling
    const t = setTimeout(() => {
      if (isPlayingRef.current) {
        scheduleNext();
      }
    }, 400);
    return () => clearTimeout(t);
  }, [words, isPlaying, clearTimer, setCurrentWordIndex, scheduleNext, scrollToActiveWord, onPageStart]);

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
