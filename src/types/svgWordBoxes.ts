/** Bounding box for a single word (normalized 0..1 relative to viewBox) */
export interface WordBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A single word entry with its position key and bounding box */
export interface SvgWordEntry {
  /** Position key: surah:ayah:wordIndex */
  key: string;
  /** The Arabic word text */
  text: string;
  /** Normalized bounding box */
  box: WordBox;
}

/** Full page data with SVG word boxes */
export interface SvgPageData {
  page: number;
  viewBox: { w: number; h: number };
  words: SvgWordEntry[];
  debug?: {
    wordsCount: number;
    boxesCount: number;
  };
}

/** Page word entry for the layout/ordering file */
export interface PageWordEntry {
  key: string;
  text: string;
}

/** Full page words layout */
export interface PageWordsLayout {
  page: number;
  words: PageWordEntry[];
}
