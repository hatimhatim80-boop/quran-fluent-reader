import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

// IndexedDB-based storage for better persistence in Capacitor/WebView
const DB_NAME = 'tahfeez-persist';
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
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const value = await db.get(STORE_NAME, name);
      return (value as string) ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch {
      localStorage.setItem(name, value);
    }
    try { localStorage.setItem(name, value); } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, name);
    } catch {}
    try { localStorage.removeItem(name); } catch {}
  },
};

// Single word selection
export interface TahfeezWord {
  surahNumber: number;
  ayahNumber: number;
  wordIndex: number;
  originalWord: string;
  page: number;
  lineIdx?: number;
}

// Phrase (range) selection
export interface TahfeezPhrase {
  surahNumber: number;
  ayahNumber: number;
  startWordIndex: number;
  endWordIndex: number;
  originalText: string;
  page: number;
  lineIdx: number;
}

export type TahfeezItem = 
  | { type: 'word'; data: TahfeezWord }
  | { type: 'phrase'; data: TahfeezPhrase };

function itemKey(item: TahfeezItem): string {
  if (item.type === 'word') {
    const w = item.data;
    return `w_${w.surahNumber}_${w.ayahNumber}_${w.wordIndex}_${w.page}_${w.lineIdx ?? ''}`;
  } else {
    const p = item.data;
    return `p_${p.surahNumber}_${p.ayahNumber}_${p.startWordIndex}_${p.endWordIndex}_${p.page}`;
  }
}

interface TahfeezState {
  // Selection mode
  selectionMode: boolean;
  setSelectionMode: (on: boolean) => void;

  // Range selection anchor (first click of a range)
  rangeAnchor: { lineIdx: number; tokenIdx: number; surahNumber: number; ayahNumber: number; page: number } | null;
  setRangeAnchor: (anchor: TahfeezState['rangeAnchor']) => void;

  // Stored items (words + phrases)
  storedItems: TahfeezItem[];
  addItem: (item: TahfeezItem) => void;
  removeItem: (key: string) => void;
  clearAllItems: () => void;
  getItemKey: (item: TahfeezItem) => string;

  // Undo history
  undoStack: TahfeezItem[][];
  undo: () => void;
  canUndo: boolean;

  // Legacy compat
  selectedWords: TahfeezWord[];
  toggleWord: (word: TahfeezWord) => void;
  isSelected: (surahNumber: number, ayahNumber: number, wordIndex: number, page: number) => boolean;
  clearSelection: () => void;

  // Check if a token position is blanked by any stored item
  isTokenBlanked: (page: number, lineIdx: number, tokenIdx: number) => boolean;

  // Quiz settings
  quizSource: 'custom' | 'auto';
  setQuizSource: (src: 'custom' | 'auto') => void;
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'beginning-middle' | 'middle-end' | 'beginning-end' | 'beginning-middle-end' | 'full-ayah' | 'full-page' | 'ayah-count' | 'between-waqf' | 'waqf-to-ayah' | 'ayah-to-waqf' | 'next-ayah-mcq' | 'next-waqf-mcq';
  setAutoBlankMode: (mode: TahfeezState['autoBlankMode']) => void;
  waqfCombinedModes: ('between-waqf' | 'waqf-to-ayah' | 'ayah-to-waqf' | 'between-ayah')[];
  setWaqfCombinedModes: (modes: TahfeezState['waqfCombinedModes']) => void;

  // Quiz scope
  quizScope: 'current-page' | 'page-range' | 'hizb' | 'surah' | 'juz';
  setQuizScope: (scope: TahfeezState['quizScope']) => void;
  quizScopeFrom: number;
  setQuizScopeFrom: (n: number) => void;
  quizScopeTo: number;
  setQuizScopeTo: (n: number) => void;
  blankCount: number;
  setBlankCount: (n: number) => void;
  ayahCount: number;
  setAyahCount: (n: number) => void;
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  firstWordTimerSeconds: number;
  setFirstWordTimerSeconds: (s: number) => void;
  revealMode: 'all' | 'gradual';
  setRevealMode: (m: 'all' | 'gradual') => void;

