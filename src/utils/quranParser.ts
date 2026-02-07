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

// Remove diacritics for comparison (but keep the letter forms)
function removeDiacritics(text: string): string {
  return text
    // Remove common Arabic diacritics
    .replace(/[\u064B-\u065F]/g, '') // Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun, etc.
    .replace(/[\u0670]/g, '') // Superscript alef
    .replace(/[\u06D6-\u06DC]/g, '') // Small high ligatures
    .replace(/[\u06DF-\u06E4]/g, '') // Small high marks
    .replace(/[\u06E7-\u06E8]/g, '') // Small high yeh/noon
    .replace(/[\u06EA-\u06ED]/g, '') // Small low marks
    .replace(/ٱ/g, 'ا') // Alef wasla to regular alef
    .replace(/ٰ/g, 'ا') // Superscript alef to regular alef
    .replace(/ۡ/g, '') // Small high rounded zero
    .replace(/ۢ/g, '') // Small high seen
    .replace(/ۥ/g, '') // Small waw
    .replace(/ۦ/g, '') // Small yeh
    .replace(/ۧ/g, '') // Small high yeh
    .replace(/ۨ/g, '') // Small high noon
    .replace(/۩/g, '') // Sajdah mark
    .replace(/۪/g, '') // Empty centre low stop
    .replace(/۫/g, '') // Empty centre high stop
    .replace(/۬/g, '') // Rounded high stop
    .replace(/ۭ/g, '') // Small low meem
    .replace(/ۖ/g, '') // Small high ligature
    .replace(/ۗ/g, '')
    .replace(/ۘ/g, '')
    .replace(/ۙ/g, '')
    .replace(/ۚ/g, '')
    .replace(/ۛ/g, '')
    .replace(/ۜ/g, '')
    .replace(/۟/g, '')
    .replace(/۠/g, '')
    .replace(/ۤ/g, '')
    .replace(/ﷺ/g, '')
    .replace(/﷽/g, '')
    .trim();
}

// Check if two Arabic texts match (ignoring diacritics)
function arabicMatch(text1: string, text2: string): boolean {
  const clean1 = removeDiacritics(text1);
  const clean2 = removeDiacritics(text2);
  return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
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
  
  // Create searchable versions of pages (without diacritics)
  const pageSearchable = pages.map(p => ({
    pageNumber: p.pageNumber,
    cleanText: removeDiacritics(p.text),
    originalText: p.text,
  }));

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

    const cleanWordForSearch = removeDiacritics(wordText);
    
    // Find all pages that contain this word
    let foundPageNumber = -1;
    
    for (const page of pageSearchable) {
      if (page.cleanText.includes(cleanWordForSearch)) {
        foundPageNumber = page.pageNumber;
        break; // Take the first match
      }
    }
    
    // If not found, skip this word (it might be a variant spelling)
    if (foundPageNumber === -1) {
      console.log(`Word not found in pages: ${wordText} (${surahName} ${verseNumber})`);
      continue;
    }

    words.push({
      pageNumber: foundPageNumber,
      wordText,
      meaning,
      surahName,
      verseNumber,
      order: words.filter(w => w.pageNumber === foundPageNumber).length + 1,
    });
  }

  console.log(`Parsed ${words.length} ghareeb words`);
  
  return words.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.order - b.order;
  });
}

// Export for use in PageView
export { removeDiacritics, arabicMatch };

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
