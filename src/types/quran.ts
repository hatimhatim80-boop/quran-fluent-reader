export interface QuranPage {
  page_number: number;
  page_text: string;
}

export interface GhareebWord {
  page_number: number;
  order: number;
  word_text: string;
  meaning: string;
}

export interface SavedProgress {
  lastPage: number;
  lastWordIndex: number;
}
