import { QuranPage, GhareebWord } from '@/types/quran';

// Surah name to page number mapping (approximate start pages)
const SURAH_PAGES: { [key: string]: number } = {
  'الفاتحة': 1, 'البقرة': 2, 'آل عمران': 50, 'النساء': 77, 'المائدة': 106,
  'الأنعام': 128, 'الأعراف': 151, 'الأنفال': 177, 'التوبة': 187, 'يونس': 208,
  'هود': 221, 'يوسف': 235, 'الرعد': 249, 'إبراهيم': 255, 'الحجر': 262,
  'النحل': 267, 'الإسراء': 282, 'الكهف': 293, 'مريم': 305, 'طه': 312,
  'الأنبياء': 322, 'الحج': 332, 'المؤمنون': 342, 'النور': 350, 'الفرقان': 359,
  'الشعراء': 367, 'النمل': 377, 'القصص': 385, 'العنكبوت': 396, 'الروم': 404,
  'لقمان': 411, 'السجدة': 415, 'الأحزاب': 418, 'سبأ': 428, 'فاطر': 434,
  'يس': 440, 'الصافات': 446, 'ص': 453, 'الزمر': 458, 'غافر': 467,
  'فصلت': 477, 'الشورى': 483, 'الزخرف': 489, 'الدخان': 496, 'الجاثية': 499,
  'الأحقاف': 502, 'محمد': 507, 'الفتح': 511, 'الحجرات': 515, 'ق': 518,
  'الذاريات': 520, 'الطور': 523, 'النجم': 526, 'القمر': 528, 'الرحمن': 531,
  'الواقعة': 534, 'الحديد': 537, 'المجادلة': 542, 'الحشر': 545, 'الممتحنة': 549,
  'الصف': 551, 'الجمعة': 553, 'المنافقون': 554, 'التغابن': 556, 'الطلاق': 558,
  'التحريم': 560, 'الملك': 562, 'القلم': 564, 'الحاقة': 566, 'المعارج': 568,
  'نوح': 570, 'الجن': 572, 'المزمل': 574, 'المدثر': 575, 'القيامة': 577,
  'الإنسان': 578, 'المرسلات': 580, 'النبأ': 582, 'النازعات': 583, 'عبس': 585,
  'التكوير': 586, 'الانفطار': 587, 'المطففين': 587, 'الانشقاق': 589, 'البروج': 590,
  'الطارق': 591, 'الأعلى': 591, 'الغاشية': 592, 'الفجر': 593, 'البلد': 594,
  'الشمس': 595, 'الليل': 595, 'الضحى': 596, 'الشرح': 596, 'التين': 597,
  'العلق': 597, 'القدر': 598, 'البينة': 598, 'الزلزلة': 599, 'العاديات': 599,
  'القارعة': 600, 'التكاثر': 600, 'العصر': 601, 'الهمزة': 601, 'الفيل': 601,
  'قريش': 602, 'الماعون': 602, 'الكوثر': 602, 'الكافرون': 603, 'النصر': 603,
  'المسد': 603, 'الإخلاص': 604, 'الفلق': 604, 'الناس': 604,
};

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

// Normalize surah name for comparison
function normalizeSurahName(name: string): string {
  return name
    .replace(/ٱ/g, 'ا')
    .replace(/ٰ/g, 'ا')
    .replace(/ۡ/g, '')
    .replace(/ۢ/g, '')
    .replace(/ۧ/g, '')
    .replace(/ۖ/g, '')
    .replace(/ۗ/g, '')
    .replace(/ۘ/g, '')
    .replace(/ۚ/g, '')
    .replace(/ۛ/g, '')
    .replace(/ۜ/g, '')
    .replace(/ُ/g, '')
    .replace(/ِ/g, '')
    .replace(/َ/g, '')
    .replace(/ّ/g, '')
    .replace(/ً/g, '')
    .replace(/ٍ/g, '')
    .replace(/ٌ/g, '')
    .replace(/ْ/g, '')
    .replace(/ٓ/g, '')
    .replace(/ٔ/g, '')
    .replace(/ٕ/g, '')
    .replace(/ـ/g, '')
    .trim();
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

  return pages;
}

export function parseGhareebText(text: string, pages: QuranPage[]): GhareebWord[] {
  const lines = text.split('\n');
  const words: GhareebWord[] = [];
  
  // Create a map of surah names to their page ranges
  const surahToPages: { [key: string]: number[] } = {};
  for (const page of pages) {
    if (page.surahName) {
      const normalized = normalizeSurahName(page.surahName);
      if (!surahToPages[normalized]) {
        surahToPages[normalized] = [];
      }
      surahToPages[normalized].push(page.pageNumber);
    }
  }

  // Track order within each page
  const pageOrderCounter: { [pageNum: number]: number } = {};

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

    // Find page number based on surah
    // Use the SURAH_PAGES mapping as a base estimate
    let pageNumber = SURAH_PAGES[surahName] || 1;
    
    // Try to find a more accurate page by searching page text
    for (const page of pages) {
      if (page.text.includes(wordText)) {
        // Check if this page contains content from the right surah
        const normalizedSurah = normalizeSurahName(surahName);
        const normalizedPageSurah = page.surahName ? normalizeSurahName(page.surahName) : '';
        
        if (normalizedPageSurah.includes(normalizedSurah) || 
            normalizedSurah.includes(normalizedPageSurah) ||
            page.pageNumber >= pageNumber) {
          pageNumber = page.pageNumber;
          break;
        }
      }
    }

    // Track order within the page
    if (!pageOrderCounter[pageNumber]) {
      pageOrderCounter[pageNumber] = 0;
    }
    pageOrderCounter[pageNumber]++;

    words.push({
      pageNumber,
      wordText,
      meaning,
      surahName,
      verseNumber,
      order: pageOrderCounter[pageNumber],
    });
  }

  return words.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.order - b.order;
  });
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
    const ghareebWords = parseGhareebText(ghareebText, pages);

    console.log(`Loaded ${pages.length} pages and ${ghareebWords.length} ghareeb words`);

    return { pages, ghareebWords };
  } catch (error) {
    console.error('Error loading Quran data:', error);
    return { pages: [], ghareebWords: [] };
  }
}
