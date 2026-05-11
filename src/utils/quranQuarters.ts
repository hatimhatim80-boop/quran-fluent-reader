/**
 * Quran "Arba'" (quarters of hizb) — 240 entries.
 * Source: pre-generated from tanzil-metadata.xml + quran-tanzil.txt at build time.
 * See public/data/quarters.json
 */
import quartersData from '@/data/quarters.json';

export interface QuranQuarter {
  quarter_global: number;     // 1..240
  juz: number;                // 1..30
  quarter_in_juz: number;     // 1..8
  hizb: number;               // 1..60
  quarter_in_hizb: number;    // 1..4
  surah: number;
  surah_name: string;
  ayah: number;
  page: number;
  start_words: string;        // first word(s) of the verse where the quarter begins
}

export const QURAN_QUARTERS: QuranQuarter[] = quartersData as QuranQuarter[];

export function getQuartersForJuz(juz: number): QuranQuarter[] {
  return QURAN_QUARTERS.filter((q) => q.juz === juz);
}

/**
 * Page range covered by a single quarter (start..end inclusive).
 * End = (next quarter's page - 1), or 604 for the last quarter.
 * Guarantees end >= start.
 */
export function getQuarterPageRange(q: QuranQuarter): { start: number; end: number } {
  const next = QURAN_QUARTERS.find((x) => x.quarter_global === q.quarter_global + 1);
  const start = q.page;
  const end = next ? Math.max(start, next.page - 1) : 604;
  return { start, end };
}
