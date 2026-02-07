import { QuranPage } from '@/types/quran';

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
