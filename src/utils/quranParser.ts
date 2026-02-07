import { QuranPage, GhareebWord } from '@/types/quran';
import { calculatePageNumber } from './pageMapper';

// Convert Arabic numerals to Western numerals
function arabicToNumber(arabicNum: string): number {
  const arabicNumerals = '٠١٢٣٤٥٦٧٨٩';
  let result = '';
  for (const char of arabicNum) {
    const index = arabicNumerals.indexOf(char);
    if (index !== -1) {
      result += index.toString();
    }
  }
  return parseInt(result, 10) || 0;
}

// Remove decorative brackets and parentheses from word text
function cleanWordText(text: string): string {
  return text
    .replace(/[﴿﴾()（）]/g, '')
    .trim();
}

// Normalize Arabic text for comparison - remove ALL diacritics and special marks
export function normalizeArabic(text: string): string {
  let normalized = text;
  
  // Remove all Unicode ranges that contain diacritical marks and special symbols
  normalized = normalized.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '');
  
  // Remove Quranic special characters
  normalized = normalized.replace(/[ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ]/g, '');
  
  // Normalize alef forms
  normalized = normalized.replace(/[ٱإأآٲٳٵ]/g, 'ا');
  
  // Normalize other letters
  normalized = normalized.replace(/ٰ/g, ''); // Superscript alef
  normalized = normalized.replace(/ى/g, 'ي'); // Alef maksura to yeh
  normalized = normalized.replace(/ۀ/g, 'ه'); // Heh with yeh above
  normalized = normalized.replace(/ة/g, 'ه'); // Teh marbuta to heh
  normalized = normalized.replace(/ؤ/g, 'و'); // Waw with hamza
  normalized = normalized.replace(/ئ/g, 'ي'); // Yeh with hamza  
  normalized = normalized.replace(/ء/g, ''); // Remove standalone hamza
  normalized = normalized.replace(/ـ/g, ''); // Remove tatweel
  
  // Remove any remaining non-Arabic characters except spaces
  normalized = normalized.replace(/[^\u0621-\u064A\u066E-\u06D3\s]/g, '');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

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

// Parse ghareeb words with calculated page numbers based on surah/verse mapping
export function parseGhareebText(text: string): GhareebWord[] {
  const lines = text.split('\n');
  const words: GhareebWord[] = [];
  const seenWords = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip metadata lines
    if (trimmedLine.startsWith('#') || !trimmedLine) continue;

    // Tab-separated: word, surah, verse, meaning, tags
    const parts = trimmedLine.split('\t');
    if (parts.length < 4) continue;

    const wordText = cleanWordText(parts[0]);
    const surahName = parts[1].trim();
    const verseNumber = arabicToNumber(parts[2]);
    const meaning = parts[3].trim();

    if (!wordText || !meaning) continue;

    // Create unique key for deduplication (word + surah + verse + meaning)
    const uniqueKey = `${wordText}|${surahName}|${verseNumber}|${meaning}`;
    if (seenWords.has(uniqueKey)) continue;
    seenWords.add(uniqueKey);

    // Calculate page number from surah and verse
    const pageNumber = calculatePageNumber(surahName, verseNumber);

    words.push({
      pageNumber,
      wordText,
      meaning,
      surahName,
      verseNumber,
      order: words.length,
    });
  }

  console.log(`Parsed ${words.length} unique ghareeb words`);
  return words;
}

// Find ghareeb words that appear in a given page text
// Uses both text matching AND page number verification for accuracy
export function findWordsInPage(pageText: string, allWords: GhareebWord[], pageNumber?: number): GhareebWord[] {
  const normalizedPageText = normalizeArabic(pageText);
  const foundWords: { word: GhareebWord; firstIndex: number }[] = [];
  const usedKeys = new Set<string>();

  for (const word of allWords) {
    const normalizedWord = normalizeArabic(word.wordText);
    if (normalizedWord.length < 2) continue;

    // If pageNumber is provided, prioritize words mapped to this page (±1 tolerance)
    if (pageNumber !== undefined && word.pageNumber > 0) {
      const pageDiff = Math.abs(word.pageNumber - pageNumber);
      if (pageDiff > 1) continue; // Skip words mapped to different pages
    }

    // Check if this word appears in the page text
    const index = normalizedPageText.indexOf(normalizedWord);
    if (index !== -1) {
      // Create unique key including surah and verse for better deduplication
      const key = `${word.wordText}|${word.surahName}|${word.verseNumber}|${word.meaning}`;
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

export async function loadQuranData(): Promise<{ pages: QuranPage[]; ghareebWords: GhareebWord[] }> {
  try {
    const [mushafResponse, ghareebResponse] = await Promise.all([
      fetch('/data/mushaf.txt'),
      fetch('/data/ghareeb.txt'),
    ]);

    const mushafText = await mushafResponse.text();
    const ghareebText = await ghareebResponse.text();

    const pages = parseMushafText(mushafText);
    const ghareebWords = parseGhareebText(ghareebText);

    console.log(`Loaded ${pages.length} pages and ${ghareebWords.length} ghareeb words`);

    return { pages, ghareebWords };
  } catch (error) {
    console.error('Error loading Quran data:', error);
    return { pages: [], ghareebWords: [] };
  }
}
