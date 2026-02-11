import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TahfeezWord {
  surahNumber: number;
  ayahNumber: number;
  wordIndex: number;      // matches exact tokenization in PageView
  originalWord: string;
  page: number;
}

function wordKey(w: TahfeezWord): string {
  return `${w.surahNumber}_${w.ayahNumber}_${w.wordIndex}_${w.page}`;
}

interface TahfeezState {
  // Selection mode
  selectionMode: boolean;
  setSelectionMode: (on: boolean) => void;

  // Selected words
  selectedWords: TahfeezWord[];
  toggleWord: (word: TahfeezWord) => void;
  isSelected: (surahNumber: number, ayahNumber: number, wordIndex: number, page: number) => boolean;
  clearSelection: () => void;

  // Quiz settings
  quizSource: 'custom' | 'auto';
  setQuizSource: (src: 'custom' | 'auto') => void;
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'full-ayah' | 'full-page';
  setAutoBlankMode: (mode: TahfeezState['autoBlankMode']) => void;
  blankCount: number;
  setBlankCount: (n: number) => void;
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  revealMode: 'all' | 'gradual';
  setRevealMode: (m: 'all' | 'gradual') => void;
}

export const useTahfeezStore = create<TahfeezState>()(
  persist(
    (set, get) => ({
      selectionMode: false,
      setSelectionMode: (on) => set({ selectionMode: on }),

      selectedWords: [],
      toggleWord: (word) => {
        const key = wordKey(word);
        const existing = get().selectedWords;
        const idx = existing.findIndex(w => wordKey(w) === key);
        if (idx >= 0) {
          set({ selectedWords: existing.filter((_, i) => i !== idx) });
        } else {
          set({ selectedWords: [...existing, word] });
        }
      },
      isSelected: (surahNumber, ayahNumber, wordIndex, page) => {
        return get().selectedWords.some(
          w => w.surahNumber === surahNumber && w.ayahNumber === ayahNumber && w.wordIndex === wordIndex && w.page === page
        );
      },
      clearSelection: () => set({ selectedWords: [] }),

      quizSource: 'custom',
      setQuizSource: (src) => set({ quizSource: src }),
      autoBlankMode: 'end',
      setAutoBlankMode: (mode) => set({ autoBlankMode: mode }),
      blankCount: 3,
      setBlankCount: (n) => set({ blankCount: n }),
      timerSeconds: 10,
      setTimerSeconds: (s) => set({ timerSeconds: s }),
      revealMode: 'all',
      setRevealMode: (m) => set({ revealMode: m }),
    }),
    {
      name: 'tahfeez.selectedWords.v1',
    }
  )
);
