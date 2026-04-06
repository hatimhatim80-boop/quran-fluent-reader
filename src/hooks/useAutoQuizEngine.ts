/**
 * useAutoQuizEngine — Unified auto-quiz session engine.
 *
 * Architecture (v3 — Stopwatch-based Time Engine):
 *
 *   The session timer is a real stopwatch driven by performance.now().
 *
 *   remaining = plannedTotalMs − realElapsedMs
 *
 *   realElapsedMs = elapsedBeforePause + (performance.now() − runAnchor)
 *
 *   Pause captures elapsed. Resume sets a new anchor.
 *   Speed change recalculates plannedTotalMs:
 *     newPlannedTotal = realElapsed + (unconsumedItems × newDuration)
 *
 *   Item-level scheduling uses setTimeout with a single itemExpectedEnd
 *   timestamp for millisecond-accurate reveal timing.
 *
 *   currentItemRemainingMs = itemExpectedEnd − performance.now()
 *   sessionRemainingMs = plannedTotalMs − realElapsedMs
 *
 *   A RAF loop ticks the UI display from these derived values.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ─── */

export type EnginePhase = 'idle' | 'running' | 'paused' | 'completed';

/** Per-page schedule: exact durations + consumption tracking */
export interface PageSchedule {
  /** Duration in ms for each item on this page (in reveal order) */
  durations: number[];
  /** How many items have been consumed (revealed) from the front */
  consumed: number;
}

export interface EnginePageState {
  revealedKeys: string[];
  blankedKeysList: string[];
  showAll: boolean;
  currentRevealIdx: number;
  activeBlankKey: string | null;
  scrollTop: number;
  savedAt: number;
  /** Remaining ms on the active item when this page was saved */
  currentItemRemainingMs: number;
  /** Number of items consumed on this page at save time */
  pageConsumed: number;
}

export interface EngineSnapshot {
  phase: EnginePhase;
  currentPage: number;
  sessionRemainingMs: number;
  currentItemRemainingMs: number;
  currentRevealIdx: number;
  activeBlankKey: string | null;
  revealedKeys: string[];
  blankedKeysList: string[];
  showAll: boolean;
  pageStates: Record<number, EnginePageState>;
  /** Per-page schedules for exact duration tracking */
  pageSchedules: Record<number, PageSchedule>;
  /** Pages in session order */
  sessionPages: number[];
  /** Item counts for pages without exact durations yet */
  unregisteredPages: Record<number, number>;
  /** Default per-item ms for unregistered pages */
  defaultItemMs: number;
  /** Stopwatch: planned total ms */
  plannedTotalMs: number;
  /** Stopwatch: real elapsed ms at snapshot time */
  realElapsedMs: number;
}

export type SpeedChangeActiveItemPolicy = 'preserve-remaining' | 'scale-remaining';

interface SetSpeedOptions {
  getDuration?: (page: number, itemIdx: number) => number;
  activeItemPolicy?: SpeedChangeActiveItemPolicy;
  onCurrentItemExpire?: () => void;
}

/* ─── Hook ─── */

