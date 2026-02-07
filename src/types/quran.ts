export interface QuranPage {
  pageNumber: number;
  text: string;
  surahName?: string; // First surah that appears on this page
}

export interface GhareebWord {
  pageNumber: number;
  wordText: string;      // The actual Quranic word (from raw field between ﴿﴾)
  meaning: string;       // The meaning/explanation
  surahName: string;
  surahNumber: number;   // Surah number for precise matching
  verseNumber: number;   // Ayah number for precise matching
  order: number;         // Order within the page for auto-play
  uniqueKey: string;     // Unique key: surah_ayah_wordIndex
}

export interface SavedProgress {
  currentPage: number;
  currentWordIndex: number;
}

// JSON schema types
export interface GhareebPageItem {
  surah: number;
  ayah: number;
  surah_name: string;
  word: string;          // This is actually the meaning in the JSON
  meaning: string;       // Usually empty
  raw: string;           // Contains the actual word between ﴿﴾
  page: number;
}

export interface GhareebPageData {
  page: number;
  start: { surah: number; ayah: number };
  end_exclusive: { surah: number; ayah: number };
  items: GhareebPageItem[];
}

export interface GhareebJsonData {
  schema: string;
  source: {
    ghareeb_file: string;
    pages_map: string;
    mushaf: string;
    page_count: number;
  };
  pages: GhareebPageData[];
}
