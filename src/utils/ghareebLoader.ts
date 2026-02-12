import { GhareebWord } from '@/types/quran';
import { normalizeArabic } from './quranParser';
import { loadTanzilPageIndex, getPageForAyah } from './tanzilPageIndex';
import { getData } from '@/services/dataSource';

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

/**
 * Load ghareeb words from the website TXT format.
 * 
 * Format:
 * - Surah headers: سورة NAME (NUMBER) ﴿verse text﴾ [ref] N- ﴿word﴾: meaning
 * - Verse blocks: ﴿verse text﴾ [ref] N- ﴿word﴾: meaning
 * - Word defs with verse: N- ﴿word﴾: meaning
 * - Word defs without verse: ﴿word﴾: meaning (inherits previous verse)
 * - Page numbers: standalone Arabic numeral
 */
export async function loadGhareebData(): Promise<Map<number, GhareebWord[]>> {
  const pageIndex = await loadTanzilPageIndex();

  const text = await getData('ghareeb');

  const result = new Map<number, GhareebWord[]>();
  let currentSurah = '';
  let currentSurahNumber = 0;
  let currentVerse = 0;
  let totalWords = 0;
  const wordIndexCounters = new Map<string, number>();

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Page number: standalone Arabic numeral — skip
    if (/^[٠-٩]+$/.test(trimmed)) continue;

    // Surah header: سورة NAME (NUMBER)
    const surahMatch = trimmed.match(/^سورة\s+(.+?)\s*\(([٠-٩]+)\)/);
    if (surahMatch) {
      currentSurah = surahMatch[1].trim();
      currentSurahNumber = parseArabicNumber(surahMatch[2]);
    }

    // Determine the part of the line that may contain word definitions.
    // If the line contains a verse reference block like [البقرة: ١-٧],
    // word definitions appear AFTER the closing ']'.
    let searchText = trimmed;
    const refMatch = trimmed.match(/\]\s*/);
    if (refMatch && trimmed.includes('[')) {
      const refEnd = trimmed.indexOf(']');
      // Only strip if the ﴿ for verse text appears BEFORE the ]
      // (i.e., this line has a verse block, not just a word def with ] in meaning)
      const firstOrnament = trimmed.indexOf('﴿');
      if (firstOrnament < refEnd) {
        searchText = trimmed.substring(refEnd + 1).trim();
      }
    }

    // Check for verse number prefix: N- ﴿
    const versePrefix = searchText.match(/^([٠-٩]+)-\s*/);
    if (versePrefix) {
      currentVerse = parseArabicNumber(versePrefix[1]);
      searchText = searchText.substring(versePrefix[0].length);
    }

    // Extract word definition: ﴿word﴾: meaning  OR  ﴿word﴾: meaning
    const wordMatch = searchText.match(/^﴿([^﴾]+)﴾[:\s]\s*(.+)/);
    if (wordMatch && currentSurahNumber > 0 && currentVerse > 0) {
      const wordText = wordMatch[1].trim();
      const meaning = wordMatch[2].trim();

      if (!meaning || meaning.length < 2) continue;

      const correctPage = getPageForAyah(currentSurahNumber, currentVerse, pageIndex);

      const counterKey = `${currentSurahNumber}_${currentVerse}`;
      const wordIndex = (wordIndexCounters.get(counterKey) ?? 0) + 1;
      wordIndexCounters.set(counterKey, wordIndex);
      const uniqueKey = `${currentSurahNumber}_${currentVerse}_${wordIndex}`;

      const ghareebWord: GhareebWord = {
        pageNumber: correctPage,
        wordText,
        meaning,
        surahName: currentSurah,
        surahNumber: currentSurahNumber,
        verseNumber: currentVerse,
        wordIndex,
        order: 0,
        uniqueKey,
      };

      if (!result.has(correctPage)) {
        result.set(correctPage, []);
      }
      const pageWords = result.get(correctPage)!;
      ghareebWord.order = pageWords.length;
      pageWords.push(ghareebWord);
      totalWords++;
    }
  }

  console.log(`Loaded ${totalWords} ghareeb words across ${result.size} pages`);
  return result;
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
