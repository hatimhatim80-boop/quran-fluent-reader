export interface Surah {
  name: string;
  verses: Verse[];
}

export interface Verse {
  surahName: string;
  verseNumber: number;
  text: string;
}

export interface GhareebWord {
  surahName: string;
  verseNumber: number;
  wordText: string;
  meaning: string;
  order: number; // Order within the verse for auto-play
}

export interface SavedProgress {
  currentSurahIndex: number;
  currentVerseIndex: number;
  currentWordIndex: number;
}

// Legacy types for backward compatibility
export interface QuranPage {
  page_number: number;
  page_text: string;
}
