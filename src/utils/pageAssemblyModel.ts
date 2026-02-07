/**
 * Page Assembly Model - Single Source of Truth for Quran Pages
 * 
 * This module handles the critical task of assembling pages correctly,
 * supporting pages that span multiple surahs (e.g., page 583 contains
 * end of An-Naba (78) AND beginning of An-Nazi'at (79)).
 */

import { QuranPage, GhareebWord } from '@/types/quran';
import { loadTanzilPageIndex } from './tanzilPageIndex';

// Surah names indexed by number
export const SURAH_NAMES: Record<number, string> = {
  1: 'الفاتحة', 2: 'البقرة', 3: 'آل عمران', 4: 'النساء', 5: 'المائدة',
  6: 'الأنعام', 7: 'الأعراف', 8: 'الأنفال', 9: 'التوبة', 10: 'يونس',
  11: 'هود', 12: 'يوسف', 13: 'الرعد', 14: 'إبراهيم', 15: 'الحجر',
  16: 'النحل', 17: 'الإسراء', 18: 'الكهف', 19: 'مريم', 20: 'طه',
  21: 'الأنبياء', 22: 'الحج', 23: 'المؤمنون', 24: 'النور', 25: 'الفرقان',
  26: 'الشعراء', 27: 'النمل', 28: 'القصص', 29: 'العنكبوت', 30: 'الروم',
  31: 'لقمان', 32: 'السجدة', 33: 'الأحزاب', 34: 'سبأ', 35: 'فاطر',
  36: 'يس', 37: 'الصافات', 38: 'ص', 39: 'الزمر', 40: 'غافر',
  41: 'فصلت', 42: 'الشورى', 43: 'الزخرف', 44: 'الدخان', 45: 'الجاثية',
  46: 'الأحقاف', 47: 'محمد', 48: 'الفتح', 49: 'الحجرات', 50: 'ق',
  51: 'الذاريات', 52: 'الطور', 53: 'النجم', 54: 'القمر', 55: 'الرحمن',
  56: 'الواقعة', 57: 'الحديد', 58: 'المجادلة', 59: 'الحشر', 60: 'الممتحنة',
  61: 'الصف', 62: 'الجمعة', 63: 'المنافقون', 64: 'التغابن', 65: 'الطلاق',
  66: 'التحريم', 67: 'الملك', 68: 'القلم', 69: 'الحاقة', 70: 'المعارج',
  71: 'نوح', 72: 'الجن', 73: 'المزمل', 74: 'المدثر', 75: 'القيامة',
  76: 'الإنسان', 77: 'المرسلات', 78: 'النبأ', 79: 'النازعات', 80: 'عبس',
  81: 'التكوير', 82: 'الانفطار', 83: 'المطففين', 84: 'الانشقاق', 85: 'البروج',
  86: 'الطارق', 87: 'الأعلى', 88: 'الغاشية', 89: 'الفجر', 90: 'البلد',
  91: 'الشمس', 92: 'الليل', 93: 'الضحى', 94: 'الشرح', 95: 'التين',
  96: 'العلق', 97: 'القدر', 98: 'البينة', 99: 'الزلزلة', 100: 'العاديات',
  101: 'القارعة', 102: 'التكاثر', 103: 'العصر', 104: 'الهمزة', 105: 'الفيل',
  106: 'قريش', 107: 'الماعون', 108: 'الكوثر', 109: 'الكافرون', 110: 'النصر',
  111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس'
};

// Verse counts for each surah
export const VERSE_COUNTS: Record<number, number> = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
  11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
  21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
  31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
  41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
  51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
  61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
  71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
  81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
  91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
  101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
  111: 5, 112: 4, 113: 5, 114: 6
};

/**
 * Represents a verse segment on a page
 */
export interface VerseSegment {
  surah: number;
  ayah: number;
  text: string;
}

/**
 * Represents a complete page with its verse segments
 * A page may contain verses from multiple surahs
 */