export function useAutoQuizEngine() {
  // ── Core state ──
  const [phase, setPhase] = useState<EnginePhase>('idle');
  const [sessionRemainingMs, setSessionRemainingMs] = useState(0);
  const [currentItemRemainingMs, setCurrentItemRemainingMs] = useState(0);

  // ── Refs ──
  const phaseRef = useRef<EnginePhase>('idle');

  // ── Stopwatch refs ──
  /** performance.now() anchor for current running segment */
  const runAnchorRef = useRef<number>(0);
  /** Accumulated elapsed ms from previous run segments (before pause) */
  const elapsedBeforePauseRef = useRef<number>(0);
  /** Total planned session duration in ms */
  const plannedTotalMsRef = useRef<number>(0);

  // Item-level timer
  const itemExpectedEndRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentItemRemainingRef = useRef(0);
  const currentItemExpireCallbackRef = useRef<(() => void) | null>(null);

  // Per-page schedules: exact durations for each item
  const pageSchedulesRef = useRef<Record<number, PageSchedule>>({});

  // Pages without exact durations yet (item count only)
  const unregisteredPagesRef = useRef<Record<number, number>>({});

  // Default per-item ms (for unregistered pages)
  const defaultItemMsRef = useRef(2000);

  // Session pages in order
  const sessionPagesRef = useRef<number[]>([]);

  // Current page
  const currentPageRef = useRef(0);

  // Per-page visual states
  const pageStatesRef = useRef<Record<number, EnginePageState>>({});

  // RAF
  const rafRef = useRef<number | null>(null);

  const setCurrentItemRemainingValue = useCallback((ms: number) => {
    const normalized = Math.max(0, ms);
    currentItemRemainingRef.current = normalized;
    setCurrentItemRemainingMs(normalized);
  }, []);

  // ── Real elapsed computation ──
  const getRealElapsedMs = useCallback((): number => {
    if (phaseRef.current === 'running') {
      return elapsedBeforePauseRef.current + (performance.now() - runAnchorRef.current);
    }
    return elapsedBeforePauseRef.current;
  }, []);

  // ── Session remaining = plannedTotal - realElapsed ──
  const getSessionRemainingMs = useCallback((): number => {
    return Math.max(0, plannedTotalMsRef.current - getRealElapsedMs());
  }, [getRealElapsedMs]);

  // ── Current item remaining from its expected end ──
  const getCurrentItemRemainingMs = useCallback((): number => {
    if (itemExpectedEndRef.current !== null) {
      return Math.max(0, itemExpectedEndRef.current - performance.now());
    }
    return Math.max(0, currentItemRemainingRef.current);
  }, []);

  // ── Compute planned total from schedules (used at init / speed change) ──
  const computePlannedTotal = useCallback((): number => {
    let total = 0;
    const pages = sessionPagesRef.current.length > 0
      ? sessionPagesRef.current
      : Object.keys(pageSchedulesRef.current).map(Number);

    for (const page of pages) {
      const sched = pageSchedulesRef.current[page];
      if (sched) {
        for (let i = 0; i < sched.durations.length; i++) {
          total += sched.durations[i];
        }
      }
    }

    // Add estimates for unregistered pages
    for (const pageStr of Object.keys(unregisteredPagesRef.current)) {
      total += unregisteredPagesRef.current[Number(pageStr)] * defaultItemMsRef.current;
    }

    return total;
  }, []);

  // ── Compute remaining for unconsumed items (used for speed change recalc) ──
  const computeUnconsumedMs = useCallback((): number => {
    let total = 0;
    const pages = sessionPagesRef.current.length > 0
      ? sessionPagesRef.current
      : Object.keys(pageSchedulesRef.current).map(Number);

    for (const page of pages) {
      const sched = pageSchedulesRef.current[page];
      if (!sched) continue;
      // Only unconsumed items (not including the currently active one)
      const startIdx = sched.consumed;
      for (let i = startIdx; i < sched.durations.length; i++) {
        total += sched.durations[i];
      }
    }

    // Add estimates for unregistered pages
    for (const pageStr of Object.keys(unregisteredPagesRef.current)) {
      total += unregisteredPagesRef.current[Number(pageStr)] * defaultItemMsRef.current;
    }

    return total;
  }, []);

  // ── RAF tick loop ──
  const tick = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const remaining = getSessionRemainingMs();
    setSessionRemainingMs(remaining);
    setCurrentItemRemainingValue(getCurrentItemRemainingMs());
    if (remaining > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setSessionRemainingMs(0);
      setCurrentItemRemainingValue(0);
    }
  }, [getSessionRemainingMs, getCurrentItemRemainingMs, setCurrentItemRemainingValue]);

  const startRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const armItemTimer = useCallback((durationMs: number, onExpire?: () => void) => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }

    if (onExpire) {
      currentItemExpireCallbackRef.current = onExpire;
    }

    itemExpectedEndRef.current = performance.now() + durationMs;
    setCurrentItemRemainingValue(durationMs);

    const callback = currentItemExpireCallbackRef.current;
    revealTimeoutRef.current = callback
      ? setTimeout(() => {
          revealTimeoutRef.current = null;
          itemExpectedEndRef.current = null;
          const expire = currentItemExpireCallbackRef.current;
          currentItemExpireCallbackRef.current = null;
          expire?.();
        }, durationMs)
      : null;
  }, [setCurrentItemRemainingValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRaf();
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [stopRaf]);

  // ── Item timer management ──
  const pauseItemTimer = useCallback((): number => {
    const remaining = getCurrentItemRemainingMs();
    itemExpectedEndRef.current = null;
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    setCurrentItemRemainingValue(remaining);
    return remaining;
  }, [getCurrentItemRemainingMs, setCurrentItemRemainingValue]);

  // ── Public API ──

  /**
   * Initialize a new session.
   */
  const initSession = useCallback((
    sessionPages: number[],
    perPageItemCounts: Record<number, number>,
    defaultItemMs: number,
    startPage: number,
  ) => {
    // All pages start as unregistered
    const unreg: Record<number, number> = {};
    for (const p of sessionPages) {
      unreg[p] = perPageItemCounts[p] || 0;
    }

    pageSchedulesRef.current = {};
    unregisteredPagesRef.current = unreg;
    defaultItemMsRef.current = defaultItemMs;
    sessionPagesRef.current = sessionPages;
    currentPageRef.current = startPage;
    pageStatesRef.current = {};
    itemExpectedEndRef.current = null;
    currentItemRemainingRef.current = 0;

    // Compute planned total
    let totalMs = 0;
    for (const p of sessionPages) {
      totalMs += (perPageItemCounts[p] || 0) * defaultItemMs;
    }
    plannedTotalMsRef.current = totalMs;

    // Reset stopwatch
    elapsedBeforePauseRef.current = 0;
    runAnchorRef.current = performance.now();

    setSessionRemainingMs(totalMs);
    setCurrentItemRemainingValue(0);
    setPhase('running');
    phaseRef.current = 'running';
    startRaf();
  }, [setCurrentItemRemainingValue, startRaf]);

  /**
   * Register exact per-item durations for a page.
   * Replaces any estimate for this page with exact data.
   */
  const registerPageDurations = useCallback((
    page: number,
    durations: number[],
    alreadyConsumed: number = 0,
  ) => {
    const hadEstimate = page in unregisteredPagesRef.current;
    const oldEstimate = hadEstimate
      ? (unregisteredPagesRef.current[page] || 0) * defaultItemMsRef.current
      : 0;

    // Store exact schedule
    pageSchedulesRef.current[page] = {
      durations,
      consumed: alreadyConsumed,
    };

    // Remove from unregistered
    if (hadEstimate) {
      delete unregisteredPagesRef.current[page];
    }

    // Adjust plannedTotal: remove old estimate, add exact total
    const exactTotal = durations.reduce((a, b) => a + b, 0);
    if (hadEstimate) {
      plannedTotalMsRef.current = plannedTotalMsRef.current - oldEstimate + exactTotal;
    }

    // Immediate UI update
    setSessionRemainingMs(getSessionRemainingMs());
  }, [getSessionRemainingMs]);

  /**
   * Record that items were consumed (revealed) on the current page.
   */
  const recordProcessed = useCallback((count: number = 1) => {
    const page = currentPageRef.current;
    const sched = pageSchedulesRef.current[page];
    if (sched) {
      sched.consumed = Math.min(sched.consumed + count, sched.durations.length);
    }
    itemExpectedEndRef.current = null;
    setCurrentItemRemainingValue(0);
    if (pageStatesRef.current[page]) {
      pageStatesRef.current[page].currentItemRemainingMs = 0;
      pageStatesRef.current[page].pageConsumed = sched ? sched.consumed : 0;
    }
    setSessionRemainingMs(getSessionRemainingMs());
  }, [getSessionRemainingMs, setCurrentItemRemainingValue]);

  /**
   * Schedule a timer for the current item and call onExpire when it finishes.
   */
  const scheduleItem = useCallback((durationMs: number, onExpire: () => void) => {
    armItemTimer(durationMs, onExpire);
  }, [armItemTimer]);

  /**
   * Change speed: recalculate plannedTotalMs = realElapsed + unconsumedItems × newDuration
   * + currentItemRemaining (scaled or preserved).
   */
  const setSpeed = useCallback((
    newDefaultMs: number,
    options: SetSpeedOptions = {},
  ) => {
    const {
      getDuration,
      activeItemPolicy = 'scale-remaining',
      onCurrentItemExpire,
    } = options;
    const oldDefaultMs = defaultItemMsRef.current;
    const activePage = currentPageRef.current;
    const activeSchedule = pageSchedulesRef.current[activePage];
    const activeIndex = activeSchedule?.consumed ?? 0;
    const oldCurrentRemaining = getCurrentItemRemainingMs();
    const oldCurrentDuration = activeSchedule && activeIndex < activeSchedule.durations.length
      ? activeSchedule.durations[activeIndex]
      : oldDefaultMs;

    defaultItemMsRef.current = newDefaultMs;

    // Rebuild all page schedules with new durations
    if (getDuration) {
      for (const pageStr of Object.keys(pageSchedulesRef.current)) {
        const page = Number(pageStr);
        const sched = pageSchedulesRef.current[page];
        sched.durations = sched.durations.map((_, i) => getDuration(page, i));
      }
    } else {
      const ratio = oldDefaultMs > 0 ? newDefaultMs / oldDefaultMs : 1;
      for (const pageStr of Object.keys(pageSchedulesRef.current)) {
        const sched = pageSchedulesRef.current[Number(pageStr)];
        sched.durations = sched.durations.map(d => Math.round(d * ratio));
      }
    }

    // Handle active item reschedule
    const hasCurrentPartial = oldCurrentRemaining > 0
      && !!activeSchedule
      && activeIndex < activeSchedule.durations.length;

    let activeItemNewRemaining = 0;

    if (hasCurrentPartial && activeSchedule) {
      const newCurrentDuration = activeSchedule.durations[activeIndex] ?? newDefaultMs;
      activeItemNewRemaining = activeItemPolicy === 'preserve-remaining' || oldCurrentDuration <= 0
        ? oldCurrentRemaining
        : Math.round(newCurrentDuration * Math.max(0, Math.min(1, oldCurrentRemaining / oldCurrentDuration)));

      if (onCurrentItemExpire) {
        currentItemExpireCallbackRef.current = onCurrentItemExpire;
      }

      if (phaseRef.current === 'running') {
        armItemTimer(activeItemNewRemaining, currentItemExpireCallbackRef.current ?? undefined);
      } else {
        itemExpectedEndRef.current = null;
        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current);
          revealTimeoutRef.current = null;
        }
        setCurrentItemRemainingValue(activeItemNewRemaining);
      }

      if (pageStatesRef.current[activePage]) {
        pageStatesRef.current[activePage].currentItemRemainingMs = activeItemNewRemaining;
      }
    }

    // Recalculate plannedTotal = realElapsed + activeItemRemaining + unconsumedFutureItems
    const elapsed = getRealElapsedMs();

    // Sum all unconsumed items AFTER the active one
    let futureMs = 0;
    const pages = sessionPagesRef.current.length > 0
      ? sessionPagesRef.current
      : Object.keys(pageSchedulesRef.current).map(Number);

    for (const page of pages) {
      const sched = pageSchedulesRef.current[page];
      if (!sched) continue;
      const startIdx = page === activePage
        ? sched.consumed + (hasCurrentPartial ? 1 : 0)
        : sched.consumed;
      for (let i = startIdx; i < sched.durations.length; i++) {
        futureMs += sched.durations[i];
      }
    }

    // Add unregistered page estimates
    for (const pageStr of Object.keys(unregisteredPagesRef.current)) {
      futureMs += unregisteredPagesRef.current[Number(pageStr)] * newDefaultMs;
    }

    plannedTotalMsRef.current = elapsed + activeItemNewRemaining + futureMs;

    // Immediate UI update
    setSessionRemainingMs(getSessionRemainingMs());
  }, [getCurrentItemRemainingMs, getRealElapsedMs, getSessionRemainingMs, setCurrentItemRemainingValue]);

  /** Pause the engine */
  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    // Capture real elapsed
    elapsedBeforePauseRef.current = getRealElapsedMs();

    const itemRemaining = pauseItemTimer();
    stopRaf();

    if (pageStatesRef.current[currentPageRef.current]) {
      pageStatesRef.current[currentPageRef.current].currentItemRemainingMs = itemRemaining;
    }

    setSessionRemainingMs(getSessionRemainingMs());
    setPhase('paused');
    phaseRef.current = 'paused';
  }, [getRealElapsedMs, getSessionRemainingMs, pauseItemTimer, stopRaf]);

  /** Resume from pause */
  const resume = useCallback((): number => {
    if (phaseRef.current !== 'paused') return 0;

    // Set new anchor, keep accumulated elapsed
    runAnchorRef.current = performance.now();

    setPhase('running');
    phaseRef.current = 'running';

    const remaining = Math.max(0, currentItemRemainingRef.current);
    if (remaining > 0) {
      if (currentItemExpireCallbackRef.current) {
        armItemTimer(remaining);
      } else {
        itemExpectedEndRef.current = performance.now() + remaining;
        setCurrentItemRemainingValue(remaining);
      }
    }
    startRaf();
    return remaining;
  }, [armItemTimer, setCurrentItemRemainingValue, startRaf]);

  /** Mark session as completed */
  const complete = useCallback(() => {
    // Freeze elapsed
    elapsedBeforePauseRef.current = getRealElapsedMs();
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;
    setSessionRemainingMs(0);
    setCurrentItemRemainingValue(0);
    setPhase('completed');
    phaseRef.current = 'completed';
  }, [getRealElapsedMs, setCurrentItemRemainingValue, stopRaf]);

  /** Save current page's visual state */
  const saveCurrentPageState = useCallback((page: number, state: Omit<EnginePageState, 'savedAt' | 'currentItemRemainingMs' | 'pageConsumed'>) => {
    const sched = pageSchedulesRef.current[page];
    const itemRemaining = getCurrentItemRemainingMs();
    pageStatesRef.current[page] = {
      ...state,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: sched ? sched.consumed : 0,
    };
    currentPageRef.current = page;
  }, [getCurrentItemRemainingMs]);

  /** Get saved state for a page */
  const getPageState = useCallback((page: number): EnginePageState | null => {
    return pageStatesRef.current[page] || null;
  }, []);

  /** Navigate to a new page */
  const navigateToPage = useCallback((
    oldPage: number,
    newPage: number,
    oldPageState: Omit<EnginePageState, 'savedAt' | 'currentItemRemainingMs' | 'pageConsumed'>,
  ): EnginePageState | null => {
    const itemRemaining = getCurrentItemRemainingMs();

    // Stop current item timer
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;

    // Save old page state
    const oldSched = pageSchedulesRef.current[oldPage];
    pageStatesRef.current[oldPage] = {
      ...oldPageState,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: oldSched ? oldSched.consumed : 0,
    };
    currentPageRef.current = newPage;

    const newPageState = pageStatesRef.current[newPage];
    const storedRemaining = Math.max(0, newPageState?.currentItemRemainingMs || 0);
    setCurrentItemRemainingValue(storedRemaining);

    setSessionRemainingMs(getSessionRemainingMs());

    return newPageState || null;
  }, [getCurrentItemRemainingMs, getSessionRemainingMs, setCurrentItemRemainingValue]);

  /** Reset current page */
  const resetPage = useCallback((page: number) => {
    const sched = pageSchedulesRef.current[page];
    if (sched) {
      sched.consumed = 0;
    }

    delete pageStatesRef.current[page];

    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;
    setCurrentItemRemainingValue(0);

    setSessionRemainingMs(getSessionRemainingMs());
  }, [getSessionRemainingMs, setCurrentItemRemainingValue]);

  /** Reset entire session */
  const resetSession = useCallback((
    sessionPages: number[],
    perPageItemCounts: Record<number, number>,
    defaultItemMs: number,
    startPage: number,
  ) => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;

    const unreg: Record<number, number> = {};
    for (const p of sessionPages) {
      unreg[p] = perPageItemCounts[p] || 0;
    }

    pageSchedulesRef.current = {};
    unregisteredPagesRef.current = unreg;
    defaultItemMsRef.current = defaultItemMs;
    sessionPagesRef.current = sessionPages;
    currentPageRef.current = startPage;
    pageStatesRef.current = {};
    currentItemRemainingRef.current = 0;

    let totalMs = 0;
    for (const p of sessionPages) {
      totalMs += (perPageItemCounts[p] || 0) * defaultItemMs;
    }

    plannedTotalMsRef.current = totalMs;
    elapsedBeforePauseRef.current = 0;
    runAnchorRef.current = performance.now();

    setSessionRemainingMs(totalMs);
    setCurrentItemRemainingValue(0);
    setPhase('running');
    phaseRef.current = 'running';
    startRaf();
  }, [setCurrentItemRemainingValue, stopRaf, startRaf]);

  /** Snapshot for persistence */
  const snapshot = useCallback((
    page: number,
    currentVisualState: Omit<EnginePageState, 'savedAt' | 'currentItemRemainingMs' | 'pageConsumed'>,
  ): EngineSnapshot => {
    const itemRemaining = getCurrentItemRemainingMs();
    const realElapsed = getRealElapsedMs();

    const sched = pageSchedulesRef.current[page];
    pageStatesRef.current[page] = {
      ...currentVisualState,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: sched ? sched.consumed : 0,
    };

    const remaining = getSessionRemainingMs();

    return {
      phase: phaseRef.current,
      currentPage: page,
      sessionRemainingMs: remaining,
      currentItemRemainingMs: itemRemaining,
      currentRevealIdx: currentVisualState.currentRevealIdx,
      activeBlankKey: currentVisualState.activeBlankKey,
      revealedKeys: currentVisualState.revealedKeys,
      blankedKeysList: currentVisualState.blankedKeysList,
      showAll: currentVisualState.showAll,
      pageStates: JSON.parse(JSON.stringify(pageStatesRef.current)),
      pageSchedules: JSON.parse(JSON.stringify(pageSchedulesRef.current)),
      sessionPages: [...sessionPagesRef.current],
      unregisteredPages: { ...unregisteredPagesRef.current },
      defaultItemMs: defaultItemMsRef.current,
      plannedTotalMs: plannedTotalMsRef.current,
      realElapsedMs: realElapsed,
    };
  }, [getCurrentItemRemainingMs, getRealElapsedMs, getSessionRemainingMs]);

  /** Restore from snapshot */
  const restore = useCallback((snap: EngineSnapshot) => {
    sessionPagesRef.current = snap.sessionPages || [];
    defaultItemMsRef.current = snap.defaultItemMs || 2000;
    currentPageRef.current = snap.currentPage;
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;

    // Restore schedules
    pageSchedulesRef.current = snap.pageSchedules
      ? JSON.parse(JSON.stringify(snap.pageSchedules))
      : {};

    unregisteredPagesRef.current = snap.unregisteredPages
      ? { ...snap.unregisteredPages }
      : {};

    pageStatesRef.current = snap.pageStates
      ? JSON.parse(JSON.stringify(snap.pageStates))
      : {};

    // Restore stopwatch state
    plannedTotalMsRef.current = snap.plannedTotalMs ?? snap.sessionRemainingMs + (snap.realElapsedMs ?? 0);
    elapsedBeforePauseRef.current = snap.realElapsedMs ?? (plannedTotalMsRef.current - snap.sessionRemainingMs);

    const remaining = snap.sessionRemainingMs > 0 ? snap.sessionRemainingMs : 0;
    setSessionRemainingMs(remaining);
    setCurrentItemRemainingValue(
      snap.currentItemRemainingMs
      || snap.pageStates?.[snap.currentPage]?.currentItemRemainingMs
      || 0,
    );

    // Always restore as paused
    const p: EnginePhase = snap.phase === 'completed' ? 'completed' : 'paused';
    setPhase(p);
    phaseRef.current = p;
  }, [setCurrentItemRemainingValue]);

  /** Stop timers (for unmount) without resetting state */
  const stop = useCallback(() => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;
    currentItemExpireCallbackRef.current = null;
    setCurrentItemRemainingValue(0);
  }, [setCurrentItemRemainingValue, stopRaf]);

  /** Get total items across all pages */
  const getTotalItems = useCallback((): number => {
    let total = 0;
    for (const s of Object.values(pageSchedulesRef.current)) {
      total += s.durations.length;
    }
    for (const c of Object.values(unregisteredPagesRef.current)) {
      total += c;
    }
    return total;
  }, []);

  /** Get total processed items across all pages */
  const getProcessedItems = useCallback((): number => {
    let total = 0;
    for (const s of Object.values(pageSchedulesRef.current)) {
      total += s.consumed;
    }
    return total;
  }, []);

  // Legacy compat: computeRemaining as alias
  const computeRemaining = getSessionRemainingMs;

  return {
    // State
    phase,
    sessionRemainingMs,
    currentItemRemainingMs,

    // Refs (for reading in callbacks)
    pageSchedulesRef,
    unregisteredPagesRef,
    pageStatesRef,
    phaseRef,
    defaultItemMsRef,
    sessionPagesRef,

    // Actions
    initSession,
    registerPageDurations,
    setSpeed,
    recordProcessed,
    scheduleItem,
    pause,
    resume,
    complete,
    saveCurrentPageState,
    getPageState,
    navigateToPage,
    resetPage,
    resetSession,
    snapshot,
    restore,
    stop,
    startRaf,
    computeRemaining,
    getTotalItems,
    getProcessedItems,
  };
}
