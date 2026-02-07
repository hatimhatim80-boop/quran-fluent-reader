import { QuranPage, GhareebWord } from '@/types/quran';

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

export function parseGhareebText(text: string, pages: QuranPage[]): GhareebWord[] {
  const lines = text.split('\n');
  const words: GhareebWord[] = [];
  
  // Pre-process pages: create normalized versions for searching
  const processedPages = pages.map(p => ({
    pageNumber: p.pageNumber,
    normalizedText: normalizeArabic(p.text),
    originalText: p.text,
  }));

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

    // Normalize the ghareeb word for searching
    const normalizedWord = normalizeArabic(wordText);
    
    // Skip if normalization resulted in empty string
    if (!normalizedWord || normalizedWord.length < 2) continue;
    
    // Find the page that contains this word
    let foundPageNumber = -1;
    
    // First try: exact phrase match
    for (const page of processedPages) {
      if (page.normalizedText.includes(normalizedWord)) {
        foundPageNumber = page.pageNumber;
        break;
      }
    }
    
    // Second try: match individual significant words from the phrase
    if (foundPageNumber === -1) {
      const wordParts = normalizedWord.split(' ').filter(w => w.length >= 3);
      if (wordParts.length > 0) {
        // Try matching the longest word
        const longestWord = wordParts.reduce((a, b) => a.length >= b.length ? a : b);
        for (const page of processedPages) {
          if (page.normalizedText.includes(longestWord)) {
            foundPageNumber = page.pageNumber;
            break;
          }
        }
      }
    }
    
    // Third try: more flexible matching
    if (foundPageNumber === -1) {
      const wordParts = normalizedWord.split(' ').filter(w => w.length >= 2);
      for (const wordPart of wordParts) {
        for (const page of processedPages) {
          if (page.normalizedText.includes(wordPart)) {
            foundPageNumber = page.pageNumber;
            break;
          }
        }
        if (foundPageNumber !== -1) break;
      }
    }
    
    if (foundPageNumber === -1) {
      notFoundCount++;
      continue; // Skip words we can't find
    }

    foundCount++;
    words.push({
      pageNumber: foundPageNumber,
      wordText,
      meaning,
      surahName,
      verseNumber,
      order: words.filter(w => w.pageNumber === foundPageNumber).length + 1,
    });
  }

  console.log(`Ghareeb words: ${foundCount} found, ${notFoundCount} not found`);
  
  return words.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
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
