import { useState, useEffect, useMemo } from 'react';

/** A single word from quran.com API */
export interface QuranComWord {
  /** surah:ayah:position e.g. "1:1:1" */
  location: string;
  /** Uthmani text */
  text_uthmani: string;
  /** Line number on the page (1-15) */
  line_number: number;
  /** Position within the ayah */
  position: number;
  /** "word" or "end" (verse number marker) */
  char_type_name: string;
  /** Audio URL */
  audio_url: string | null;
}

/** Words grouped by line */
export interface PageLineWords {
  lineNumber: number;
  words: QuranComWord[];
}

/** Full page word data */
export interface QuranComPageData {
  page: number;
  lines: PageLineWords[];
  allWords: QuranComWord[];
}

const cache = new Map<number, QuranComPageData>();

/**
 * Fetch word-by-word data from quran.com API for a specific page.
 * Returns words grouped by line_number for precise overlay positioning.
 */
export function useQuranComWords(pageNumber: number, enabled: boolean = true) {
  const [data, setData] = useState<QuranComPageData | null>(cache.get(pageNumber) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    if (cache.has(pageNumber)) {
      setData(cache.get(pageNumber)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch all verses for this page with word details
    const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=line_number,text_uthmani,position,location&per_page=50`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;

        const allWords: QuranComWord[] = [];

        // Extract words from all verses
        for (const verse of json.verses || []) {
          for (const w of verse.words || []) {
            allWords.push({
              location: w.location,
              text_uthmani: w.text_uthmani,
              line_number: w.line_number,
              position: w.position,
              char_type_name: w.char_type_name,
              audio_url: w.audio_url,
            });
          }
        }

        // Group by line_number
        const lineMap = new Map<number, QuranComWord[]>();
        for (const w of allWords) {
          if (!lineMap.has(w.line_number)) {
            lineMap.set(w.line_number, []);
          }
          lineMap.get(w.line_number)!.push(w);
        }

        // Sort lines and words within lines by position
        const lines: PageLineWords[] = [];
        const sortedLineNumbers = [...lineMap.keys()].sort((a, b) => a - b);
        for (const ln of sortedLineNumbers) {
          const words = lineMap.get(ln)!;
          // Words are already in reading order (RTL), sort by position ascending
          words.sort((a, b) => a.position - b.position);
          lines.push({ lineNumber: ln, words });
        }

        const pageData: QuranComPageData = {
          page: pageNumber,
          lines,
          allWords,
        };

        cache.set(pageNumber, pageData);
        setData(pageData);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`[QuranComWords] Failed to load page ${pageNumber}:`, err.message);
        setError(err.message);
        setData(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, enabled]);

  return { data, loading, error };
}
