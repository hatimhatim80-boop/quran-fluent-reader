/**
 * Progress + settings of "جلسة الحفظ بالتكرار".
 *
 * Completely independent from the SRS review sessions: it has its own
 * persisted store keyed by session id, so nothing here can touch
 * `reviewSessionStore` or `sessionsStore` state beyond its own record.
 *
 * Everything is written after each meaningful event (a finished repetition,
 * a recitation attempt, an approved unit, a settings change), so a sudden
 * Android kill loses at most the current keystroke.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';
import type { UnitMode } from '@/utils/memorizationUnits';
import type { DiffToken } from '@/utils/memorizationDiff';

const DB_NAME = 'memorization-persist';
const STORE_NAME = 'keyval';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
}

const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const db = await getDB();
      const v = (await db.get(STORE_NAME, name)) as string | undefined;
      if (v != null) return v;
    } catch (e) {
      console.error('[memorizationStore] idb read failed', e);
    }
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: async (name, value) => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch (e) {
      console.error('[memorizationStore] idb write failed', e);
    }
    try { localStorage.setItem(name, value); } catch { /* quota */ }
  },
  removeItem: async (name) => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, name);
    } catch (e) {
      console.error('[memorizationStore] idb delete failed', e);
    }
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  },
};

export type MemorizationMethod = 'new' | 'cumulative';
export type TranscriptVisibility = 'live' | 'after';

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
  autoCheck: boolean;
  autoApproveOnSuccess: boolean;
  autoAdvance: boolean;
  reciterId: string;
  language: string;
}

export interface MemorizationAttempt {
  at: number;
  unitIndex: number;
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
  memorizedUnits: number[];
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
  autoCheck: true,
  autoApproveOnSuccess: false,
  autoAdvance: false,
  reciterId: '',
  language: 'ar-SA',
};

interface MemorizationState {
  records: Record<string, MemorizationProgress>;
  ensure: (sessionId: string, initial?: Partial<MemorizationSettings>) => MemorizationProgress;
  get: (sessionId: string) => MemorizationProgress | undefined;
  patchSettings: (sessionId: string, patch: Partial<MemorizationSettings>) => void;
  patchProgress: (sessionId: string, patch: Partial<Omit<MemorizationProgress, 'sessionId' | 'settings'>>) => void;
  addAttempt: (sessionId: string, attempt: MemorizationAttempt) => void;
  markMemorized: (sessionId: string, unitIndex: number) => void;
  resetSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
}

export const useMemorizationStore = create<MemorizationState>()(
  persist(
    (set, get) => ({
      records: {},

      ensure: (sessionId, initial) => {
        const existing = get().records[sessionId];
        if (existing) return existing;
        const record: MemorizationProgress = {
          sessionId,
          settings: { ...DEFAULT_MEMORIZATION_SETTINGS, ...initial },
          currentUnit: 0,
          memorizedUnits: [],
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

      markMemorized: (sessionId, unitIndex) => {
        const rec = get().records[sessionId];
        if (!rec) return;
        if (rec.memorizedUnits.includes(unitIndex)) return;
        set({
          records: {
            ...get().records,
            [sessionId]: {
              ...rec,
              memorizedUnits: [...rec.memorizedUnits, unitIndex].sort((a, b) => a - b),
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
              memorizedUnits: [],
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
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
