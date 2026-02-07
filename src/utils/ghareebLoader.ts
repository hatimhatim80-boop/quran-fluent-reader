import { GhareebWord, GhareebJsonData } from '@/types/quran';
import { normalizeArabic } from './quranParser';

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

// Store all ghareeb words for text-based matching
let allGhareebWords: GhareebWord[] = [];

/**
 * Load ghareeb words from the accurate JSON file
 */
export async function loadGhareebData(): Promise<Map<number, GhareebWord[]>> {
  const response = await fetch('/data/ghareeb-pages.json');
  const data: GhareebJsonData = await response.json();
  
  const pageMap = new Map<number, GhareebWord[]>();
  allGhareebWords = [];
  
  for (const page of data.pages) {
    const words: GhareebWord[] = [];
    
    // Track word occurrences within same ayah for disambiguation
    const ayahWordCounts = new Map<string, number>();
    
    for (const item of page.items) {
      const wordText = extractWordFromRaw(item.raw);
      if (!wordText) continue;
      
      // The "word" field in JSON is actually the meaning
      const meaning = item.word || item.meaning;
      if (!meaning) continue;
      
      // Create ayah key for tracking word occurrences
      const ayahKey = `${item.surah}_${item.ayah}`;
      const wordIndexInAyah = ayahWordCounts.get(ayahKey) || 0;
      ayahWordCounts.set(ayahKey, wordIndexInAyah + 1);
      
      // Create unique key for precise matching
      const uniqueKey = `${item.surah}_${item.ayah}_${wordIndexInAyah}`;
      
      const ghareebWord: GhareebWord = {
        pageNumber: page.page,
        wordText,
        meaning,
        surahName: item.surah_name,
        surahNumber: item.surah,
        verseNumber: item.ayah,
        order: words.length,
        uniqueKey,
      };
      
      words.push(ghareebWord);
      allGhareebWords.push(ghareebWord);
    }
    
    if (words.length > 0) {
      pageMap.set(page.page, words);
    }
  }
  
  console.log(`Loaded ghareeb data for ${pageMap.size} pages, total ${allGhareebWords.length} words`);
  return pageMap;
}

/**
 * Find ghareeb words that appear in a given page text
 * This searches the actual text content for matches
 */
export function findWordsInPageText(
  pageText: string,
  pageNumber: number,
  pageMap: Map<number, GhareebWord[]>
): GhareebWord[] {
  const normalizedPageText = normalizeArabic(pageText);
  const foundWords: { word: GhareebWord; firstIndex: number }[] = [];
  const usedKeys = new Set<string>();

  // First, try words from this page and adjacent pages (±2 for tolerance)
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
      // Create unique key to avoid duplicates
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
 * Get ghareeb words for a specific page by matching text content
 */
export function getWordsForPage(
  pageMap: Map<number, GhareebWord[]>,
  pageNumber: number,
  pageText?: string
): GhareebWord[] {
  // If we have page text, use text-based matching
  if (pageText) {
    return findWordsInPageText(pageText, pageNumber, pageMap);
  }
  
  // Fallback to direct page lookup
  return pageMap.get(pageNumber) || [];
}
