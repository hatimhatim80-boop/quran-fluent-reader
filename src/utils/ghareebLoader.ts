import { GhareebWord, GhareebJsonData } from '@/types/quran';
import { normalizeArabic } from './quranParser';
import { loadTanzilPageIndex, getPageForAyah } from './tanzilPageIndex';

/**
 * Extract the actual Quranic word from the raw field
 * The word is between ﴿ and ﴾ brackets
 */
function extractWordFromRaw(raw: string): string {
  const match = raw.match(/﴿([^﴾]+)﴾/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return '';
}

// Store all ghareeb words indexed by Tanzil page number
let ghareebByTanzilPage: Map<number, GhareebWord[]> = new Map();

/**
 * Load ghareeb words and map them to correct pages using Tanzil's page index
 */
export async function loadGhareebData(): Promise<Map<number, GhareebWord[]>> {
  // Load page index first
  const pageIndex = await loadTanzilPageIndex();
  
  const response = await fetch('/data/ghareeb-pages.json');
  const data: GhareebJsonData = await response.json();
  
  ghareebByTanzilPage = new Map();
  let totalWords = 0;
  
  for (const page of data.pages) {
    for (const item of page.items) {
      const wordText = extractWordFromRaw(item.raw);
      if (!wordText) continue;
      
      // The "word" field in JSON is actually the meaning
      const meaning = item.word || item.meaning;
      if (!meaning) continue;
      
      // Calculate the correct page using Tanzil's page index
      const correctPage = getPageForAyah(item.surah, item.ayah, pageIndex);
      
      // Create unique key for this word instance
      const uniqueKey = `${item.surah}_${item.ayah}_${wordText.slice(0, 10)}`;
      
      const ghareebWord: GhareebWord = {
        pageNumber: correctPage,
        wordText,
        meaning,
        surahName: item.surah_name,
        surahNumber: item.surah,
        verseNumber: item.ayah,
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
  }
  
  console.log(`Loaded ${totalWords} ghareeb words across ${ghareebByTanzilPage.size} pages (Tanzil mapping)`);
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
