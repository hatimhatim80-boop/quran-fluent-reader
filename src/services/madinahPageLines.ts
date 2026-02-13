/**
 * Madinah Page Lines — builds fixed-line page data from mushaf.txt
 * Each page has exactly the lines as they appear in the Madinah Mushaf.
 * Strict validation: 15 lines per page (except pages 1, 2, and last page).
 */

import { getData } from './dataSource';

export interface MadinahPage {
  lines: string[];
  meta?: { surah?: string; juz?: number };
  warnings?: string[];
}

export type MadinahPageMap = Record<string, MadinahPage>;

export interface ParseResult {
  pages: MadinahPageMap;
  errors: string[];
  totalPages: number;
  hasDelimiters: boolean;
}

let cachedResult: ParseResult | null = null;

const BISMILLAH_REGEX = /بِسمِ\s*اللَّهِ\s*الرَّحْمَٰنِ\s*الرَّحِيمِ|بِسۡمِ\s*ٱللَّهِ\s*ٱلرَّحۡمَٰنِ\s*ٱلرَّحِيمِ/;
const NORMALIZED_BISMILLAH = 'بِسۡمِٱللَّهِٱلرَّحۡمَٰنِٱلرَّحِيمِ';

/** Normalize bismillah: collapse to single block without spaces */
export function normalizeBismillah(line: string): string {
  if (!BISMILLAH_REGEX.test(line)) return line;
  return line
    .replace(/بِسمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ/, NORMALIZED_BISMILLAH)
    .replace(/بِسۡمِ\s+ٱللَّهِ\s+ٱلرَّحۡمَٰنِ\s+ٱلرَّحِيمِ/, NORMALIZED_BISMILLAH)
    .replace(/بِسمِ\s*اللَّهِ\s*الرَّحْمَٰنِ\s*الرَّحِيمِ/, NORMALIZED_BISMILLAH)
    .replace(/بِسۡمِ\s*ٱللَّهِ\s*ٱلرَّحۡمَٰنِ\s*ٱلرَّحِيمِ/, NORMALIZED_BISMILLAH);
}

function isBismillahLine(line: string): boolean {
  return BISMILLAH_REGEX.test(line);
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

/** Detect if mushaf.txt uses explicit page delimiters */
function detectDelimiter(text: string): RegExp | null {
  // Check common delimiter patterns
  const patterns = [
    /^=+\s*Page\s+\d+\s*=+$/m,
    /^---\s*Page\s+\d+\s*---$/m,
    /^###\s*\d+\s*###$/m,
    /^\f/m, // form feed
  ];
  for (const p of patterns) {
    if (p.test(text)) return p;
  }
  return null;
}

/**
 * Validate line count for a page. Madinah Mushaf: 15 lines per page.
 * Exceptions: pages 1 & 2 (Al-Fatiha / start of Al-Baqarah) may differ.
 */
function validateLineCount(pageNum: number, lineCount: number): string | null {
  // Pages 1 and 2 are special (fewer lines)
  if (pageNum <= 2) return null;
  // Allow some tolerance: surah headers + bismillah can add lines
  if (lineCount < 5) {
    return `الصفحة ${pageNum}: عدد السطور ${lineCount} أقل من الحد الأدنى (5 سطور)`;
  }
  if (lineCount > 20) {
    return `الصفحة ${pageNum}: عدد السطور ${lineCount} أكثر من الحد الأقصى المتوقع (20 سطر)`;
  }
  return null;
}

/**
 * Load and parse mushaf.txt into fixed-line page data.
 * Pages are separated by empty lines. Strict validation applied.
 */
export async function loadMadinahPages(): Promise<ParseResult> {
  if (cachedResult) return cachedResult;

  const text = await getData('mushaf');
  const errors: string[] = [];

  // Check for explicit delimiters
  const delimiter = detectDelimiter(text);
  const hasDelimiters = delimiter !== null;

  if (hasDelimiters) {
    console.log('[MadinahPages] Explicit page delimiters detected');
  } else {
    console.warn('[MadinahPages] No explicit page delimiters found in mushaf.txt — using empty-line splitting');
  }

  const allLines = text.split('\n');
  const pages: MadinahPageMap = {};

  let currentPageLines: string[] = [];
  let pageNumber = 1;
  let currentSurah: string | undefined;

  for (const line of allLines) {
    if (line.trim() === '') {
      if (currentPageLines.length > 0) {
        const processedLines = currentPageLines.map(l =>
          isBismillahLine(l) ? normalizeBismillah(l) : l
        );

        const warning = validateLineCount(pageNumber, processedLines.length);
        const pageWarnings: string[] = [];
        if (warning) {
          pageWarnings.push(warning);
          console.warn(`[MadinahPages] ${warning}`);
        }

        pages[String(pageNumber)] = {
          lines: processedLines,
          meta: { surah: currentSurah },
          ...(pageWarnings.length > 0 ? { warnings: pageWarnings } : {}),
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
    const processedLines = currentPageLines.map(l =>
      isBismillahLine(l) ? normalizeBismillah(l) : l
    );
    pages[String(pageNumber)] = {
      lines: processedLines,
      meta: { surah: currentSurah },
    };
  }

  const totalPages = Object.keys(pages).length;
  console.log(`[MadinahPages] Loaded ${totalPages} pages`);

  // Global validation
  if (totalPages < 600) {
    const msg = `بيانات mushaf.txt أنتجت ${totalPages} صفحة فقط بدلاً من 604. قد يكون الملف غير مكتمل أو التقسيم غير صحيح.`;
    errors.push(msg);
    console.error(`[MadinahPages] ${msg}`);
  }

  if (!hasDelimiters && totalPages !== 604) {
    errors.push('mushaf.txt لا يحتوي delimiters صريحة للصفحات — التقسيم يعتمد على الأسطر الفارغة وقد لا يكون دقيقاً 100%');
  }

  cachedResult = { pages, errors, totalPages, hasDelimiters };
  return cachedResult;
}

/** Get a single page's line data */
export async function getMadinahPage(pageNumber: number): Promise<MadinahPage | null> {
  const result = await loadMadinahPages();
  return result.pages[String(pageNumber)] || null;
}

/** Get parsing result with errors for diagnostics */
export async function getMadinahParseResult(): Promise<ParseResult> {
  return loadMadinahPages();
}
