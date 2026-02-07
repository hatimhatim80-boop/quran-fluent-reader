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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (words.length === 0) return;
    
    setIsPlaying(true);
    
    // If at the end or not started, start from beginning
    if (currentWordIndex === -1 || currentWordIndex >= words.length - 1) {
      setCurrentWordIndex(0);
    }
  }, [words.length, currentWordIndex, setCurrentWordIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
    setCurrentWordIndex(-1);
  }, [clearTimer, setCurrentWordIndex]);

  const nextWord = useCallback(() => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
    } else {
      pause();
      onPageEnd?.();
    }
  }, [currentWordIndex, words.length, setCurrentWordIndex, pause, onPageEnd]);

  const prevWord = useCallback(() => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1);
    }
  }, [currentWordIndex, setCurrentWordIndex]);

  // Auto-advance effect
  useEffect(() => {
    if (isPlaying && words.length > 0) {
      clearTimer();
      intervalRef.current = setInterval(() => {
        nextWord();
      }, speed * 1000);
    }

    return clearTimer;
  }, [isPlaying, speed, words.length, nextWord, clearTimer]);

  // Stop playing when words change (page change)
  useEffect(() => {
    if (isPlaying) {
      setCurrentWordIndex(0);
    }
  }, [words]);

  return {
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
  };
}
