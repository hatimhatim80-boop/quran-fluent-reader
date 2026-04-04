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

  // Settings
  settings: {
    reviewLevel?: 'ayah' | 'word';
    contentType?: string;
    order?: SessionOrder;
    archiveFilter?: ArchiveFilter;
    highlightStyle?: string;
    answerMode?: string;
  };
}

interface ReviewSessionStoreState {
  sessions: ReviewSessionMeta[];

  createSession: (meta: Omit<ReviewSessionMeta, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'reviewedIds' | 'archivedInSession' | 'suspendedIds' | 'currentIdx' | 'ratingsMap'>) => string;
  updateSession: (id: string, patch: Partial<ReviewSessionMeta>) => void;
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
        set({ sessions: get().sessions.filter(s => s.id !== id) });
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
