import { GhareebWord } from '@/types/quran';
import { normalizeArabic } from './quranParser';
import { loadTanzilPageIndex, getPageForAyah } from './tanzilPageIndex';

// Map of surah names to numbers
const surahNameToNumber: Record<string, number> = {
  'الفاتحة': 1, 'البقرة': 2, 'آل عمران': 3, 'النساء': 4, 'المائدة': 5,
  'الأنعام': 6, 'الأعراف': 7, 'الأنفال': 8, 'التوبة': 9, 'يونس': 10,
  'هود': 11, 'يوسف': 12, 'الرعد': 13, 'إبراهيم': 14, 'الحجر': 15,
  'النحل': 16, 'الإسراء': 17, 'الكهف': 18, 'مريم': 19, 'طه': 20,
  'الأنبياء': 21, 'الحج': 22, 'المؤمنون': 23, 'النور': 24, 'الفرقان': 25,
  'الشعراء': 26, 'النمل': 27, 'القصص': 28, 'العنكبوت': 29, 'الروم': 30,
  'لقمان': 31, 'السجدة': 32, 'الأحزاب': 33, 'سبإ': 34, 'فاطر': 35,
  'يس': 36, 'الصافات': 37, 'ص': 38, 'الزمر': 39, 'غافر': 40,
  'فصلت': 41, 'الشورى': 42, 'الزخرف': 43, 'الدخان': 44, 'الجاثية': 45,
  'الأحقاف': 46, 'محمد': 47, 'الفتح': 48, 'الحجرات': 49, 'ق': 50,
  'الذاريات': 51, 'الطور': 52, 'النجم': 53, 'القمر': 54, 'الرحمن': 55,
  'الواقعة': 56, 'الحديد': 57, 'المجادلة': 58, 'الحشر': 59, 'الممتحنة': 60,
  'الصف': 61, 'الجمعة': 62, 'المنافقون': 63, 'التغابن': 64, 'الطلاق': 65,
  'التحريم': 66, 'الملك': 67, 'القلم': 68, 'الحاقة': 69, 'المعارج': 70,
  'نوح': 71, 'الجن': 72, 'المزمل': 73, 'المدثر': 74, 'القيامة': 75,
  'الإنسان': 76, 'المرسلات': 77,
  // dataset variant spelling
  'النبأ': 78, 'النبإ': 78,
  'النازعات': 79, 'عبس': 80,
  'التكوير': 81, 'الانفطار': 82, 'المطففين': 83, 'الانشقاق': 84, 'البروج': 85,
  'الطارق': 86, 'الأعلى': 87, 'الغاشية': 88, 'الفجر': 89, 'البلد': 90,
  'الشمس': 91, 'الليل': 92, 'الضحى': 93, 'الشرح': 94, 'التين': 95,
  'العلق': 96, 'القدر': 97, 'البينة': 98, 'الزلزلة': 99, 'العاديات': 100,
  'القارعة': 101, 'التكاثر': 102, 'العصر': 103, 'الهمزة': 104, 'الفيل': 105,
  'قريش': 106, 'الماعون': 107, 'الكوثر': 108, 'الكافرون': 109, 'النصر': 110,
  'المسد': 111, 'الإخلاص': 112, 'الفلق': 113, 'الناس': 114,
};

/**
 * Extract the word from brackets ﴿...﴾
 */
function extractWordFromBrackets(text: string): string {
  const match = text.match(/﴿([^﴾]+)﴾/);
  return match?.[1]?.trim() || '';
}

/**
 * Convert Arabic numerals to JavaScript numbers
 */
function parseArabicNumber(str: string): number {
  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  const converted = str.replace(/[٠-٩]/g, d => arabicToEnglish[d] || d);
  return parseInt(converted, 10);
}

// Store all ghareeb words indexed by Tanzil page number
let ghareebByTanzilPage: Map<number, GhareebWord[]> = new Map();

/**
 * Load ghareeb words from the new TXT file format
 * Format: ﴿word﴾ TAB surahName TAB verseNumber TAB meaning TAB tags
 */
