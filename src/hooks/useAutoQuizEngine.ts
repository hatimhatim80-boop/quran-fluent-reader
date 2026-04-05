/**
 * useAutoQuizEngine — Unified auto-quiz session engine.
 *
 * Single source of truth for:
 *  - Item reveal scheduling (setTimeout chain)
 *  - Session remaining time (derived from reveal schedule)
 *  - Per-page state persistence
 *  - Pause / Resume / Reset page / Reset session
 *
 * The session timer is NOT an independent countdown. It is always
 * computed from: currentItemRemainingMs + futureItems × perItemMs.
 * A RAF loop ticks the UI display from this derived value.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageState } from '@/stores/sessionsStore';

/* ─── Types ─── */

export type EnginePhase = 'idle' | 'running' | 'paused' | 'completed';

export interface EnginePageState {
  revealedKeys: string[];
  blankedKeysList: string[];
  showAll: boolean;
  currentRevealIdx: number;
  activeBlankKey: string | null;
  scrollTop: number;
  savedAt: number;
}

export interface EngineSnapshot {
  phase: EnginePhase;
  currentPage: number;
  sessionRemainingMs: number;
  currentItemRemainingMs: number;
  sessionTotalItems: number;
  sessionProcessedItems: number;
  currentRevealIdx: number;
  activeBlankKey: string | null;
  revealedKeys: string[];
  blankedKeysList: string[];
  showAll: boolean;
  pageStates: Record<number, EnginePageState>;
}

export interface UseAutoQuizEngineOptions {
  /** Called when the engine wants to reveal the next item(s). Return the next idx to advance to. */
  onRevealItem: (idx: number, list: string[]) => { nextIdx: number; revealedCount: number };
  /** Called when a page is complete (all items revealed) */
  onPageComplete: () => void;
  /** Get the per-item duration in ms for a given index */
  getItemDurationMs: (idx: number, list: string[]) => number;
  /** Get the first-word delay in ms */
  getFirstWordDelayMs: (idx: number, list: string[]) => number;
  /** Check if index is a "first key" (e.g., first word of an ayah) */
  isFirstKey: (idx: number, list: string[]) => boolean;
}

/* ─── Hook ─── */