  // Voice recognition mode
  voiceMode: boolean;
  setVoiceMode: (on: boolean) => void;

  // Match threshold level
  matchLevel: 'strict' | 'medium' | 'loose';
  setMatchLevel: (level: TahfeezState['matchLevel']) => void;

  // Revealed word color
  revealedColor: 'green' | 'blue' | 'orange' | 'purple' | 'primary';
  setRevealedColor: (color: TahfeezState['revealedColor']) => void;

  // Whether revealed words show with background highlight or text-only
  revealedWithBg: boolean;
  setRevealedWithBg: (on: boolean) => void;

  // Active word (currently being revealed) color
  activeWordColor: 'gold' | 'green' | 'blue' | 'orange' | 'purple' | 'red';
  setActiveWordColor: (color: TahfeezState['activeWordColor']) => void;

  // Single word mode: only show one word at a time
  singleWordMode: boolean;
  setSingleWordMode: (on: boolean) => void;

  // Active tab in tahfeez page
  activeTab: 'store' | 'custom-quiz' | 'auto-quiz';
  setActiveTab: (tab: TahfeezState['activeTab']) => void;

  // Quiz interaction mode: auto-reveal (timer/voice) or mcq (multiple choice)
  quizInteraction: 'auto-reveal' | 'auto-tap' | 'tap-only' | 'mcq';
  setQuizInteraction: (mode: TahfeezState['quizInteraction']) => void;

  // MCQ display mode: panel (separate panel below) or inline (choices at blank position)
  mcqDisplayMode: 'panel' | 'inline';
  setMcqDisplayMode: (mode: TahfeezState['mcqDisplayMode']) => void;

  // MCQ panel position: top (above page) or bottom (below page)
  mcqPanelPosition: 'top' | 'bottom';
  setMcqPanelPosition: (pos: TahfeezState['mcqPanelPosition']) => void;

  // Dot scale for blanks (0.5 to 2.0)
  dotScale: number;
  setDotScale: (s: number) => void;

  // Reveal granularity: word-by-word, ayah-at-once, or waqf-segment-at-once
  revealGranularity: 'word' | 'ayah' | 'waqf-segment';
  setRevealGranularity: (g: TahfeezState['revealGranularity']) => void;

  // Segment MCQ inline mode: show choices on the Quran page
  segmentMcqInline: boolean;
  setSegmentMcqInline: (on: boolean) => void;

  // Show MCQ choices at the blank location (inline popover)
  segmentMcqChoicesAtBlank: boolean;
  setSegmentMcqChoicesAtBlank: (on: boolean) => void;

  // Segment MCQ timing: delay after correct/wrong answer before advancing (seconds)
  segmentMcqCorrectDelay: number;
  setSegmentMcqCorrectDelay: (s: number) => void;
  segmentMcqWrongDelay: number;
  setSegmentMcqWrongDelay: (s: number) => void;

  // Segment MCQ random order
  segmentMcqRandomOrder: boolean;
  setSegmentMcqRandomOrder: (on: boolean) => void;

  // Segment MCQ multi-page (continue across pages)
  segmentMcqMultiPage: boolean;
  setSegmentMcqMultiPage: (on: boolean) => void;

  // Duration to keep segment hidden before showing choices
  segmentMcqBlankDuration: number;
  setSegmentMcqBlankDuration: (s: number) => void;

  // Waqf display mode when blanking
  waqfDisplayMode: 'with-word' | 'sign-only';
  setWaqfDisplayMode: (mode: TahfeezState['waqfDisplayMode']) => void;
}

