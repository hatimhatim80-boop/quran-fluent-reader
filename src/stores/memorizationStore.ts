/**
 * Progress + settings of "جلسة الحفظ بالتكرار".
 *
 * Completely independent from the SRS review sessions: it has its own
 * persisted store keyed by session id, so nothing here can touch
 * `reviewSessionStore` or `sessionsStore` state beyond its own record.
 *
 * Storage is the shared persistent layer (Capacitor Preferences on Android,
 * IndexedDB on the web) — progress must survive an app kill.
 *
 * Memorized units are tracked by their content-derived `stableId`, never by
 * array index, so re-slicing the range can never paint an unmemorized part
 * with the memorized colour.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createPersistentStorage } from '@/services/persistentKV';
import type { UnitMode } from '@/utils/memorizationUnits';
import type { DiffToken } from '@/utils/memorizationDiff';

export type MemorizationMethod = 'new' | 'cumulative';
export type TranscriptVisibility = 'live' | 'after';
/** How much of what comes next the student is allowed to see. */
export type UpcomingVisibility = 'hidden' | 'next' | 'all';

export interface MemorizationSettings {
  startPage: number;
  endPage: number;
  unitMode: UnitMode;
  unitSize: number;
  repeatTarget: number;
  method: MemorizationMethod;
  autoPlayAudio: boolean;
  autoStartRecitation: boolean;
  transcriptVisibility: TranscriptVisibility;
  upcomingVisibility: UpcomingVisibility;
  autoCheck: boolean;
  autoApproveOnSuccess: boolean;
  autoAdvance: boolean;
  reciterId: string;
  language: string;
}

/** Settings that change how units are cut — they rebuild the whole list. */
export const STRUCTURAL_SETTING_KEYS = ['startPage', 'endPage', 'unitMode', 'unitSize'] as const;
export type StructuralSettingKey = typeof STRUCTURAL_SETTING_KEYS[number];

export interface MemorizationAttempt {
  at: number;
  unitId: string;
  /** Raw recognizer output — kept apart from the Quranic text. */
  rawTranscript: string;
  tokens: DiffToken[];
  score: number;
  doubtful: boolean;
}

export interface MemorizationProgress {
  sessionId: string;
  settings: MemorizationSettings;
  currentUnit: number;
  /** Stable, content-derived ids of the approved units. */
  memorizedIds: string[];
  repsDone: number;
  attempts: MemorizationAttempt[];
  lastAttempt: MemorizationAttempt | null;
  attemptCount: number;
  updatedAt: number;
}

export const DEFAULT_MEMORIZATION_SETTINGS: MemorizationSettings = {
  startPage: 1,
  endPage: 1,
  unitMode: 'ayah',
  unitSize: 1,
  repeatTarget: 5,
  method: 'new',
  autoPlayAudio: true,
  autoStartRecitation: false,
  transcriptVisibility: 'live',
  upcomingVisibility: 'next',
  autoCheck: true,
  autoApproveOnSuccess: false,
  // In a repetition session, approving a unit moves on to the next one.
  autoAdvance: true,
  reciterId: '',
  language: 'ar-SA',
};

interface MemorizationState {
  records: Record<string, MemorizationProgress>;
  hasHydrated: boolean;
  setHydrated: () => void;
  ensure: (sessionId: string, initial?: Partial<MemorizationSettings>) => MemorizationProgress;
  get: (sessionId: string) => MemorizationProgress | undefined;
  patchSettings: (sessionId: string, patch: Partial<MemorizationSettings>) => void;
  patchProgress: (sessionId: string, patch: Partial<Omit<MemorizationProgress, 'sessionId' | 'settings'>>) => void;
  addAttempt: (sessionId: string, attempt: MemorizationAttempt) => void;
  /** Approves the smallest fixed pieces (atom ids) of a unit. */
  markMemorized: (sessionId: string, atomIds: string[]) => void;
  unmarkMemorized: (sessionId: string, atomIds: string[]) => void;
  resetSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
}

