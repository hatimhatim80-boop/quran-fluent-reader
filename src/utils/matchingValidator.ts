import { GhareebWord } from '@/types/quran';
import { normalizeArabic, extractWordRoot } from './quranParser';

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

// تحقق من وجود الكلمة بعدة استراتيجيات
function findWordInText(word: string, pageText: string): { found: boolean; method: string } {
  // الاستراتيجية 1: التطبيع القياسي
  const normalizedWord = normalizeArabic(word);
  const normalizedPage = normalizeArabic(pageText);
  
  if (normalizedPage.includes(normalizedWord)) {
    return { found: true, method: 'standard' };
  }
  
  // الاستراتيجية 2: التطبيع العدواني
  const aggressiveWord = normalizeArabic(word, 'aggressive');
  const aggressivePage = normalizeArabic(pageText, 'aggressive');
  
  if (aggressivePage.includes(aggressiveWord)) {
    return { found: true, method: 'aggressive' };
  }
  
  // الاستراتيجية 3: البحث بدون ألف البداية
  if (aggressiveWord.startsWith('ا')) {
    const wordWithoutAlef = aggressiveWord.slice(1);
    if (wordWithoutAlef.length >= 2 && aggressivePage.includes(wordWithoutAlef)) {
      return { found: true, method: 'no_leading_alef' };
    }
  }
  
  // الاستراتيجية 4: البحث عن الجذر
  const wordRoot = extractWordRoot(word);
  if (wordRoot.length >= 3) {
    // ابحث عن الجذر ضمن كلمات الصفحة
    const pageWords = aggressivePage.split(/\s+/);
    for (const pageWord of pageWords) {
      const pageWordRoot = extractWordRoot(pageWord);
      if (pageWordRoot === wordRoot && pageWord.length >= aggressiveWord.length - 2) {
        return { found: true, method: 'root_match' };
      }
    }
  }
  
  return { found: false, method: 'none' };
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

  // بناء فهرس نصوص الصفحات
  const pageTexts = new Map<number, string>();
  for (const page of pages) {
    pageTexts.set(page.pageNumber, page.text);
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

    // البحث في الصفحة المتوقعة بالاستراتيجيات المتعددة
    const pageText = pageTexts.get(pageNum) || '';
    const searchResult = findWordInText(word.wordText, pageText);

    if (searchResult.found) {
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
      const adjText = pageTexts.get(adjPage) || '';
      const adjResult = findWordInText(word.wordText, adjText);
      if (adjResult.found) {
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

    // البحث بتطابق جزئي محسّن
    const aggressiveWord = normalizeArabic(word.wordText, 'aggressive');
    const aggressivePage = normalizeArabic(pageText, 'aggressive');
    const prefix = aggressiveWord.slice(0, 3);
    const suffix = aggressiveWord.slice(-3);
    
    const prefixMatch = aggressivePage.includes(prefix);
    const suffixMatch = aggressivePage.includes(suffix);

    if (prefixMatch || suffixMatch) {
      mismatches.push({
        word,
        reason: 'partial_match',
        detail: `تطابق جزئي للكلمة "${word.wordText}" (${prefixMatch ? 'البادئة' : 'اللاحقة'} موجودة)`,
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
