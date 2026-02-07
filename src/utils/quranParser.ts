import { Surah, Verse, GhareebWord } from '@/types/quran';

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

export function parseMushafText(text: string): Surah[] {
  const lines = text.split('\n');
  const surahs: Surah[] = [];
  let currentSurah: Surah | null = null;
  let currentVerseText = '';
  let lastVerseNumber = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for surah header
    if (trimmedLine.startsWith('سُورَةُ')) {
      // Save previous surah if exists
      if (currentSurah) {
        surahs.push(currentSurah);
      }
      
      // Extract surah name
      const surahName = trimmedLine.replace('سُورَةُ', '').trim();
      currentSurah = {
        name: surahName,
        verses: [],
      };
      currentVerseText = '';
      lastVerseNumber = 0;
      continue;
    }

    if (!currentSurah) continue;

    // Skip basmalah if it's at the start of surah (except Al-Fatiha)
    if (trimmedLine.startsWith('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ') && 
        currentSurah.name !== 'الفَاتِحَةِ' &&
        currentSurah.verses.length === 0) {
      continue;
    }

    // Find verse numbers in the line (Arabic numerals like ١, ٢, ٣)
    const versePattern = /([٠-٩]+)/g;
    let match;
    let lastIndex = 0;
    const matches: { number: number; index: number }[] = [];

    while ((match = versePattern.exec(trimmedLine)) !== null) {
      const num = arabicToNumber(match[1]);
      if (num > lastVerseNumber && num <= lastVerseNumber + 5) {
        matches.push({ number: num, index: match.index });
      }
    }

    if (matches.length === 0) {
      // No verse numbers in this line, accumulate text
      currentVerseText += ' ' + trimmedLine;
    } else {
      // Process verses
      let textStart = 0;
      for (const m of matches) {
        const verseText = (currentVerseText + ' ' + trimmedLine.substring(textStart, m.index)).trim();
        
        if (verseText && m.number > 0) {
          currentSurah.verses.push({
            surahName: currentSurah.name,
            verseNumber: m.number,
            text: verseText.replace(/[٠-٩]+\s*$/, '').trim(), // Remove trailing verse number
          });
          lastVerseNumber = m.number;
        }
        
        currentVerseText = '';
        textStart = m.index + m.number.toString().length + 1;
      }
      
      // Remaining text after last verse number
      if (textStart < trimmedLine.length) {
        currentVerseText = trimmedLine.substring(textStart).trim();
      }
    }
  }

  // Don't forget the last surah
  if (currentSurah) {
    surahs.push(currentSurah);
  }

  return surahs;
}

export function parseGhareebText(text: string): GhareebWord[] {
  const lines = text.split('\n');
  const words: GhareebWord[] = [];
  let orderCounter: { [key: string]: number } = {};

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

    // Track order within each verse
    const key = `${surahName}-${verseNumber}`;
    if (!orderCounter[key]) {
      orderCounter[key] = 0;
    }
    orderCounter[key]++;

    words.push({
      surahName,
      verseNumber,
      wordText,
      meaning,
      order: orderCounter[key],
    });
  }

  return words;
}

export async function loadQuranData(): Promise<{ surahs: Surah[]; ghareebWords: GhareebWord[] }> {
  try {
    const [mushafResponse, ghareebResponse] = await Promise.all([
      fetch('/data/mushaf.txt'),
      fetch('/data/ghareeb.txt'),
    ]);

    const mushafText = await mushafResponse.text();
    const ghareebText = await ghareebResponse.text();

    const surahs = parseMushafText(mushafText);
    const ghareebWords = parseGhareebText(ghareebText);

    return { surahs, ghareebWords };
  } catch (error) {
    console.error('Error loading Quran data:', error);
    return { surahs: [], ghareebWords: [] };
  }
}