export async function loadGhareebData(): Promise<Map<number, GhareebWord[]>> {
  // Load page index first
  const pageIndex = await loadTanzilPageIndex();
  
  const response = await fetch('/data/ghareeb-words.txt');
  const text = await response.text();
  
  ghareebByTanzilPage = new Map();
  let totalWords = 0;
  
  // Track word indices within (surah, ayah) for unique keys
  const wordIndexCounters = new Map<string, number>();
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines and metadata lines starting with #
    if (!line.trim() || line.startsWith('#')) continue;
    
    // Split by tab
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    
    const rawWord = parts[0];
    const surahName = parts[1]?.trim() || '';
    const verseStr = parts[2]?.trim() || '';
    const meaning = parts[3]?.trim() || '';
    
    // Extract word from brackets
    const wordText = extractWordFromBrackets(rawWord);
    if (!wordText) continue;
    
    // Get surah number
    const surahNumber = surahNameToNumber[surahName];
    if (!surahNumber) {
      console.warn(`Unknown surah: ${surahName}`);
      continue;
    }
    
    // Parse verse number (Arabic numerals)
    const verseNumber = parseArabicNumber(verseStr);
    if (isNaN(verseNumber)) continue;
    
    // Calculate the correct page using Tanzil's page index
    const correctPage = getPageForAyah(surahNumber, verseNumber, pageIndex);
    
    // Stable wordIndex within (surah, ayah)
    const counterKey = `${surahNumber}_${verseNumber}`;
    const wordIndex = (wordIndexCounters.get(counterKey) ?? 0) + 1;
    wordIndexCounters.set(counterKey, wordIndex);
    
    // Stable unique key
    const uniqueKey = `${surahNumber}_${verseNumber}_${wordIndex}`;
    
    const ghareebWord: GhareebWord = {
      pageNumber: correctPage,
      wordText,
      meaning,
      surahName,
      surahNumber,
      verseNumber,
      wordIndex,
      order: 0,
      uniqueKey,
    };
    
    // Add to the correct page
    if (!ghareebByTanzilPage.has(correctPage)) {
      ghareebByTanzilPage.set(correctPage, []);
    }
    const pageWords = ghareebByTanzilPage.get(correctPage)!;
    ghareebWord.order = pageWords.length;
    pageWords.push(ghareebWord);
    totalWords++;
  }
  
  console.log(`Loaded ${totalWords} ghareeb words across ${ghareebByTanzilPage.size} pages`);
  return ghareebByTanzilPage;
}

/**
 * Find ghareeb words that appear in a given page text
 * Uses text matching with words from the correct Tanzil page
 */
export function findWordsInPageText(
  pageText: string,
  pageNumber: number,
  pageMap: Map<number, GhareebWord[]>
): GhareebWord[] {
  const normalizedPageText = normalizeArabic(pageText);
  const foundWords: { word: GhareebWord; firstIndex: number }[] = [];
  const usedKeys = new Set<string>();

  // Get words from this page and adjacent pages (±2 for tolerance)
  const pagesToCheck = [pageNumber, pageNumber - 1, pageNumber + 1, pageNumber - 2, pageNumber + 2];
  const candidateWords: GhareebWord[] = [];
  
  for (const p of pagesToCheck) {
    const pageWords = pageMap.get(p);
    if (pageWords) {
      candidateWords.push(...pageWords);
    }
  }

  for (const word of candidateWords) {
    const normalizedWord = normalizeArabic(word.wordText);
    if (normalizedWord.length < 2) continue;


    // Check if this word appears in the page text

    // Check if this word appears in the page text
    const index = normalizedPageText.indexOf(normalizedWord);
    if (index !== -1) {
      const key = word.uniqueKey;
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        foundWords.push({ word, firstIndex: index });
      }
    }
  }

  // Sort by first occurrence in text
  foundWords.sort((a, b) => a.firstIndex - b.firstIndex);
  
  return foundWords.map((fw, idx) => ({
    ...fw.word,
    order: idx,
  }));
}

/**
 * Get ghareeb words for a specific page
 */
export function getWordsForPage(
  pageMap: Map<number, GhareebWord[]>,
  pageNumber: number,
  pageText?: string
): GhareebWord[] {
  if (pageText) {
    return findWordsInPageText(pageText, pageNumber, pageMap);
  }
  return pageMap.get(pageNumber) || [];
}
