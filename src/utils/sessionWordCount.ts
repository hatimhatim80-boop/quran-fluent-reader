/**
 * Counts word tokens per page, matching TahfeezQuizView's tokenization logic.
 * Used to pre-compute total session items at session start.
 */

import { normalizeArabic } from '@/utils/quranParser';
import { QuranPage } from '@/types/quran';

const CLEAN_REGEX = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  const normalized = normalizeArabic(line);
  return normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله');
}

/** Count word tokens on a single page (matches TahfeezQuizView tokenization). */
export function countPageWordTokens(pageText: string, pageNumber: number): number {
  const lines = pageText.split('\n');
  const isFatihaPage = pageNumber === 1;
  let count = 0;

  for (const line of lines) {
    if (isSurahHeader(line)) continue;
    if (!isFatihaPage && isBismillah(line)) continue;

    const tokens = line.split(/(\s+)/);
    for (const t of tokens) {
      if (/^\s+$/.test(t)) continue;
      const clean = t.replace(CLEAN_REGEX, '').trim();
      if (/^[٠-٩0-9۰-۹]+$/.test(clean)) continue;
      if (clean.length === 0) continue;
      count++;
    }
  }
  return count;
}

/** 
 * Compute total word tokens across a range of pages.
 * Returns total count and per-page counts map.
 */
export function computeSessionTotalItems(
  pages: QuranPage[],
  pagesRange: number[]
): { total: number; perPage: Record<number, number> } {
  const perPage: Record<number, number> = {};
  let total = 0;
  for (const pn of pagesRange) {
    const page = pages.find(p => p.pageNumber === pn);
    if (!page) continue;
    const count = countPageWordTokens(page.text, pn);
    perPage[pn] = count;
    total += count;
  }
  return { total, perPage };
}