export interface PageSegments {
  pageNumber: number;
  segments: VerseSegment[];
  firstSurah: number;
  lastSurah: number;
  firstAyah: number;
  lastAyah: number;
  hasSurahTransition: boolean;
}

/**
 * Page completeness issue types
 */
export type PageIssueType = 
  | 'missing_verses'
  | 'surah_boundary_drop'
  | 'wrong_page_assignment'
  | 'extra_verses';

export interface PageIssue {
  pageNumber: number;
  type: PageIssueType;
  description: string;
  expected: string;
  actual: string;
  missingVerses?: { surah: number; ayah: number }[];
  extraVerses?: { surah: number; ayah: number }[];
}

// Cache for parsed ayahs
let parsedAyahsCache: Map<string, VerseSegment> | null = null;

/**
 * Parse Tanzil format text into verse segments
 */
export function parseTanzilToSegments(tanzilText: string): Map<string, VerseSegment> {
  if (parsedAyahsCache) return parsedAyahsCache;
  
  const segments = new Map<string, VerseSegment>();
  const lines = tanzilText.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 3) continue;
    
    const surah = parseInt(parts[0], 10);
    const ayah = parseInt(parts[1], 10);
    const text = parts.slice(2).join('|');
    
    if (!isNaN(surah) && !isNaN(ayah)) {
      const key = `${surah}_${ayah}`;
      segments.set(key, { surah, ayah, text });
    }
  }
  
  parsedAyahsCache = segments;
  return segments;
}

/**
 * Get the expected verses for a given page based on Tanzil page index
 * This is the CRITICAL function that correctly handles multi-surah pages
 */
export async function getExpectedPageContent(
  pageNumber: number,
  tanzilText: string
): Promise<PageSegments> {
  const pageIndex = await loadTanzilPageIndex();
  const allVerses = parseTanzilToSegments(tanzilText);
  
  // Get start of this page
  const pageStart = pageIndex[pageNumber - 1]; // [surah, ayah]
  const startSurah = pageStart[0];
  const startAyah = pageStart[1];
  
  // Get start of next page to determine end
  const nextPageStart = pageNumber < 604 ? pageIndex[pageNumber] : null;
  
  const segments: VerseSegment[] = [];
  let currentSurah = startSurah;
  let currentAyah = startAyah;
  
  // Iterate through verses until we reach the next page
  while (true) {
    // Check if we've reached the next page's start
    if (nextPageStart) {
      const [nextSurah, nextAyah] = nextPageStart;
      if (currentSurah > nextSurah || 
          (currentSurah === nextSurah && currentAyah >= nextAyah)) {
        break;
      }
    }
    
    const key = `${currentSurah}_${currentAyah}`;
    const verse = allVerses.get(key);
    
    if (verse) {
      segments.push(verse);
    }
    
    // Move to next ayah
    currentAyah++;
    
    // Check if we need to move to next surah
    const maxAyah = VERSE_COUNTS[currentSurah] || 0;
    if (currentAyah > maxAyah) {
      currentSurah++;
      currentAyah = 1;
      
      // Stop if we've gone past all surahs
      if (currentSurah > 114) break;
    }
    
    // Safety check for last page
    if (!nextPageStart && segments.length > 100) break;
  }
  
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  
  return {
    pageNumber,
    segments,
    firstSurah: firstSegment?.surah || startSurah,
    lastSurah: lastSegment?.surah || startSurah,
    firstAyah: firstSegment?.ayah || startAyah,
    lastAyah: lastSegment?.ayah || 1,
    hasSurahTransition: firstSegment?.surah !== lastSegment?.surah,
  };
}

/**
 * Build page text from segments, properly handling surah transitions
 */