export function useAutoQuizEngine() {
  // ── Core state ──
  const [phase, setPhase] = useState<EnginePhase>('idle');
  const [sessionRemainingMs, setSessionRemainingMs] = useState(0);
  const [currentItemRemainingMs, setCurrentItemRemainingMs] = useState(0);

  // ── Refs (internal state, not triggering re-renders) ──
  const phaseRef = useRef<EnginePhase>('idle');
  const perItemMsRef = useRef(2000); // current speed in ms
  const firstWordDelayMsRef = useRef(0);

  // Item-level timer
  const itemExpectedEndRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session-level
  const totalItemsRef = useRef(0);
  const processedItemsRef = useRef(0);

  // Per-page states
  const pageStatesRef = useRef<Record<number, EnginePageState>>({});
  const currentPageRef = useRef(0);

  // RAF for UI ticking
  const rafRef = useRef<number | null>(null);
  const pausedSnapshotRef = useRef<number>(0);

  // ── Derived remaining time (single source of truth) ──
  const computeRemaining = useCallback((): number => {
    const future = Math.max(0, totalItemsRef.current - processedItemsRef.current);
    if (future <= 0) return 0;

    let currentItemMs = 0;
    if (itemExpectedEndRef.current !== null) {
      currentItemMs = Math.max(0, itemExpectedEndRef.current - Date.now());
    }
    const afterCurrent = Math.max(0, future - 1);
    return currentItemMs + afterCurrent * perItemMsRef.current;
  }, []);

  // ── RAF tick loop ──
  const tick = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const ms = computeRemaining();
    setSessionRemainingMs(ms);
    // Also update item remaining for UI
    if (itemExpectedEndRef.current !== null) {
      setCurrentItemRemainingMs(Math.max(0, itemExpectedEndRef.current - Date.now()));
    }
    if (ms > 0) {
      rafRef.current = requestAnimationFrame(tick);
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
  const startItemTimer = useCallback((durationMs: number) => {
    itemExpectedEndRef.current = Date.now() + durationMs;
    setCurrentItemRemainingMs(durationMs);
  }, []);

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

  const resumeItemTimer = useCallback((remainingMs: number, onExpire: () => void) => {
    itemExpectedEndRef.current = Date.now() + remainingMs;
    setCurrentItemRemainingMs(remainingMs);
    revealTimeoutRef.current = setTimeout(onExpire, remainingMs);
  }, []);

  // ── Public API ──

  /** Initialize a new session */
  const initSession = useCallback((totalItems: number, perItemMs: number, firstWordDelayMs: number, startPage: number) => {
    totalItemsRef.current = totalItems;
    processedItemsRef.current = 0;
    perItemMsRef.current = perItemMs;
    firstWordDelayMsRef.current = firstWordDelayMs;
    pageStatesRef.current = {};
    currentPageRef.current = startPage;
    itemExpectedEndRef.current = null;

    const total = totalItems * perItemMs;
    setSessionRemainingMs(total);
    setCurrentItemRemainingMs(0);
    setPhase('running');
    phaseRef.current = 'running';
    pausedSnapshotRef.current = 0;
    startRaf();
  }, [startRaf]);

  /** Update speed — recalculates remaining for future items only */
  const setSpeed = useCallback((perItemMs: number, firstWordDelayMs?: number) => {
    perItemMsRef.current = perItemMs;
    if (firstWordDelayMs !== undefined) firstWordDelayMsRef.current = firstWordDelayMs;
    // Immediate UI update
    setSessionRemainingMs(computeRemaining());
  }, [computeRemaining]);

  /** Record that N items were processed (revealed) */
  const recordProcessed = useCallback((count: number = 1) => {
    processedItemsRef.current += count;
    // Immediate recalc
    setSessionRemainingMs(computeRemaining());
  }, [computeRemaining]);

  /** Start the item timer and schedule a callback when it expires */
  const scheduleItem = useCallback((durationMs: number, onExpire: () => void) => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    startItemTimer(durationMs);
    revealTimeoutRef.current = setTimeout(onExpire, durationMs);
  }, [startItemTimer]);

  /** Pause the engine */
  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const itemRemaining = pauseItemTimer();
    stopRaf();
    const snapshot = computeRemaining();
    // Since we cleared itemExpectedEnd, we need to add itemRemaining back
    pausedSnapshotRef.current = snapshot + itemRemaining; // approximate since computeRemaining uses live clock
    setSessionRemainingMs(pausedSnapshotRef.current > 0 ? pausedSnapshotRef.current : snapshot);
    setPhase('paused');
    phaseRef.current = 'paused';
  }, [pauseItemTimer, stopRaf, computeRemaining]);

  /** Resume from pause, calling onExpire when the current item timer finishes */
  const resume = useCallback((onItemExpire: () => void) => {
    if (phaseRef.current !== 'paused') return;
    setPhase('running');
    phaseRef.current = 'running';

    const remaining = currentItemRemainingMs;
    if (remaining > 0) {
      resumeItemTimer(remaining, onItemExpire);
    }
    startRaf();
  }, [currentItemRemainingMs, resumeItemTimer, startRaf]);

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

  /** Save current page's state */
  const saveCurrentPageState = useCallback((page: number, state: Omit<EnginePageState, 'savedAt'>) => {
    pageStatesRef.current[page] = { ...state, savedAt: Date.now() };
    currentPageRef.current = page;
  }, []);

  /** Get saved state for a page, or null */
  const getPageState = useCallback((page: number): EnginePageState | null => {
    return pageStatesRef.current[page] || null;
  }, []);

  /** Navigate to a new page — pauses item timer, saves old page, returns saved state for new page */
  const navigateToPage = useCallback((
    oldPage: number,
    newPage: number,
    oldPageState: Omit<EnginePageState, 'savedAt'>
  ): EnginePageState | null => {
    // Pause item timer (we'll restart for the new page)
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;

    // Save old page state
    pageStatesRef.current[oldPage] = { ...oldPageState, savedAt: Date.now() };
    currentPageRef.current = newPage;

    // Immediate recalc of session remaining
    setSessionRemainingMs(computeRemaining());

    // Return saved state for new page if exists
    return pageStatesRef.current[newPage] || null;
  }, [computeRemaining]);

  /** Reset current page only — clears page state, restores remaining time for this page */
  const resetPage = useCallback((page: number, pageItemCount: number) => {
    // Remove any items this page already processed from the processed count
    const oldState = pageStatesRef.current[page];
    if (oldState) {
      // The number of revealed items on this page
      const prevRevealed = oldState.showAll ? oldState.blankedKeysList.length : oldState.revealedKeys.length;
      processedItemsRef.current = Math.max(0, processedItemsRef.current - prevRevealed);
    }
    // Clear page state
    delete pageStatesRef.current[page];

    // Stop current item timer
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;

    // Recalc
    setSessionRemainingMs(computeRemaining());
    setCurrentItemRemainingMs(0);
  }, [computeRemaining]);

  /** Reset entire session — clears all state */
  const resetSession = useCallback((totalItems: number, perItemMs: number, firstWordDelayMs: number, startPage: number) => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    itemExpectedEndRef.current = null;

    totalItemsRef.current = totalItems;
    processedItemsRef.current = 0;
    perItemMsRef.current = perItemMs;
    firstWordDelayMsRef.current = firstWordDelayMs;
    pageStatesRef.current = {};
    currentPageRef.current = startPage;

    const total = totalItems * perItemMs;
    setSessionRemainingMs(total);
    setCurrentItemRemainingMs(0);
    setPhase('running');
    phaseRef.current = 'running';
    pausedSnapshotRef.current = 0;
    startRaf();
  }, [stopRaf, startRaf]);

  /** Take a snapshot of the entire engine state (for persistence) */
  const snapshot = useCallback((
    page: number,
    currentVisualState: Omit<EnginePageState, 'savedAt'>
  ): EngineSnapshot => {
    // Save current page before snapshot
    pageStatesRef.current[page] = { ...currentVisualState, savedAt: Date.now() };

    const isComplete = totalItemsRef.current > 0 && processedItemsRef.current >= totalItemsRef.current;
    const effectivePhase = isComplete ? 'completed' : phaseRef.current;

    return {
      phase: effectivePhase,
      currentPage: page,
      sessionRemainingMs: phaseRef.current === 'paused'
        ? pausedSnapshotRef.current || computeRemaining()
        : computeRemaining(),
      currentItemRemainingMs: itemExpectedEndRef.current !== null
        ? Math.max(0, itemExpectedEndRef.current - Date.now())
        : currentItemRemainingMs,
      sessionTotalItems: totalItemsRef.current,
      sessionProcessedItems: processedItemsRef.current,
      currentRevealIdx: currentVisualState.currentRevealIdx,
      activeBlankKey: currentVisualState.activeBlankKey,
      revealedKeys: currentVisualState.revealedKeys,
      blankedKeysList: currentVisualState.blankedKeysList,
      showAll: currentVisualState.showAll,
      pageStates: { ...pageStatesRef.current },
    };
  }, [computeRemaining, currentItemRemainingMs]);

  /** Restore from a snapshot (for session resume) */
  const restore = useCallback((snap: EngineSnapshot, perItemMs: number, firstWordDelayMs: number) => {
    totalItemsRef.current = snap.sessionTotalItems;
    processedItemsRef.current = snap.sessionProcessedItems;
    perItemMsRef.current = perItemMs;
    firstWordDelayMsRef.current = firstWordDelayMs;
    currentPageRef.current = snap.currentPage;
    itemExpectedEndRef.current = null;

    // Restore page states
    pageStatesRef.current = { ...snap.pageStates };

    // Set remaining
    const remaining = snap.sessionRemainingMs > 0 ? snap.sessionRemainingMs : computeRemaining();
    setSessionRemainingMs(remaining);
    setCurrentItemRemainingMs(snap.currentItemRemainingMs || 0);

    // Set phase
    const p = snap.phase === 'completed' ? 'completed' : snap.phase === 'running' ? 'paused' : snap.phase;
    setPhase(p);
    phaseRef.current = p;

    if (p === 'paused') {
      pausedSnapshotRef.current = remaining;
    }
  }, [computeRemaining]);

  /** Stop everything (for unmount / exit) */
  const stop = useCallback(() => {
    stopRaf();
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
    // Don't reset state — just stop timers
  }, [stopRaf]);

  return {
    // State
    phase,
    sessionRemainingMs,
    currentItemRemainingMs,

    // Refs (for reading in callbacks without re-renders)
    totalItemsRef,
    processedItemsRef,
    perItemMsRef,
    pageStatesRef,
    phaseRef,

    // Actions
    initSession,
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
  };
}
