import { GhareebWord } from '@/types/quran';
import { normalizeArabic } from './quranParser';

export type MismatchReason =
  | 'not_found_in_page'   // الكلمة غير موجودة في نص الصفحة
  | 'diacritic_mismatch'  // اختلاف تشكيل/رسم
  | 'page_number_off'     // الكلمة موجودة لكن في صفحة مختلفة
  | 'duplicate_match'     // تم مطابقتها لكلمة أخرى (نسخة مكررة)
  | 'partial_match'       // تطابق جزئي فقط
  | 'unknown';

export interface MismatchEntry {
  word: GhareebWord;
  reason: MismatchReason;
  detail: string;
  foundInPages?: number[]; // الصفحات التي وُجدت فيها فعلياً
}

export interface MatchingReport {
  totalGhareebWords: number;
  matchedCount: number;
  unmatchedCount: number;
  mismatches: MismatchEntry[];
  coveragePercent: number;
  generatedAt: string;
}

/**
 * يتحقق من تطابق كلمات الغريب مع نص المصحف
 * @param ghareebMap خريطة الكلمات الغريبة (من loadGhareebData)
 * @param pages صفحات المصحف
 */
export function validateMatching(
  ghareebMap: Map<number, GhareebWord[]>,
  pages: { pageNumber: number; text: string }[]
): MatchingReport {
  const allWords: GhareebWord[] = [];
  ghareebMap.forEach((words) => allWords.push(...words));

  const mismatches: MismatchEntry[] = [];
  let matchedCount = 0;

  // بناء فهرس نصوص الصفحات المُطَبَّعة
  const normalizedPages = new Map<number, string>();
  for (const page of pages) {
    normalizedPages.set(page.pageNumber, normalizeArabic(page.text));
  }

  // تتبع الكلمات التي تمت مطابقتها لتجنب التكرار
  const matchedKeys = new Set<string>();

  for (const word of allWords) {
    const pageNum = word.pageNumber;
    const normalizedWord = normalizeArabic(word.wordText);

    if (normalizedWord.length < 2) {
      // كلمة قصيرة جداً - تجاهل
      matchedCount++;
      continue;
    }

    // البحث في الصفحة المتوقعة
    const pageText = normalizedPages.get(pageNum) || '';
    const foundInExpectedPage = pageText.includes(normalizedWord);

    if (foundInExpectedPage) {
      // تحقق من التكرار
      const key = `${pageNum}_${normalizedWord}`;
      if (matchedKeys.has(key)) {
        mismatches.push({
          word,
          reason: 'duplicate_match',
          detail: `الكلمة "${word.wordText}" مكررة في الصفحة ${pageNum}`,
        });
      } else {
        matchedKeys.add(key);
        matchedCount++;
      }
      continue;
    }

    // البحث في الصفحات المجاورة
    const adjacentPages = [pageNum - 2, pageNum - 1, pageNum + 1, pageNum + 2];
    const foundInPages: number[] = [];

    for (const adjPage of adjacentPages) {
      const adjText = normalizedPages.get(adjPage);
      if (adjText?.includes(normalizedWord)) {
        foundInPages.push(adjPage);
      }
    }

    if (foundInPages.length > 0) {
      mismatches.push({
        word,
        reason: 'page_number_off',
        detail: `الكلمة "${word.wordText}" المتوقعة في ص${pageNum} موجودة في ص${foundInPages.join(', ')}`,
        foundInPages,
      });
      matchedCount++; // نعتبرها مطابقة جزئياً
      continue;
    }

    // البحث بتطابق جزئي (أول 3 أحرف)
    const prefix = normalizedWord.slice(0, 3);
    const partialMatch = pageText.includes(prefix);

    if (partialMatch) {
      mismatches.push({
        word,
        reason: 'partial_match',
        detail: `تطابق جزئي للكلمة "${word.wordText}" (البادئة "${prefix}" موجودة)`,
      });
    } else {
      mismatches.push({
        word,
        reason: 'not_found_in_page',
        detail: `الكلمة "${word.wordText}" غير موجودة في نص الصفحة ${pageNum}`,
      });
    }
  }

  const unmatchedCount = allWords.length - matchedCount;
  const coveragePercent = allWords.length > 0
    ? Math.round((matchedCount / allWords.length) * 10000) / 100
    : 0;

  return {
    totalGhareebWords: allWords.length,
    matchedCount,
    unmatchedCount,
    mismatches,
    coveragePercent,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * تصدير التقرير كـ JSON
 */
export function exportReportAsJSON(report: MatchingReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * تصدير التقرير كـ CSV
 */
export function exportReportAsCSV(report: MatchingReport): string {
  const headers = [
    'الكلمة',
    'السورة',
    'الآية',
    'الصفحة',
    'السبب',
    'التفاصيل',
    'الصفحات الفعلية',
  ];

  const rows = report.mismatches.map((m) => [
    m.word.wordText,
    m.word.surahName,
    m.word.verseNumber.toString(),
    m.word.pageNumber.toString(),
    translateReason(m.reason),
    m.detail,
    m.foundInPages?.join(', ') || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // Add BOM for Excel Arabic support
  return '\uFEFF' + csvContent;
}

function translateReason(reason: MismatchReason): string {
  switch (reason) {
    case 'not_found_in_page':
      return 'غير موجودة';
    case 'diacritic_mismatch':
      return 'اختلاف تشكيل';
    case 'page_number_off':
      return 'صفحة مختلفة';
    case 'duplicate_match':
      return 'مكررة';
    case 'partial_match':
      return 'تطابق جزئي';
    default:
      return 'غير معروف';
  }
}
