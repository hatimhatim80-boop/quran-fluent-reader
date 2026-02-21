import { useState, useEffect, useCallback, useRef } from 'react';
import { GhareebWord } from '@/types/quran';
import { useSettingsStore } from '@/stores/settingsStore';

// ─────────────────────────────────────────────────────────────────────────────
// Debug log helper — always writes a structured console group
// ─────────────────────────────────────────────────────────────────────────────
export interface AutoPlayDebugState {
  portal: string;
  currentPage: number;
  itemsCount: number;
  index: number;
  endDetected: boolean;
  goNextCalled: boolean;
  autoPlayBefore: boolean;
  autoPlayAfter: boolean;
}

// Global debug state — updated every advance() call so any subscriber can read it.
// QuranReader and Tahfeez expose this via their debug panels.
let _debugState: AutoPlayDebugState = {
  portal: '?', currentPage: 0, itemsCount: 0, index: 0,
  endDetected: false, goNextCalled: false, autoPlayBefore: false, autoPlayAfter: false,
};
let _debugListeners: Array<(s: AutoPlayDebugState) => void> = [];

export function subscribeAutoPlayDebug(fn: (s: AutoPlayDebugState) => void) {
  _debugListeners.push(fn);
  return () => { _debugListeners = _debugListeners.filter(l => l !== fn); };
}

function emitDebug(patch: Partial<AutoPlayDebugState>) {
  _debugState = { ..._debugState, ...patch };
  console.log('[autoplay][debug]', JSON.stringify(_debugState));
  _debugListeners.forEach(l => l(_debugState));
}

// ─────────────────────────────────────────────────────────────────────────────

interface UseAutoPlayProps {
  words: GhareebWord[];
  currentWordIndex: number;
  setCurrentWordIndex: (index: number) => void;
  onPageEnd?: () => void;
  onPageStart?: () => void;
  /** Called when the last word finishes — before deciding to advance page.
   *  If provided, the hook will NOT auto-advance; caller must call goNext() manually. */
  onPageFinished?: () => void;
  /** Portal label shown in debug panel */
  portal?: string;
  /** Current page number for debug panel */
  currentPage?: number;
}