export const useTahfeezStore = create<TahfeezState>()(
  persist(
    (set, get) => ({
      selectionMode: false,
      setSelectionMode: (on) => set({ selectionMode: on, rangeAnchor: null }),

      rangeAnchor: null,
      setRangeAnchor: (anchor) => set({ rangeAnchor: anchor }),

      storedItems: [],
      undoStack: [],
      canUndo: false,
      addItem: (item) => {
        const key = itemKey(item);
        const existing = get().storedItems;
        if (existing.some(i => itemKey(i) === key)) return;
        const stack = get().undoStack;
        set({ storedItems: [...existing, item], undoStack: [...stack, existing], canUndo: true });
      },
      removeItem: (key) => {
        const existing = get().storedItems;
        const stack = get().undoStack;
        set({ storedItems: existing.filter(i => itemKey(i) !== key), undoStack: [...stack, existing], canUndo: true });
      },
      clearAllItems: () => {
        const existing = get().storedItems;
        const stack = get().undoStack;
        set({ storedItems: [], undoStack: [...stack, existing], canUndo: true });
      },
      undo: () => {
        const stack = get().undoStack;
        if (stack.length === 0) return;
        const prev = stack[stack.length - 1];
        set({ storedItems: prev, undoStack: stack.slice(0, -1), canUndo: stack.length > 1 });
      },
      getItemKey: itemKey,

      // Legacy
      selectedWords: [],
      toggleWord: (word) => {
        const key = `w_${word.surahNumber}_${word.ayahNumber}_${word.wordIndex}_${word.page}`;
        const existing = get().storedItems;
        const idx = existing.findIndex(i => itemKey(i) === key);
        if (idx >= 0) {
          set({ storedItems: existing.filter((_, i) => i !== idx) });
        } else {
          set({ storedItems: [...existing, { type: 'word', data: word }] });
        }
      },
      isSelected: (surahNumber, ayahNumber, wordIndex, page) => {
        return get().storedItems.some(item => {
          if (item.type === 'word') {
            const w = item.data;
            return w.surahNumber === surahNumber && w.ayahNumber === ayahNumber && w.wordIndex === wordIndex && w.page === page;
          }
          return false;
        });
      },
      clearSelection: () => set({ storedItems: [] }),

      isTokenBlanked: (page, lineIdx, tokenIdx) => {
        return get().storedItems.some(item => {
          if (item.data.page !== page) return false;
          if (item.type === 'word') {
            return false;
          } else {
            const p = item.data;
            return p.lineIdx === lineIdx && tokenIdx >= p.startWordIndex && tokenIdx <= p.endWordIndex;
          }
        });
      },

      quizSource: 'custom',
      setQuizSource: (src) => set({ quizSource: src }),
      autoBlankMode: 'end',
      setAutoBlankMode: (mode) => set({ autoBlankMode: mode }),
      waqfCombinedModes: [],
      setWaqfCombinedModes: (modes) => set({ waqfCombinedModes: modes }),
      blankCount: 3,
      setBlankCount: (n) => set({ blankCount: n }),
      ayahCount: 1,
      setAyahCount: (n) => set({ ayahCount: n }),
      timerSeconds: 10,
      setTimerSeconds: (s) => set({ timerSeconds: s }),
      firstWordTimerSeconds: 15,
      setFirstWordTimerSeconds: (s) => set({ firstWordTimerSeconds: s }),
      revealMode: 'all',
      setRevealMode: (m) => set({ revealMode: m }),

      quizScope: 'current-page',
      setQuizScope: (scope) => set({ quizScope: scope }),
      quizScopeFrom: 1,
      setQuizScopeFrom: (n) => set({ quizScopeFrom: n }),
      quizScopeTo: 1,
      setQuizScopeTo: (n) => set({ quizScopeTo: n }),

      voiceMode: false,
      setVoiceMode: (on) => set({ voiceMode: on }),

      matchLevel: 'medium',
      setMatchLevel: (level) => set({ matchLevel: level }),

      revealedColor: 'green',
      setRevealedColor: (color) => set({ revealedColor: color }),

      revealedWithBg: true,
      setRevealedWithBg: (on) => set({ revealedWithBg: on }),

      activeWordColor: 'gold',
      setActiveWordColor: (color) => set({ activeWordColor: color }),

      singleWordMode: false,
      setSingleWordMode: (on) => set({ singleWordMode: on }),

      activeTab: 'store',
      setActiveTab: (tab) => set({ activeTab: tab }),

      quizInteraction: 'auto-reveal',
      setQuizInteraction: (mode) => set({ quizInteraction: mode }),

      mcqDisplayMode: 'panel',
      setMcqDisplayMode: (mode) => set({ mcqDisplayMode: mode }),

      mcqPanelPosition: 'bottom',
      setMcqPanelPosition: (pos) => set({ mcqPanelPosition: pos }),

      dotScale: 1,
      setDotScale: (s) => set({ dotScale: s }),

      revealGranularity: 'word',
      setRevealGranularity: (g) => set({ revealGranularity: g }),

      segmentMcqInline: false,
      setSegmentMcqInline: (on) => set({ segmentMcqInline: on }),

      segmentMcqChoicesAtBlank: false,
      setSegmentMcqChoicesAtBlank: (on) => set({ segmentMcqChoicesAtBlank: on }),

      segmentMcqCorrectDelay: 10,
      setSegmentMcqCorrectDelay: (s) => set({ segmentMcqCorrectDelay: s }),
      segmentMcqWrongDelay: 10,
      setSegmentMcqWrongDelay: (s) => set({ segmentMcqWrongDelay: s }),

      segmentMcqRandomOrder: false,
      setSegmentMcqRandomOrder: (on) => set({ segmentMcqRandomOrder: on }),

      segmentMcqMultiPage: false,
      setSegmentMcqMultiPage: (on) => set({ segmentMcqMultiPage: on }),

      segmentMcqBlankDuration: 0,
      setSegmentMcqBlankDuration: (s) => set({ segmentMcqBlankDuration: s }),

      waqfDisplayMode: 'with-word',
      setWaqfDisplayMode: (mode) => set({ waqfDisplayMode: mode }),
    }),
    {
      name: 'tahfeez.v2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        storedItems: state.storedItems,
        quizSource: state.quizSource,
        autoBlankMode: state.autoBlankMode,
        waqfCombinedModes: state.waqfCombinedModes,
        blankCount: state.blankCount,
        ayahCount: state.ayahCount,
        timerSeconds: state.timerSeconds,
        firstWordTimerSeconds: state.firstWordTimerSeconds,
        revealMode: state.revealMode,
        activeTab: state.activeTab,
        voiceMode: state.voiceMode,
        matchLevel: state.matchLevel,
        revealedColor: state.revealedColor,
        revealedWithBg: state.revealedWithBg,
        activeWordColor: state.activeWordColor,
        singleWordMode: state.singleWordMode,
        quizScope: state.quizScope,
        quizScopeFrom: state.quizScopeFrom,
        quizScopeTo: state.quizScopeTo,
        quizInteraction: state.quizInteraction,
        mcqDisplayMode: state.mcqDisplayMode,
        mcqPanelPosition: state.mcqPanelPosition,
        dotScale: state.dotScale,
        revealGranularity: state.revealGranularity,
        segmentMcqInline: state.segmentMcqInline,
        segmentMcqChoicesAtBlank: state.segmentMcqChoicesAtBlank,
        segmentMcqCorrectDelay: state.segmentMcqCorrectDelay,
        segmentMcqWrongDelay: state.segmentMcqWrongDelay,
        segmentMcqRandomOrder: state.segmentMcqRandomOrder,
        segmentMcqMultiPage: state.segmentMcqMultiPage,
        segmentMcqBlankDuration: state.segmentMcqBlankDuration,
      }),
    }
  )
);
