import { GhareebWord, GhareebJsonData, GhareebPageItem } from '@/types/quran';

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

/**
 * Load ghareeb words from the accurate JSON file
 * Returns a Map of pageNumber -> GhareebWord[]
 */
export async function loadGhareebData(): Promise<Map<number, GhareebWord[]>> {
  const response = await fetch('/data/ghareeb-pages.json');
  const data: GhareebJsonData = await response.json();
  
  const pageMap = new Map<number, GhareebWord[]>();
  
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
      
      words.push({
        pageNumber: page.page,
        wordText,
        meaning,
        surahName: item.surah_name,
        surahNumber: item.surah,
        verseNumber: item.ayah,
        order: words.length,
        uniqueKey,
      });
    }
    
    if (words.length > 0) {
      pageMap.set(page.page, words);
    }
  }
  
  console.log(`Loaded ghareeb data for ${pageMap.size} pages`);
  return pageMap;
}

/**
 * Get ghareeb words for a specific page
 */
export function getWordsForPage(
  pageMap: Map<number, GhareebWord[]>,
  pageNumber: number
): GhareebWord[] {
  return pageMap.get(pageNumber) || [];
}
