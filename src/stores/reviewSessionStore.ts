import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

const DB_NAME = 'review-sessions-persist';
const STORE_NAME = 'keyval';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const db = await getDB();
      return ((await db.get(STORE_NAME, name)) as string) ?? null;
    } catch { return localStorage.getItem(name); }
  },
  setItem: async (name, value) => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch { localStorage.setItem(name, value); }
    try { localStorage.setItem(name, value); } catch {}
  },
  removeItem: async (name) => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, name);
    } catch {}
    try { localStorage.removeItem(name); } catch {}
  },
};

export type SessionType = 'new' | 'due' | 'mixed' | 'flagged' | 'archived-only' | 'scope';
export type SessionOrder = 'smart' | 'mushaf' | 'random';
export type ArchiveFilter = 'exclude' | 'include' | 'only';

/** How a hidden ayah is uncovered inside a review session. */
export type SessionRevealMode = 'smart' | 'wordByWordManual' | 'wordByWordAuto';
/** Which recitation plays automatically when a hidden ayah appears. */
export type SessionAudioMode = 'none' | 'previous' | 'current' | 'previous-then-current';

/** Per-session font settings (never shared between sessions) */
export interface ReviewSessionFonts {
  fontFamily?: string;
  quranFontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
}

/**
 * All settings belonging to ONE review session.
 * Everything the user can change inside or while setting up a session lives
 * here, keyed by the session id — never in a shared/global variable.
 */
export interface ReviewSessionSettings {
  reviewLevel?: 'ayah' | 'word';
  contentType?: string;
  /** Session type filter chosen at setup (due/new/mixed/...) */
  sessionType?: SessionType;
  order?: SessionOrder;
  archiveFilter?: ArchiveFilter;
  /** Scope selection (type + range) */
  scopeType?: string;
  scopeFrom?: number;
  scopeTo?: number;
  /** Requested card count ('all' or a number as string) */
  sessionSize?: string;
  highlightStyle?: string;
  answerMode?: string;
  showIndex?: boolean;
  /** How the hidden ayah is uncovered (smart / word-by-word manual / auto). */
  revealMode?: SessionRevealMode;
  /** Seconds between words in automatic word-by-word reveal. */
  wordRevealInterval?: number;
  /** Recitation played automatically when a hidden ayah appears. */
  audioBeforeReveal?: SessionAudioMode;
  /** Reciter id used by this session. */
  audioReciter?: string;
  /** Treat the last ayah of the previous surah as "the previous ayah". */
  audioPreviousCrossSurah?: boolean;

  fonts?: ReviewSessionFonts;
  generalSessionId?: string;
  /** Free-form extras for portal-specific options */
  extra?: Record<string, unknown>;
}

export interface ReviewSessionMeta {
  id: string;
  portal: 'ghareeb' | 'tahfeez';
  name: string;
  sessionType: SessionType;
  createdAt: number;
  updatedAt: number;
  completed: boolean;

  // Scope info
  scopeLabel: string;

  // Card tracking
  cardIds: string[];
  reviewedIds: string[];
  archivedInSession: string[];
  suspendedIds: string[];
  currentIdx: number;

  // Ratings map (cardId -> last rating)
  ratingsMap: Record<string, number>;

  // Settings — strictly per-session
  settings: ReviewSessionSettings;
}

interface ReviewSessionStoreState {
  sessions: ReviewSessionMeta[];

  createSession: (meta: Omit<ReviewSessionMeta, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'reviewedIds' | 'archivedInSession' | 'suspendedIds' | 'currentIdx' | 'ratingsMap'>) => string;
  updateSession: (id: string, patch: Partial<ReviewSessionMeta>) => void;
  /** Merge-and-save settings for ONE session. Saves immediately. */
  updateSessionSettings: (id: string, patch: Partial<ReviewSessionSettings>) => void;
  getSessionSettings: (id: string) => ReviewSessionSettings | undefined;
  getSession: (id: string) => ReviewSessionMeta | undefined;
  getActiveSession: (portal: 'ghareeb' | 'tahfeez') => ReviewSessionMeta | undefined;
  completeSession: (id: string) => void;
  deleteSession: (id: string) => void;
  getRecentSessions: (portal: 'ghareeb' | 'tahfeez', limit?: number) => ReviewSessionMeta[];
}

export const useReviewSessionStore = create<ReviewSessionStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],

      createSession: (meta) => {
        // Reuse an identical session created moments ago (double-tap guard).
        const dup = get().sessions.find(
          s => s.portal === meta.portal && s.name === meta.name && !s.completed && Date.now() - s.createdAt < 15000
        );
        if (dup) return dup.id;
        const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const session: ReviewSessionMeta = {
          ...meta,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completed: false,
          reviewedIds: [],
          archivedInSession: [],
          suspendedIds: [],
          currentIdx: 0,
          ratingsMap: {},
        };
        set({ sessions: [...get().sessions, session] });
        return id;
      },

      updateSession: (id, patch) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
          ),
        });
      },

      /**
       * Immediately persists a settings change for ONE session.
       * Deep-merges `fonts` and `extra` so partial updates never wipe siblings,
       * and never touches any other session.
       */
      updateSessionSettings: (id, patch) => {
        set({
          sessions: get().sessions.map(s => {
            if (s.id !== id) return s;
            const prev = s.settings || {};
            return {
              ...s,
              settings: {
                ...prev,
                ...patch,
                fonts: patch.fonts ? { ...(prev.fonts || {}), ...patch.fonts } : prev.fonts,
                extra: patch.extra ? { ...(prev.extra || {}), ...patch.extra } : prev.extra,
              },
              updatedAt: Date.now(),
            };
          }),
        });
      },

      getSessionSettings: (id) => get().sessions.find(s => s.id === id)?.settings,

      getSession: (id) => get().sessions.find(s => s.id === id),

      getActiveSession: (portal) =>
        get().sessions.find(s => s.portal === portal && !s.completed),

      completeSession: (id) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, completed: true, updatedAt: Date.now() } : s
          ),
        });
      },

      deleteSession: (id) => {
        // Cascade to the linked general session record, if any.
        const generalId = get().sessions.find(s => s.id === id)?.settings?.generalSessionId;
        set({ sessions: get().sessions.filter(s => s.id !== id) });
        if (generalId) {
          void import('./sessionsStore').then(({ useSessionsStore }) => {
            if (useSessionsStore.getState().sessions.some(s => s.id === generalId)) {
              useSessionsStore.getState().deleteSession(generalId);
            }
          }).catch(() => {});
        }
      },

      getRecentSessions: (portal, limit = 5) => {
        return get().sessions
          .filter(s => s.portal === portal)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit);
      },
    }),
    {
      name: 'review-sessions.v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    }
  )
);
