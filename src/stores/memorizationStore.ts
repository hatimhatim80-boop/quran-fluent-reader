/** Persisted state for the independent repetition-memorization session. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createPersistentStorage } from '@/services/persistentKV';
import type { DiffToken } from '@/utils/memorizationDiff';
import type { UnitMode } from '@/utils/memorizationUnits';

export type MemorizationMethod = 'new' | 'cumulative';
export type TranscriptVisibility = 'live' | 'after';
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

export const STRUCTURAL_SETTING_KEYS = ['startPage', 'endPage', 'unitMode', 'unitSize'] as const;

export interface MemorizationAttempt {
  at: number;
  unitId: string;
  rawTranscript: string;
  tokens: DiffToken[];
  score: number;
  doubtful: boolean;
}

export interface MemorizationProgress {
  sessionId: string;
  settings: MemorizationSettings;
  currentUnit: number;
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
        set(state => ({ records: { ...state.records, [sessionId]: record } }));
        return record;
      },
      get: sessionId => get().records[sessionId],
      patchSettings: (sessionId, patch) => set(state => {
        const record = state.records[sessionId];
        if (!record) return state;
        return { records: { ...state.records, [sessionId]: { ...record, settings: { ...record.settings, ...patch }, updatedAt: Date.now() } } };
      }),
      patchProgress: (sessionId, patch) => set(state => {
        const record = state.records[sessionId];
        if (!record) return state;
        return { records: { ...state.records, [sessionId]: { ...record, ...patch, updatedAt: Date.now() } } };
      }),
      addAttempt: (sessionId, attempt) => set(state => {
        const record = state.records[sessionId];
        if (!record) return state;
        return {
          records: {
            ...state.records,
            [sessionId]: {
              ...record,
              attempts: [...record.attempts, attempt].slice(-40),
              lastAttempt: attempt,
              attemptCount: record.attemptCount + 1,
              updatedAt: Date.now(),
            },
          },
        };
      }),
      markMemorized: (sessionId, atomIds) => {
        const record = get().records[sessionId];
        if (!record || !atomIds?.length) return;
        const merged = new Set([...record.memorizedIds, ...atomIds.filter(Boolean)]);
        if (merged.size === record.memorizedIds.length) return;
        set(state => ({ records: { ...state.records, [sessionId]: { ...record, memorizedIds: [...merged], updatedAt: Date.now() } } }));
      },
      unmarkMemorized: (sessionId, atomIds) => {
        const record = get().records[sessionId];
        if (!record || !atomIds?.length) return;
        const drop = new Set(atomIds);
        set(state => ({
          records: {
            ...state.records,
            [sessionId]: { ...record, memorizedIds: record.memorizedIds.filter(id => !drop.has(id)), updatedAt: Date.now() },
          },
        }));
      },
      resetSession: sessionId => set(state => {
        const record = state.records[sessionId];
        if (!record) return state;
        return {
          records: {
            ...state.records,
            [sessionId]: {
              ...record,
              currentUnit: 0,
              memorizedIds: [],
              repsDone: 0,
              attempts: [],
              lastAttempt: null,
              attemptCount: 0,
              updatedAt: Date.now(),
            },
          },
        };
      }),
      removeSession: sessionId => set(state => {
        const records = { ...state.records };
        delete records[sessionId];
        return { records };
      }),
    }),
    {
      name: 'memorization.v1',
      storage: createJSONStorage(() => createPersistentStorage('memorization-persist')),
      partialize: state => ({ records: state.records }) as unknown as MemorizationState,
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error('[memorizationStore] rehydrate failed', error);
        if (state) {
          Object.values(state.records || {}).forEach(record => {
            const legacy = record as MemorizationProgress & { memorizedUnits?: number[] };
            record.memorizedIds = Array.isArray(record.memorizedIds) ? record.memorizedIds : [];
            delete legacy.memorizedUnits;
            record.settings = { ...DEFAULT_MEMORIZATION_SETTINGS, ...record.settings };
          });
        }
        useMemorizationStore.getState().setHydrated();
      },
    },
  ),
);