export const useMemorizationStore = create<MemorizationState>()(
  persist(
    (set, get) => ({
      records: {},
      hasHydrated: false,
      setHydrated: () => set({ hasHydrated: true }),

      ensure: (sessionId, initial) => {
        const existing = get().records[sessionId];
        if (existing) return existing;
        const record: MemorizationProgress = {
          sessionId,
          settings: { ...DEFAULT_MEMORIZATION_SETTINGS, ...initial },
          currentUnit: 0,
          memorizedIds: [],
          repsDone: 0,
          attempts: [],
          lastAttempt: null,
          attemptCount: 0,
          updatedAt: Date.now(),
        };
        set({ records: { ...get().records, [sessionId]: record } });
        return record;
      },

      get: (sessionId) => get().records[sessionId],

      patchSettings: (sessionId, patch) => {
        const rec = get().records[sessionId];
        if (!rec) return;
        set({
          records: {
            ...get().records,
            [sessionId]: { ...rec, settings: { ...rec.settings, ...patch }, updatedAt: Date.now() },
          },
        });
      },

      patchProgress: (sessionId, patch) => {
        const rec = get().records[sessionId];
        if (!rec) return;
        set({ records: { ...get().records, [sessionId]: { ...rec, ...patch, updatedAt: Date.now() } } });
      },

      addAttempt: (sessionId, attempt) => {
        const rec = get().records[sessionId];
        if (!rec) return;
        const attempts = [...rec.attempts, attempt].slice(-40);
        set({
          records: {
            ...get().records,
            [sessionId]: {
              ...rec,
              attempts,
              lastAttempt: attempt,
              attemptCount: rec.attemptCount + 1,
              updatedAt: Date.now(),
            },
          },
        });
      },

      markMemorized: (sessionId, atomIds) => {
        const rec = get().records[sessionId];
        if (!rec || !atomIds || atomIds.length === 0) return;
        const merged = new Set([...rec.memorizedIds, ...atomIds.filter(Boolean)]);
        if (merged.size === rec.memorizedIds.length) return;
        set({
          records: {
            ...get().records,
            [sessionId]: { ...rec, memorizedIds: [...merged], updatedAt: Date.now() },
          },
        });
      },

      unmarkMemorized: (sessionId, atomIds) => {
        const rec = get().records[sessionId];
        if (!rec || !atomIds || atomIds.length === 0) return;
        const drop = new Set(atomIds);
        set({
          records: {
            ...get().records,
            [sessionId]: {
              ...rec,
              memorizedIds: rec.memorizedIds.filter(id => !drop.has(id)),
              updatedAt: Date.now(),
            },
          },
        });
      },

      resetSession: (sessionId) => {
        const rec = get().records[sessionId];
        if (!rec) return;
        set({
          records: {
            ...get().records,
            [sessionId]: {
              ...rec,
              currentUnit: 0,
              memorizedIds: [],
              repsDone: 0,
              attempts: [],
              lastAttempt: null,
              attemptCount: 0,
              updatedAt: Date.now(),
            },
          },
        });
      },

      removeSession: (sessionId) => {
        const next = { ...get().records };
        delete next[sessionId];
        set({ records: next });
      },
    }),
    {
      name: 'memorization.v1',
      storage: createJSONStorage(() => createPersistentStorage('memorization-persist')),
      partialize: (state) => ({ records: state.records }) as unknown as MemorizationState,
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error('[memorizationStore] rehydrate failed', error);
        // Old records may predate `memorizedIds` — normalise instead of crashing.
        if (state) {
          Object.values(state.records || {}).forEach(rec => {
            if (!Array.isArray(rec.memorizedIds)) rec.memorizedIds = [];
            rec.settings = { ...DEFAULT_MEMORIZATION_SETTINGS, ...rec.settings };
          });
        }
        useMemorizationStore.getState().setHydrated();
      },
    }
  )
);