export function useAutoPlay({
  words,
  currentWordIndex,
  setCurrentWordIndex,
  onPageEnd,
  onPageStart,
  onPageFinished,
  portal = '?',
  currentPage = 0,
}: UseAutoPlayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const settingsSpeed = useSettingsStore(s => s.settings.autoplay.speed);
  const setAutoplay = useSettingsStore(s => s.setAutoplay);
  const [speed, _setSpeedLocal] = useState(settingsSpeed); // sync from store

  // Keep local speed in sync with store
  useEffect(() => { _setSpeedLocal(settingsSpeed); }, [settingsSpeed]);

  // setSpeed updates both local state and store
  const setSpeed = useCallback((v: number) => {
    _setSpeedLocal(v);
    setAutoplay({ speed: v });
  }, [setAutoplay]);
  const pageRepeatCount = useSettingsStore(s => s.settings.autoplay.pageRepeatCount) || 1;
  const repeatCountRef = useRef(0);
  const pageRepeatCountRef = useRef(pageRepeatCount);
  useEffect(() => { pageRepeatCountRef.current = pageRepeatCount; }, [pageRepeatCount]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(currentWordIndex);
  const wordsRef = useRef(words);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const onPageEndRef = useRef(onPageEnd);
  const onPageFinishedRef = useRef(onPageFinished);
  // wasAutoPlaying: captures state BEFORE goNextPage() is called so we can restore it.
  const wasAutoPlayingRef = useRef(false);
  // Guard: true while waiting for page transition to complete
  const pageTransitioningRef = useRef(false);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { currentIndexRef.current = currentWordIndex; }, [currentWordIndex]);
  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { onPageEndRef.current = onPageEnd; }, [onPageEnd]);
  useEffect(() => { onPageFinishedRef.current = onPageFinished; }, [onPageFinished]);

  // ── Timer helpers ─────────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const scrollToActiveWord = useCallback((index: number) => {
    const wordEl = document.querySelector(`[data-ghareeb-index="${index}"]`);
    if (wordEl) {
      const inFixedPage = wordEl.closest('.mushafPage, .mushafPageAuto15');
      if (inFixedPage) return;
      wordEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, []);

  // ── CORE: advance() ────────────────────────────────────────────────────────
  // Single function responsible for all advancement decisions.
  // Rules:
  //   1. isEndOfPage = (nextIdx >= total) OR total === 0
  //   2. If isEndOfPage → call goNextPage() immediately (no scroll dependency)
  //   3. Otherwise → advance index and schedule next
  const advance = useCallback(() => {
    if (!isPlayingRef.current) return;

    const currentIdx = currentIndexRef.current;
    const total = wordsRef.current.length;

    // ── Fallback: if no words at all on this page, go to next immediately ──
    if (total === 0) {
      emitDebug({
        portal, currentPage, itemsCount: 0, index: currentIdx,
        endDetected: true, goNextCalled: true,
        autoPlayBefore: true, autoPlayAfter: true,
      });
      console.log('[autoplay][advance] total===0 fallback → goNextPage');
      wasAutoPlayingRef.current = true;
      pageTransitioningRef.current = true;
      clearTimer();
      const fn = onPageEndRef.current;
      if (fn) fn();
      return;
    }

    const nextIdx = currentIdx + 1;
    const isEndOfPage = nextIdx >= total;

    emitDebug({
      portal, currentPage, itemsCount: total, index: currentIdx,
      endDetected: isEndOfPage,
      goNextCalled: false,          // will be updated below if needed
      autoPlayBefore: isPlayingRef.current,
      autoPlayAfter: isPlayingRef.current,
    });

    if (isEndOfPage) {
      // ── End of page ──────────────────────────────────────────────────────
      repeatCountRef.current += 1;
      const repeatLimit = pageRepeatCountRef.current;

      if (repeatCountRef.current < repeatLimit) {
        // Repeat current page
        console.log('[autoplay][advance] Repeating page, round', repeatCountRef.current + 1, '/', repeatLimit);
        const repeatDelay = speedRef.current * 1000;
        timeoutRef.current = setTimeout(() => {
          if (!isPlayingRef.current) return;
          setCurrentWordIndex(0);
          currentIndexRef.current = 0;
          scrollToActiveWord(0);
          scheduleNext();
        }, repeatDelay);
      } else {
        // All repeats done
        repeatCountRef.current = 0;
        const lastWordDuration = speedRef.current * 1000;

        emitDebug({ endDetected: true, goNextCalled: false, autoPlayBefore: true });

        // If onPageFinished is provided → pause and show banner (manual control)
        if (onPageFinishedRef.current) {
          console.log('[autoplay][advance] End of page → calling onPageFinished (banner mode)');
          timeoutRef.current = setTimeout(() => {
            // Pause playing state so no timers continue
            setIsPlaying(false);
            isPlayingRef.current = false;
            clearTimer();
            onPageFinishedRef.current?.();
          }, lastWordDuration);
        } else {
          // Auto-advance mode
          const advanceDelay = (useSettingsStore.getState().settings.autoplay.autoAdvanceDelay || 1.5) * 1000;
          console.log('[autoplay][advance] End of page. Calling goNextPage in', lastWordDuration + advanceDelay, 'ms');
          wasAutoPlayingRef.current = true;
          pageTransitioningRef.current = true;

          emitDebug({ endDetected: true, goNextCalled: true, autoPlayBefore: true });

          timeoutRef.current = setTimeout(() => {
            if (!isPlayingRef.current) { pageTransitioningRef.current = false; return; }
            timeoutRef.current = setTimeout(() => {
              if (!isPlayingRef.current) { pageTransitioningRef.current = false; return; }
              const fn = onPageEndRef.current;
              console.log('[autoplay][advance] goNextPage() called, fn:', !!fn);
              if (fn) fn();
            }, advanceDelay);
          }, lastWordDuration);
        }
      }
    } else {
      // ── Normal advance ───────────────────────────────────────────────────
      setCurrentWordIndex(nextIdx);
      currentIndexRef.current = nextIdx;
      scrollToActiveWord(nextIdx);
      scheduleNext();
    }
  // scheduleNext is declared below — both are stable (no external deps change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimer, scrollToActiveWord, setCurrentWordIndex, portal, currentPage]);

  // scheduleNext: wait `speed` seconds then call advance()
  const scheduleNext = useCallback(() => {
    if (!isPlayingRef.current) return;
    clearTimer();
    const delayMs = speedRef.current * 1000;
    timeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return;
      advance();
    }, delayMs);
  }, [clearTimer, advance]);

  // ── Play / Pause / Stop ────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    if (wordsRef.current.length === 0) {
      // Fallback: no words → try to advance page
      console.log('[autoplay][play] No words, calling onPageEnd fallback');
      wasAutoPlayingRef.current = true;
      const fn = onPageEndRef.current;
      if (fn) fn();
      return;
    }
    clearTimer();
    repeatCountRef.current = 0;
    setCurrentWordIndex(0);
    currentIndexRef.current = 0;
    setIsPlaying(true);
    isPlayingRef.current = true;
    wasAutoPlayingRef.current = false;
    scrollToActiveWord(0);
    scheduleNext();
  }, [clearTimer, setCurrentWordIndex, scheduleNext, scrollToActiveWord]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    wasAutoPlayingRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (wordsRef.current.length === 0) return;
    setIsPlaying(true);
    isPlayingRef.current = true;
    scheduleNext();
  }, [scheduleNext]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    wasAutoPlayingRef.current = false;
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
      if (isPlayingRef.current) { clearTimer(); scheduleNext(); }
    }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  const prevWord = useCallback(() => {
    if (currentIndexRef.current > 0) {
      const prevIdx = currentIndexRef.current - 1;
      setCurrentWordIndex(prevIdx);
      currentIndexRef.current = prevIdx;
      if (isPlayingRef.current) { clearTimer(); scheduleNext(); }
    }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  const jumpTo = useCallback((index: number) => {
    if (index < 0 || index >= wordsRef.current.length) return;
    setCurrentWordIndex(index);
    currentIndexRef.current = index;
    if (isPlayingRef.current) { clearTimer(); scheduleNext(); }
  }, [setCurrentWordIndex, clearTimer, scheduleNext]);

  // ── WORDS CHANGE EFFECT ────────────────────────────────────────────────────
  // Fires every time `words` reference changes (i.e., page transition completed).
  // If autoplay was active (wasAutoPlayingRef OR isPlayingRef), resume from index 0.
  // NEVER sets isPlaying=false here.
  useEffect(() => {
    const shouldResume = wasAutoPlayingRef.current || isPlayingRef.current;

    if (!shouldResume) return;

    // Empty words = page is still loading. Clear timers and wait for next update.
    if (words.length === 0) {
      clearTimer();
      console.log('[autoplay][words] empty — waiting for page load…');
      return;
    }

    // New page data is ready → cancel any stale timers
    clearTimer();
    pageTransitioningRef.current = false;

    console.log('[autoplay][words] new page ready, count:', words.length, 'wasAutoPlaying:', wasAutoPlayingRef.current);

    repeatCountRef.current = 0;

    // Ensure playing state is true (it may have been preserved in ref but not state)
    if (!isPlayingRef.current) {
      setIsPlaying(true);
      isPlayingRef.current = true;
    }

    onPageStart?.();

    // Delay to let DOM settle after page render, then start from index 0
    const t = setTimeout(() => {
      if (!isPlayingRef.current && !wasAutoPlayingRef.current) return;
      if (wordsRef.current.length === 0) {
        console.log('[autoplay][words] still empty after settle, calling goNextPage fallback');
        const fn = onPageEndRef.current;
        if (fn) fn();
        return;
      }
      wasAutoPlayingRef.current = false;
      wordsRef.current = words;
      currentIndexRef.current = 0;
      setCurrentWordIndex(0);
      scrollToActiveWord(0);

      emitDebug({
        portal, currentPage, itemsCount: words.length, index: 0,
        endDetected: false, goNextCalled: false,
        autoPlayBefore: true, autoPlayAfter: true,
      });

      console.log('[autoplay][words] ▶️ Resuming on new page, words:', wordsRef.current.length);
      scheduleNext();
    }, 500);
    return () => clearTimeout(t);
  // Only run when `words` reference changes (page transition).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  // Cleanup on unmount
  useEffect(() => { return () => clearTimer(); }, [clearTimer]);

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
