/**
 * Quran "Arba'" (quarters of hizb) — 240 entries.
 * Source: pre-generated from tanzil-metadata.xml + quran-tanzil.txt at build time.
 * See public/data/quarters.json
 */
import quartersData from '../../public/data/quarters.json';

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
