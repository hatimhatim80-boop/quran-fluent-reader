/**
 * Madinah Page Lines — builds fixed-line page data from mushaf.txt
 * Each page has exactly the lines as they appear in the Madinah Mushaf.
 * No HTML wrapping. Lines are the single source of truth.
 */

import { getData } from './dataSource';

export interface MadinahPage {
  lines: string[];
  meta?: { surah?: string; juz?: number };
}

export type MadinahPageMap = Record<string, MadinahPage>;

let cachedPages: MadinahPageMap | null = null;

const BISMILLAH_REGEX = /بِسمِ\s*اللَّهِ\s*الرَّحْمَٰنِ\s*الرَّحِيمِ|بِسۡمِ\s*ٱللَّهِ\s*ٱلرَّحۡمَٰنِ\s*ٱلرَّحِيمِ/;

/** Normalize bismillah: remove all spaces between its words */
export function normalizeBismillah(line: string): string {
  if (!BISMILLAH_REGEX.test(line)) return line;
  // Remove spaces within the bismillah phrase only
  return line
    .replace(/بِسمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ/, 'بِسمِٱللَّهِٱلرَّحْمَٰنِٱلرَّحِيمِ')
    .replace(/بِسۡمِ\s+ٱللَّهِ\s+ٱلرَّحۡمَٰنِ\s+ٱلرَّحِيمِ/, 'بِسۡمِٱللَّهِٱلرَّحۡمَٰنِٱلرَّحِيمِ');
}

function isBismillahLine(line: string): boolean {
  return BISMILLAH_REGEX.test(line);
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

/**
 * Load and parse mushaf.txt into fixed-line page data.
 * Pages are separated by empty lines. Each non-empty line is one mushaf line.
 */
export async function loadMadinahPages(): Promise<MadinahPageMap> {
  if (cachedPages) return cachedPages;

  const text = await getData('mushaf');
  const allLines = text.split('\n');
  const pages: MadinahPageMap = {};

  let currentPageLines: string[] = [];
  let pageNumber = 1;
  let currentSurah: string | undefined;

  for (const line of allLines) {
    if (line.trim() === '') {
      if (currentPageLines.length > 0) {
        pages[String(pageNumber)] = {
          lines: currentPageLines.map(l => 
            isBismillahLine(l) ? normalizeBismillah(l) : l
          ),
          meta: { surah: currentSurah },
        };
        pageNumber++;
        currentPageLines = [];
      }
      continue;
    }

    if (isSurahHeader(line)) {
      currentSurah = line.trim().replace('سُورَةُ', '').replace('سورة ', '').trim();
    }

    currentPageLines.push(line);
  }

  // Last page
  if (currentPageLines.length > 0) {
    pages[String(pageNumber)] = {
      lines: currentPageLines.map(l =>
        isBismillahLine(l) ? normalizeBismillah(l) : l
      ),
      meta: { surah: currentSurah },
    };
  }

  console.log(`[MadinahPages] Loaded ${Object.keys(pages).length} pages`);
  cachedPages = pages;
  return pages;
}

/** Get a single page's line data */
export async function getMadinahPage(pageNumber: number): Promise<MadinahPage | null> {
  const pages = await loadMadinahPages();
  return pages[String(pageNumber)] || null;
}
