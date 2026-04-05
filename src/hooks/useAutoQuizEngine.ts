/**
 * useAutoQuizEngine — Unified auto-quiz session engine.
 *
 * Architecture:
 *   The session timer is derived from ACTUAL per-item durations,
 *   not from count × perItemMs estimates.
 *
 *   Each page has a schedule: an array of durations (one per item).
 *   sessionRemainingMs = currentItemRemainingMs
 *                      + sum(unconsumed durations on current page)
 *                      + sum(all durations on future pages)
 *                      + estimate for unregistered pages (itemCount × defaultMs)
 *
 *   When a page's DOM loads and firstKeys are known, exact durations
 *   replace any estimate via registerPageDurations().
 *
 *   A RAF loop ticks the UI display from this derived value.
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
}

/* ─── Hook ─── */

export function useAutoQuizEngine() {
  // ── Core state ──
  const [phase, setPhase] = useState<EnginePhase>('idle');
  const [sessionRemainingMs, setSessionRemainingMs] = useState(0);
  const [currentItemRemainingMs, setCurrentItemRemainingMs] = useState(0);

  // ── Refs ──
  const phaseRef = useRef<EnginePhase>('idle');

  // Item-level timer
  const itemExpectedEndRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const pausedSnapshotRef = useRef<number>(0);

  // ── Compute exact remaining from schedules ──
  const computeRemaining = useCallback((): number => {
    let total = 0;

    // Current item remaining
    if (itemExpectedEndRef.current !== null) {
      total += Math.max(0, itemExpectedEndRef.current - Date.now());
    }

    // Sum unconsumed durations across ALL pages with schedules
    for (const pageStr of Object.keys(pageSchedulesRef.current)) {
      const page = Number(pageStr);
      const sched = pageSchedulesRef.current[page];
      // If this is the current page AND there's an active item timer,
      // skip the first unconsumed duration (it's the current item, already counted above)
      const isCurrentPageWithActiveItem =
        page === currentPageRef.current && itemExpectedEndRef.current !== null;
      const startIdx = sched.consumed + (isCurrentPageWithActiveItem ? 1 : 0);
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
    const ms = computeRemaining();
    setSessionRemainingMs(ms);
    if (itemExpectedEndRef.current !== null) {
      setCurrentItemRemainingMs(Math.max(0, itemExpectedEndRef.current - Date.now()));
    }
    if (ms > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setSessionRemainingMs(0);
    }
  }, [computeRemaining]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRaf();
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [stopRaf]);

  // ── Item timer management ──
  const pauseItemTimer = useCallback((): number => {
    const remaining = itemExpectedEndRef.current !== null
      ? Math.max(0, itemExpectedEndRef.current - Date.now())
      : 0;
    itemExpectedEndRef.current = null;
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    setCurrentItemRemainingMs(remaining);
    return remaining;
  }, []);

  // ── Public API ──

  /**
   * Initialize a new session.
   * @param sessionPages - ordered list of page numbers in the session
   * @param perPageItemCounts - item count per page (from computeSessionTotalItems)
   * @param defaultItemMs - default duration per item (timerSeconds * 1000)
   * @param startPage - first page to show
   */
  const initSession = useCallback((
    sessionPages: number[],
    perPageItemCounts: Record<number, number>,
    defaultItemMs: number,
    startPage: number,
  ) => {
    // All pages start as unregistered (exact durations come from DOM)
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

    // Initial remaining = sum of all items × defaultItemMs
    let totalMs = 0;
    for (const p of sessionPages) {
      totalMs += (perPageItemCounts[p] || 0) * defaultItemMs;
    }

    setSessionRemainingMs(totalMs);
    setCurrentItemRemainingMs(0);
    setPhase('running');
    phaseRef.current = 'running';
    pausedSnapshotRef.current = 0;
    startRaf();
  }, [startRaf]);

  /**
   * Register exact per-item durations for a page.
   * Replaces any estimate for this page with exact data.
   * Call this when the page's DOM loads and firstKeys are known.
   *
   * @param page - page number
   * @param durations - duration in ms for each item (in reveal order)
   * @param alreadyConsumed - items already revealed on this page (for restored pages)
   */
  const registerPageDurations = useCallback((
    page: number,
    durations: number[],
    alreadyConsumed: number = 0,
  ) => {
    const oldSchedule = pageSchedulesRef.current[page];
    const hadEstimate = page in unregisteredPagesRef.current;

    // Store exact schedule
    pageSchedulesRef.current[page] = {
      durations,
      consumed: alreadyConsumed,
    };

    // Remove from unregistered
    if (hadEstimate) {
      delete unregisteredPagesRef.current[page];
    }

    // Recalc remaining (the RAF will pick it up, but immediate update too)
    const ms = computeRemaining();
    setSessionRemainingMs(ms);
  }, [computeRemaining]);

  /**
   * Record that items were consumed (revealed) on the current page.
   * Advances the consumed pointer in the current page's schedule.
   */
  const recordProcessed = useCallback((count: number = 1) => {
    const page = currentPageRef.current;
    const sched = pageSchedulesRef.current[page];
    if (sched) {
      sched.consumed = Math.min(sched.consumed + count, sched.durations.length);
    }
    // Immediate recalc
    setSessionRemainingMs(computeRemaining());
  }, [computeRemaining]);

  /**
   * Schedule a timer for the current item and call onExpire when it finishes.
   */
  const scheduleItem = useCallback((durationMs: number, onExpire: () => void) => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    itemExpectedEndRef.current = Date.now() + durationMs;
    setCurrentItemRemainingMs(durationMs);
    revealTimeoutRef.current = setTimeout(onExpire, durationMs);
  }, []);

  /**
   * Change speed: update default item duration and rebuild all pending durations.
   *
   * @param newDefaultMs - new default per-item ms
   * @param getDuration - function to compute duration for a specific item
   *                      (page, itemIdx, isFirstKey) => ms
   *                      If not provided, all pending items get newDefaultMs.
   * @param rescheduleCurrentItem - if true, reschedule the active item with its new duration
   * @param currentItemNewDurationMs - if provided, use this for the current item reschedule
   * @param onCurrentItemExpire - callback for rescheduled current item
   */
  const setSpeed = useCallback((
    newDefaultMs: number,
    getDuration?: (page: number, itemIdx: number) => number,
    rescheduleCurrentItem?: boolean,
    currentItemNewDurationMs?: number,
    onCurrentItemExpire?: () => void,
  ) => {
    const oldDefaultMs = defaultItemMsRef.current;
    defaultItemMsRef.current = newDefaultMs;

    // Rebuild all page schedules with new durations
    if (getDuration) {
      for (const pageStr of Object.keys(pageSchedulesRef.current)) {
        const page = Number(pageStr);
        const sched = pageSchedulesRef.current[page];
        const newDurations = sched.durations.map((_, i) => getDuration(page, i));
        sched.durations = newDurations;
      }
    } else {
      // Scale all pending durations proportionally
      const ratio = oldDefaultMs > 0 ? newDefaultMs / oldDefaultMs : 1;
      for (const pageStr of Object.keys(pageSchedulesRef.current)) {
        const sched = pageSchedulesRef.current[Number(pageStr)];
        sched.durations = sched.durations.map(d => Math.round(d * ratio));
      }
    }

    // Reschedule current item if requested
    if (rescheduleCurrentItem && onCurrentItemExpire) {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      const newMs = currentItemNewDurationMs ?? newDefaultMs;
      itemExpectedEndRef.current = Date.now() + newMs;
      setCurrentItemRemainingMs(newMs);
      revealTimeoutRef.current = setTimeout(onCurrentItemExpire, newMs);
    }

    // Immediate UI update
    setSessionRemainingMs(computeRemaining());
  }, [computeRemaining]);

  /** Pause the engine */
  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const itemRemaining = pauseItemTimer();
    stopRaf();
    // Compute remaining with the frozen item remaining
    // Since pauseItemTimer cleared itemExpectedEnd, we need to manually add it
    const pendingMs = computeRemaining(); // this won't include current item (cleared)
    pausedSnapshotRef.current = pendingMs + itemRemaining;
    setSessionRemainingMs(pausedSnapshotRef.current);
    setPhase('paused');
    phaseRef.current = 'paused';
  }, [pauseItemTimer, stopRaf, computeRemaining]);

  /** Resume from pause */
  const resume = useCallback((onItemExpire: () => void) => {
    if (phaseRef.current !== 'paused') return;
    setPhase('running');
    phaseRef.current = 'running';

    const remaining = currentItemRemainingMs;
    if (remaining > 0) {
      itemExpectedEndRef.current = Date.now() + remaining;
      setCurrentItemRemainingMs(remaining);
      revealTimeoutRef.current = setTimeout(onItemExpire, remaining);
    }
    startRaf();
  }, [currentItemRemainingMs, startRaf]);

  /** Mark session as completed */
  const complete = useCallback(() => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    itemExpectedEndRef.current = null;
    setSessionRemainingMs(0);
    setCurrentItemRemainingMs(0);
    setPhase('completed');
    phaseRef.current = 'completed';
  }, [stopRaf]);

  /** Save current page's visual state */
  const saveCurrentPageState = useCallback((page: number, state: Omit<EnginePageState, 'savedAt' | 'currentItemRemainingMs' | 'pageConsumed'>) => {
    const sched = pageSchedulesRef.current[page];
    const itemRemaining = itemExpectedEndRef.current !== null
      ? Math.max(0, itemExpectedEndRef.current - Date.now()) : 0;
    pageStatesRef.current[page] = {
      ...state,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: sched ? sched.consumed : 0,
    };
    currentPageRef.current = page;
  }, []);

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
    // Capture current item remaining before clearing
    const itemRemaining = itemExpectedEndRef.current !== null
      ? Math.max(0, itemExpectedEndRef.current - Date.now()) : 0;

    // Stop current item timer
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;
    setCurrentItemRemainingMs(0);

    // Save old page state
    const oldSched = pageSchedulesRef.current[oldPage];
    pageStatesRef.current[oldPage] = {
      ...oldPageState,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: oldSched ? oldSched.consumed : 0,
    };
    currentPageRef.current = newPage;

    // Immediate recalc
    setSessionRemainingMs(computeRemaining());

    return pageStatesRef.current[newPage] || null;
  }, [computeRemaining]);

  /** Reset current page — clears this page's consumed count and visual state */
  const resetPage = useCallback((page: number) => {
    // Reset schedule consumed count
    const sched = pageSchedulesRef.current[page];
    if (sched) {
      sched.consumed = 0;
    }

    // Clear page visual state
    delete pageStatesRef.current[page];

    // Stop current item timer
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;

    // Recalc
    setSessionRemainingMs(computeRemaining());
    setCurrentItemRemainingMs(0);
  }, [computeRemaining]);

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

    let totalMs = 0;
    for (const p of sessionPages) {
      totalMs += (perPageItemCounts[p] || 0) * defaultItemMs;
    }

    setSessionRemainingMs(totalMs);
    setCurrentItemRemainingMs(0);
    setPhase('running');
    phaseRef.current = 'running';
    pausedSnapshotRef.current = 0;
    startRaf();
  }, [stopRaf, startRaf]);

  /** Snapshot for persistence */
  const snapshot = useCallback((
    page: number,
    currentVisualState: Omit<EnginePageState, 'savedAt' | 'currentItemRemainingMs' | 'pageConsumed'>,
  ): EngineSnapshot => {
    const itemRemaining = itemExpectedEndRef.current !== null
      ? Math.max(0, itemExpectedEndRef.current - Date.now()) : 0;

    const sched = pageSchedulesRef.current[page];
    pageStatesRef.current[page] = {
      ...currentVisualState,
      savedAt: Date.now(),
      currentItemRemainingMs: itemRemaining,
      pageConsumed: sched ? sched.consumed : 0,
    };

    const remaining = phaseRef.current === 'paused'
      ? pausedSnapshotRef.current || (computeRemaining() + itemRemaining)
      : computeRemaining();

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
    };
  }, [computeRemaining]);

  /** Restore from snapshot */
  const restore = useCallback((snap: EngineSnapshot) => {
    sessionPagesRef.current = snap.sessionPages || [];
    defaultItemMsRef.current = snap.defaultItemMs || 2000;
    currentPageRef.current = snap.currentPage;
    itemExpectedEndRef.current = null;

    // Restore schedules
    pageSchedulesRef.current = snap.pageSchedules
      ? JSON.parse(JSON.stringify(snap.pageSchedules))
      : {};

    // Restore unregistered pages
    unregisteredPagesRef.current = snap.unregisteredPages
      ? { ...snap.unregisteredPages }
      : {};

    // Restore page states
    pageStatesRef.current = snap.pageStates
      ? JSON.parse(JSON.stringify(snap.pageStates))
      : {};

    // Set remaining from snapshot (exact saved value)
    const remaining = snap.sessionRemainingMs > 0 ? snap.sessionRemainingMs : 0;
    setSessionRemainingMs(remaining);
    setCurrentItemRemainingMs(snap.currentItemRemainingMs || 0);

    // Always restore as paused (user must explicitly resume)
    const p: EnginePhase = snap.phase === 'completed' ? 'completed' : 'paused';
    setPhase(p);
    phaseRef.current = p;

    if (p === 'paused') {
      pausedSnapshotRef.current = remaining;
    }
  }, []);

  /** Stop timers (for unmount) without resetting state */
  const stop = useCallback(() => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
  }, [stopRaf]);

  /** Get total items across all pages (registered + unregistered) */
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
