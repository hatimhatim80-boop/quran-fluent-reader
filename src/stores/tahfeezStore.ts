import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Single word selection
export interface TahfeezWord {
  surahNumber: number;
  ayahNumber: number;
  wordIndex: number;
  originalWord: string;
  page: number;
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
    return `w_${w.surahNumber}_${w.ayahNumber}_${w.wordIndex}_${w.page}`;
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
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'full-ayah' | 'full-page' | 'ayah-count';
  setAutoBlankMode: (mode: TahfeezState['autoBlankMode']) => void;
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

  // Active tab in tahfeez page
  activeTab: 'store' | 'custom-quiz' | 'auto-quiz';
  setActiveTab: (tab: TahfeezState['activeTab']) => void;
}

export const useTahfeezStore = create<TahfeezState>()(
  persist(
    (set, get) => ({
      selectionMode: false,
      setSelectionMode: (on) => set({ selectionMode: on, rangeAnchor: null }),

      rangeAnchor: null,
      setRangeAnchor: (anchor) => set({ rangeAnchor: anchor }),

      storedItems: [],
      addItem: (item) => {
        const key = itemKey(item);
        const existing = get().storedItems;
        if (existing.some(i => itemKey(i) === key)) return;
        set({ storedItems: [...existing, item] });
      },
      removeItem: (key) => {
        set({ storedItems: get().storedItems.filter(i => itemKey(i) !== key) });
      },
      clearAllItems: () => set({ storedItems: [] }),
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
            // Word items use tokenIdx as wordIndex for non-ghareeb words
            return false; // handled separately in quiz view via matching
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

      activeTab: 'store',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'tahfeez.v2',
      partialize: (state) => ({
        storedItems: state.storedItems,
        quizSource: state.quizSource,
        autoBlankMode: state.autoBlankMode,
        blankCount: state.blankCount,
        ayahCount: state.ayahCount,
        timerSeconds: state.timerSeconds,
        firstWordTimerSeconds: state.firstWordTimerSeconds,
        revealMode: state.revealMode,
        activeTab: state.activeTab,
      }),
    }
  )
);
