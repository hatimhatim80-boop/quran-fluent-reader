import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

// IndexedDB storage
const DB_NAME = 'sessions-persist';
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
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch {
      localStorage.setItem(name, value);
    }
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

export interface SessionSection {
  id: string;
  title: string;
  startPage: number;
  endPage?: number;
  currentPage: number;
}

export interface Session {
  id: string;
  name: string;
  type: 'ghareeb' | 'tahfeez';
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  currentPage: number;
  startPage?: number;
  endPage?: number;
  sections?: SessionSection[];
  /** For tahfeez: snapshot of stored items */
  tahfeezItems?: unknown[];
  /** For tahfeez: quiz settings snapshot */
  quizSettings?: Record<string, unknown>;
}

interface SessionsState {
  sessions: Session[];
  activeSessionId: string | null;

  createSession: (name: string, type: 'ghareeb' | 'tahfeez', startPage?: number, endPage?: number) => string;
  updateSession: (id: string, patch: Partial<Pick<Session, 'name' | 'currentPage' | 'startPage' | 'endPage' | 'tahfeezItems' | 'quizSettings' | 'sections'>>) => void;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  getSession: (id: string) => Session | undefined;
  addSection: (sessionId: string, title: string, startPage: number, endPage?: number) => void;
  removeSection: (sessionId: string, sectionId: string) => void;
  updateSection: (sessionId: string, sectionId: string, patch: Partial<Pick<SessionSection, 'title' | 'startPage' | 'endPage' | 'currentPage'>>) => void;
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (name, type, startPage = 1, endPage) => {
        const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const session: Session = {
          id,
          name,
          type,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          archived: false,
          currentPage: startPage,
          startPage,
          endPage,
        };
        set({ sessions: [...get().sessions, session], activeSessionId: id });
        return id;
      },

      updateSession: (id, patch) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
          ),
        });
      },

      archiveSession: (id) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, archived: true, updatedAt: Date.now() } : s
          ),
          activeSessionId: get().activeSessionId === id ? null : get().activeSessionId,
        });
      },

      unarchiveSession: (id) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, archived: false, updatedAt: Date.now() } : s
          ),
        });
      },

      deleteSession: (id) => {
        set({
          sessions: get().sessions.filter(s => s.id !== id),
          activeSessionId: get().activeSessionId === id ? null : get().activeSessionId,
        });
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      getSession: (id) => get().sessions.find(s => s.id === id),

      addSection: (sessionId, title, startPage, endPage) => {
        const sectionId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        set({
          sessions: get().sessions.map(s =>
            s.id === sessionId
              ? { ...s, sections: [...(s.sections || []), { id: sectionId, title, startPage, endPage, currentPage: startPage }], updatedAt: Date.now() }
              : s
          ),
        });
      },

      removeSection: (sessionId, sectionId) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === sessionId
              ? { ...s, sections: (s.sections || []).filter(sec => sec.id !== sectionId), updatedAt: Date.now() }
              : s
          ),
        });
      },

      updateSection: (sessionId, sectionId, patch) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === sessionId
              ? { ...s, sections: (s.sections || []).map(sec => sec.id === sectionId ? { ...sec, ...patch } : sec), updatedAt: Date.now() }
              : s
          ),
        });
      },
    }),
    {
      name: 'sessions.v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
