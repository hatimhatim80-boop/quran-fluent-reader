import { create } from 'zustand';
import { QuranPage, GhareebWord } from '@/types/quran';

export type DevDebugContextSource = 'reader' | 'full_page_editor' | 'validation' | 'other';

export interface DevDebugContext {
  source: DevDebugContextSource;
  page: QuranPage;
  pageNumber: number;
  ghareebWords: GhareebWord[];
  renderedWords: GhareebWord[];
  /** Optional hook to force a refresh/re-render after rebuild-from-source */
  invalidateCache?: () => void;
  /** All pages for global audit */
  allPages?: QuranPage[];
  /** Ghareeb page map for global audit */
  ghareebPageMap?: Map<number, GhareebWord[]>;
  /** Navigation callback */
  onNavigateToPage?: (pageNumber: number) => void;
}

interface DevDebugContextState {
  context: DevDebugContext | null;
  setContext: (context: DevDebugContext) => void;
}

export const useDevDebugContextStore = create<DevDebugContextState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}));
