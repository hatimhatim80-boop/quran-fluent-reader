import { QuranPage, GhareebWord } from '@/types/quran';
import { getGhareebWordPage } from './quranPageIndex';

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

// Remove decorative brackets from word text
function cleanWordText(text: string): string {
  return text.replace(/[﴿﴾]/g, '').trim();
}

// Normalize Arabic text for comparison - remove ALL diacritics and special marks
function normalizeArabic(text: string): string {
  // First, convert to a consistent form by removing all diacritics and special marks
  let normalized = text;
  
  // Remove all Unicode ranges that contain diacritical marks and special symbols
  normalized = normalized.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '');
  
  // Remove Quranic special characters
  normalized = normalized.replace(/[ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ]/g, '');
  
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

export function parseGhareebText(text: string, _pages: QuranPage[]): GhareebWord[] {
  const lines = text.split('\n');
  const words: GhareebWord[] = [];
  
  // Track words per page for ordering
  const pageWordCounts: Record<number, number> = {};

  let foundCount = 0;
  let notFoundCount = 0;

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

    if (!wordText || !surahName || !verseNumber) continue;

    // Use the page index to find the correct page
    const pageNumber = getGhareebWordPage(surahName, verseNumber);
    
    if (pageNumber === -1) {
      notFoundCount++;
      continue;
    }

    foundCount++;
    
    // Track order within page
    pageWordCounts[pageNumber] = (pageWordCounts[pageNumber] || 0) + 1;
    
    words.push({
      pageNumber,
      wordText,
      meaning,
      surahName,
      verseNumber,
      order: pageWordCounts[pageNumber],
    });
  }

  console.log(`Ghareeb words: ${foundCount} found, ${notFoundCount} not found (using page index)`);
  
  return words.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    // Sort by verse number within same page
    if (a.verseNumber !== b.verseNumber) return a.verseNumber - b.verseNumber;
    return a.order - b.order;
  });
}

// Export for use in PageView
export { normalizeArabic };

export async function loadQuranData(): Promise<{ pages: QuranPage[]; ghareebWords: GhareebWord[] }> {
  try {
    const [mushafResponse, ghareebResponse] = await Promise.all([
      fetch('/data/mushaf.txt'),
      fetch('/data/ghareeb.txt'),
    ]);

    const mushafText = await mushafResponse.text();
    const ghareebText = await ghareebResponse.text();

    const pages = parseMushafText(mushafText);
    const ghareebWords = parseGhareebText(ghareebText, pages);

    console.log(`Loaded ${pages.length} pages and ${ghareebWords.length} ghareeb words`);

    return { pages, ghareebWords };
  } catch (error) {
    console.error('Error loading Quran data:', error);
    return { pages: [], ghareebWords: [] };
  }
}
