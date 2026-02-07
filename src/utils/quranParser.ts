import { QuranPage } from '@/types/quran';
import { loadTanzilPageIndex, getPageForAyah } from './tanzilPageIndex';

// Surah names in Arabic indexed by surah number
const SURAH_NAMES: Record<number, string> = {
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

// Normalize Arabic text for comparison - remove ALL diacritics and special marks
// Enhanced for comprehensive Uthmani script matching
export function normalizeArabic(text: string, level: 'standard' | 'aggressive' = 'standard'): string {
  let normalized = text;
  
  // Remove all Unicode ranges that contain diacritical marks and special symbols
  // Including U+08D3-U+08FF (Arabic Extended-A: tanween, vowel marks, etc.)
  normalized = normalized.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '');
  
  // Remove Quranic special characters and tajweed marks
  normalized = normalized.replace(/[ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ]/g, '');
  
  // Remove Quran-specific bracket symbols
  normalized = normalized.replace(/[﴿﴾۝]/g, '');
  
  // Remove additional Uthmani marks and symbols
  normalized = normalized.replace(/[\u06D4\u06DD\u06DE\u06DF\u06E0\u06E1]/g, '');
  
  // Normalize alef forms - comprehensive list
  normalized = normalized.replace(/[ٱإأآٲٳٵٵٴٶٷ]/g, 'ا');
  
  // Remove superscript alef (appears as small alef above letters)
  normalized = normalized.replace(/[ٰۤ]/g, '');
  
  // Normalize other letters
  normalized = normalized.replace(/ى/g, 'ي'); // Alef maksura to yeh
  normalized = normalized.replace(/ۀ/g, 'ه'); // Heh with yeh above
  normalized = normalized.replace(/ة/g, 'ه'); // Teh marbuta to heh
  normalized = normalized.replace(/ؤ/g, 'و'); // Waw with hamza
  normalized = normalized.replace(/ئ/g, 'ي'); // Yeh with hamza  
  normalized = normalized.replace(/ء/g, ''); // Remove standalone hamza
  normalized = normalized.replace(/ـ/g, ''); // Remove tatweel
  normalized = normalized.replace(/ٔ/g, ''); // Hamza above (U+0654)
  normalized = normalized.replace(/ٕ/g, ''); // Hamza below (U+0655)
  
  // Aggressive normalization for harder matching
  if (level === 'aggressive') {
    // Normalize lam-alef ligatures
    normalized = normalized.replace(/لا/g, 'لا');
    normalized = normalized.replace(/لإ/g, 'لا');
    normalized = normalized.replace(/لأ/g, 'لا');
    normalized = normalized.replace(/لآ/g, 'لا');
    
    // Additional letter normalizations
    normalized = normalized.replace(/ڪ/g, 'ك'); // Swash kaf
    normalized = normalized.replace(/ک/g, 'ك'); // Persian kaf
    normalized = normalized.replace(/گ/g, 'ك'); // Gaf
    normalized = normalized.replace(/ی/g, 'ي'); // Persian yeh
    normalized = normalized.replace(/ں/g, 'ن'); // Noon ghunna
    normalized = normalized.replace(/[ھہۂۃ]/g, 'ه'); // Heh variants
  }
  
  // Remove any remaining non-Arabic base letters except spaces
  // Keep only Arabic letters (U+0621-U+064A) and extended forms (U+066E-U+06D3)
  normalized = normalized.replace(/[^\u0621-\u064A\u066E-\u06D3\s]/g, '');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Extract word root (first few consonants for fuzzy matching)
export function extractWordRoot(word: string): string {
  const normalized = normalizeArabic(word, 'aggressive');
  // Remove weak letters (alef, waw, yeh) from middle
  return normalized.replace(/[اوي]/g, '').slice(0, 4);
}

interface ParsedAyah {
  surah: number;
  ayah: number;
  text: string;
}

/**
 * Parse Tanzil format: surah|ayah|text
 */
function parseTanzilLine(line: string): ParsedAyah | null {
  const parts = line.split('|');
  if (parts.length < 3) return null;
  
  const surah = parseInt(parts[0], 10);
  const ayah = parseInt(parts[1], 10);
  const text = parts.slice(2).join('|'); // In case text contains |
  
  if (isNaN(surah) || isNaN(ayah)) return null;
  
  return { surah, ayah, text };
}

/**
 * Parse Tanzil Quran text and organize by pages using Tanzil page index
 */
export async function parseTanzilQuran(text: string): Promise<QuranPage[]> {
  const pageIndex = await loadTanzilPageIndex();
  const lines = text.split('\n').filter(line => line.trim());
  
  // Parse all ayahs
  const ayahs: ParsedAyah[] = [];
  for (const line of lines) {
    const parsed = parseTanzilLine(line);
    if (parsed) {
      ayahs.push(parsed);
    }
  }
  
  console.log(`Parsed ${ayahs.length} ayahs from Tanzil`);
  
  // Group ayahs by page
  const pageMap = new Map<number, { texts: string[]; surahName?: string }>();
  
  for (const ayah of ayahs) {
    const pageNum = getPageForAyah(ayah.surah, ayah.ayah, pageIndex);
    
    if (!pageMap.has(pageNum)) {
      pageMap.set(pageNum, { texts: [], surahName: SURAH_NAMES[ayah.surah] });
    }
    
    const page = pageMap.get(pageNum)!;
    
    // Add surah header if this is ayah 1 (new surah)
    if (ayah.ayah === 1 && ayah.surah !== 1) { // Skip Fatiha basmalah
      page.texts.push(`سورة ${SURAH_NAMES[ayah.surah]}`);
    }
    
    // Add ayah text with number marker
    page.texts.push(`${ayah.text} ﴿${ayah.ayah}﴾`);
  }
  
  // Convert to QuranPage array
  const pages: QuranPage[] = [];
  for (let pageNum = 1; pageNum <= 604; pageNum++) {
    const pageData = pageMap.get(pageNum);
    pages.push({
      pageNumber: pageNum,
      text: pageData ? pageData.texts.join('\n') : '',
      surahName: pageData?.surahName,
    });
  }
  
  console.log(`Created ${pages.length} pages from Tanzil data`);
  return pages;
}

/**
 * Legacy parser for old mushaf.txt format
 */
export function parseMushafText(text: string): QuranPage[] {
  const lines = text.split('\n');
  const pages: QuranPage[] = [];
  
  let currentPageLines: string[] = [];
  let currentSurahName: string | undefined;
  let pageNumber = 1;

  for (const line of lines) {
    // Empty line = page break
    if (line.trim() === '') {
      if (currentPageLines.length > 0) {
        pages.push({
          pageNumber,
          text: currentPageLines.join('\n'),
          surahName: currentSurahName,
        });
        pageNumber++;
        currentPageLines = [];
      }
      continue;
    }

    // Check for surah header
    if (line.trim().startsWith('سُورَةُ')) {
      currentSurahName = line.trim().replace('سُورَةُ', '').trim();
    }

    currentPageLines.push(line);
  }

  // Don't forget the last page
  if (currentPageLines.length > 0) {
    pages.push({
      pageNumber,
      text: currentPageLines.join('\n'),
      surahName: currentSurahName,
    });
  }

  console.log(`Parsed ${pages.length} pages`);
  return pages;
}
