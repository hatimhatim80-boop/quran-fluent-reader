import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GhareebWord } from '@/types/quran';

// User override entry
export interface UserWordOverride {
  id: string;
  key: string; // surah_ayah_wordIndex
  
  // Override data
  pageNumber?: number;
  wordText?: string;
  meaning?: string;
  surahNumber?: number;
  verseNumber?: number;
  wordIndex?: number;
  surahName?: string;
  
  // Operation type
  operation: 'add' | 'edit' | 'delete';
  
  createdAt: string;
  updatedAt: string;
}

// Page order override
export interface PageOrderOverride {
  pageNumber: number;
  scope: 'whole_page' | 'line_range' | 'custom_selection';
  
  // For line_range
  lineStart?: number;
  lineEnd?: number;
  
  // For custom_selection
  startWordKey?: string;
  endWordKey?: string;
  
  // Operation
  operation: 'rebuild_indices' | 'offset_shift' | 'reorder' | 'locked_order';
  
  // For offset_shift
  offsetAmount?: number;
  
  // For locked_order / reorder
  orderedKeys?: string[];
  
  createdAt: string;
}

interface DataState {
  // User overrides layer
  userOverrides: UserWordOverride[];
  
  // Page order overrides
  pageOrderOverrides: PageOrderOverride[];
  
  // Undo stack
  undoStack: { overrides: UserWordOverride[]; orders: PageOrderOverride[] }[];
  
  // CRUD for word overrides
  addWordOverride: (override: Omit<UserWordOverride, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateWordOverride: (id: string, updates: Partial<UserWordOverride>) => void;
  deleteWordOverride: (id: string) => void;
  
  // Query overrides
  getOverrideByKey: (key: string) => UserWordOverride | undefined;
  getOverridesByPage: (page: number) => UserWordOverride[];
  
  // Page order operations
  addPageOrderOverride: (override: Omit<PageOrderOverride, 'createdAt'>) => void;
  getPageOrderOverride: (pageNumber: number) => PageOrderOverride | undefined;
  deletePageOrderOverride: (pageNumber: number) => void;
  
  // Apply overrides to base data
  applyOverrides: (baseWords: GhareebWord[]) => GhareebWord[];
  
  // Bulk operations
  importOverrides: (json: string) => { success: boolean; count: number };
  exportOverrides: () => string;
  
  // Undo
  undo: () => void;
  canUndo: () => boolean;
  
  // Reset
  resetAll: () => void;
}

function generateId(): string {
  return `override_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      userOverrides: [],
      pageOrderOverrides: [],
      undoStack: [],

      addWordOverride: (overrideData) => {
        const id = generateId();
        const now = new Date().toISOString();
        
        const override: UserWordOverride = {
          ...overrideData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        
        set((state) => ({
          userOverrides: [...state.userOverrides, override],
          undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
        }));
        
        return id;
      },

      updateWordOverride: (id, updates) => {
        set((state) => ({
          userOverrides: state.userOverrides.map((o) =>
            o.id === id
              ? { ...o, ...updates, updatedAt: new Date().toISOString() }
              : o
          ),
          undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
        }));
      },

      deleteWordOverride: (id) => {
        set((state) => ({
          userOverrides: state.userOverrides.filter((o) => o.id !== id),
          undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
        }));
      },

      getOverrideByKey: (key) => {
        const overrides = get().userOverrides;
        // Return the most recent non-deleted override
        const matching = overrides.filter((o) => o.key === key && o.operation !== 'delete');
        return matching[matching.length - 1];
      },

      getOverridesByPage: (page) => {
        return get().userOverrides.filter((o) => o.pageNumber === page);
      },

      addPageOrderOverride: (overrideData) => {
        set((state) => {
          // Remove existing override for same page/scope
          const filtered = state.pageOrderOverrides.filter(
            (o) => !(o.pageNumber === overrideData.pageNumber && o.scope === overrideData.scope)
          );
          
          return {
            pageOrderOverrides: [...filtered, { ...overrideData, createdAt: new Date().toISOString() }],
            undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
          };
        });
      },

      getPageOrderOverride: (pageNumber) => {
        return get().pageOrderOverrides.find((o) => o.pageNumber === pageNumber);
      },

      deletePageOrderOverride: (pageNumber) => {
        set((state) => ({
          pageOrderOverrides: state.pageOrderOverrides.filter((o) => o.pageNumber !== pageNumber),
          undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
        }));
      },

      applyOverrides: (baseWords) => {
        const overrides = get().userOverrides;
        
        // Create a map of overrides by key
        const overrideMap = new Map<string, UserWordOverride>();
        overrides.forEach((o) => {
          if (o.operation !== 'delete') {
            overrideMap.set(o.key, o);
          }
        });
        
        // Deleted keys
        const deletedKeys = new Set(
          overrides.filter((o) => o.operation === 'delete').map((o) => o.key)
        );
        
        // Apply edits and filter deletions
        const result = baseWords
          .filter((w) => !deletedKeys.has(w.uniqueKey))
          .map((w) => {
            const override = overrideMap.get(w.uniqueKey);
            if (override) {
              return {
                ...w,
                pageNumber: override.pageNumber ?? w.pageNumber,
                wordText: override.wordText ?? w.wordText,
                meaning: override.meaning ?? w.meaning,
                surahNumber: override.surahNumber ?? w.surahNumber,
                verseNumber: override.verseNumber ?? w.verseNumber,
                wordIndex: override.wordIndex ?? w.wordIndex,
                surahName: override.surahName ?? w.surahName,
              };
            }
            return w;
          });
        
        // Add new entries (operation === 'add')
        const addedEntries = overrides
          .filter((o) => o.operation === 'add')
          .map((o): GhareebWord => ({
            pageNumber: o.pageNumber ?? 1,
            wordText: o.wordText ?? '',
            meaning: o.meaning ?? '',
            surahNumber: o.surahNumber ?? 1,
            verseNumber: o.verseNumber ?? 1,
            wordIndex: o.wordIndex ?? 0,
            surahName: o.surahName ?? '',
            order: 0,
            uniqueKey: o.key,
          }));
        
        return [...result, ...addedEntries];
      },

      importOverrides: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.overrides && Array.isArray(data.overrides)) {
            set((state) => ({
              userOverrides: [...state.userOverrides, ...data.overrides],
              pageOrderOverrides: data.pageOrders ? [...state.pageOrderOverrides, ...data.pageOrders] : state.pageOrderOverrides,
              undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
            }));
            return { success: true, count: data.overrides.length };
          }
          return { success: false, count: 0 };
        } catch {
          return { success: false, count: 0 };
        }
      },

      exportOverrides: () => {
        const { userOverrides, pageOrderOverrides } = get();
        return JSON.stringify({
          version: '1.0',
          exportedAt: new Date().toISOString(),
          overrides: userOverrides,
          pageOrders: pageOrderOverrides,
        }, null, 2);
      },

      undo: () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return;
        
        const previousState = undoStack[undoStack.length - 1];
        set({
          userOverrides: previousState.overrides,
          pageOrderOverrides: previousState.orders,
          undoStack: undoStack.slice(0, -1),
        });
      },

      canUndo: () => get().undoStack.length > 0,

      resetAll: () => {
        set((state) => ({
          userOverrides: [],
          pageOrderOverrides: [],
          undoStack: [...state.undoStack, { overrides: state.userOverrides, orders: state.pageOrderOverrides }].slice(-10),
        }));
      },
    }),
    {
      name: 'quran-app-data-overrides',
    }
  )
);