export function buildPageText(pageSegments: PageSegments): string {
  const lines: string[] = [];
  let currentSurah = -1;
  
  for (const segment of pageSegments.segments) {
    // Add surah header when transitioning to a new surah
    if (segment.surah !== currentSurah) {
      currentSurah = segment.surah;
      
      // Add surah header (except for Al-Fatiha which is on page 1)
      if (segment.ayah === 1 && segment.surah !== 1) {
        lines.push(`سورة ${SURAH_NAMES[segment.surah]}`);
        // Add bismillah for surahs except Al-Fatiha and At-Tawbah
        if (segment.surah !== 9) {
          lines.push('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ');
        }
      }
    }
    
    // Add verse text with number marker
    lines.push(`${segment.text} ﴿${segment.ayah}﴾`);
  }
  
  return lines.join('\n');
}

/**
 * Validate a page's content against expected verses
 */
export async function validatePageCompleteness(
  pageNumber: number,
  actualPageText: string,
  tanzilText: string
): Promise<PageIssue[]> {
  const issues: PageIssue[] = [];
  const expected = await getExpectedPageContent(pageNumber, tanzilText);
  
  // Extract verse markers from actual text
  const actualVerseMarkers = new Set<string>();
  const markerRegex = /﴿(\d+)﴾/g;
  let match;
  
  while ((match = markerRegex.exec(actualPageText)) !== null) {
    actualVerseMarkers.add(match[1]);
  }
  
  // Check for missing verses
  const missingVerses: { surah: number; ayah: number }[] = [];
  
  for (const segment of expected.segments) {
    const ayahStr = segment.ayah.toString();
    // Simple check - verse number should appear
    if (!actualVerseMarkers.has(ayahStr)) {
      missingVerses.push({ surah: segment.surah, ayah: segment.ayah });
    }
  }
  
  if (missingVerses.length > 0) {
    issues.push({
      pageNumber,
      type: 'missing_verses',
      description: `الصفحة تفتقد ${missingVerses.length} آية`,
      expected: `آيات من ${expected.firstSurah}:${expected.firstAyah} إلى ${expected.lastSurah}:${expected.lastAyah}`,
      actual: `تم العثور على ${actualVerseMarkers.size} آية فقط`,
      missingVerses,
    });
  }
  
  // Check for surah boundary issues
  if (expected.hasSurahTransition) {
    const surahHeaders = actualPageText.match(/سورة\s+\S+/g) || [];
    const expectedHeaders = new Set<number>();
    
    for (const segment of expected.segments) {
      if (segment.ayah === 1 && segment.surah !== 1) {
        expectedHeaders.add(segment.surah);
      }
    }
    
    if (surahHeaders.length < expectedHeaders.size) {
      issues.push({
        pageNumber,
        type: 'surah_boundary_drop',
        description: 'انتقال سورة مفقود',
        expected: `يجب أن تحتوي على ${expectedHeaders.size} عنوان سورة`,
        actual: `تم العثور على ${surahHeaders.length} فقط`,
      });
    }
  }
  
  return issues;
}

/**
 * Scan all pages for completeness issues
 */
export async function scanAllPagesForIssues(
  pages: QuranPage[],
  tanzilText: string,
  onProgress?: (page: number, total: number) => void
): Promise<PageIssue[]> {
  const allIssues: PageIssue[] = [];
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const issues = await validatePageCompleteness(page.pageNumber, page.text, tanzilText);
    allIssues.push(...issues);
    
    onProgress?.(i + 1, pages.length);
  }
  
  return allIssues;
}

/**
 * Get debug info for a page
 */
export async function getPageDebugInfo(
  pageNumber: number,
  tanzilText: string
): Promise<{
  firstVerse: string;
  lastVerse: string;
  segmentsList: string[];
  totalVerses: number;
  hasSurahTransition: boolean;
  surahs: number[];
}> {
  const expected = await getExpectedPageContent(pageNumber, tanzilText);
  
  const surahs = [...new Set(expected.segments.map(s => s.surah))];
  
  return {
    firstVerse: `${expected.firstSurah}:${expected.firstAyah}`,
    lastVerse: `${expected.lastSurah}:${expected.lastAyah}`,
    segmentsList: expected.segments.map(s => `${s.surah}:${s.ayah}`),
    totalVerses: expected.segments.length,
    hasSurahTransition: expected.hasSurahTransition,
    surahs,
  };
}
