export interface QuranPage {
  pageNumber: number;
  text: string;
  surahName?: string; // First surah that appears on this page
}

export interface GhareebWord {
  pageNumber: number;
  wordText: string;
  meaning: string;
  surahName: string;
  verseNumber: number;
  order: number; // Order within the page for auto-play
}

export interface SavedProgress {
  currentPage: number;
  currentWordIndex: number;
}
