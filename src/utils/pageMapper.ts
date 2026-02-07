// Page mapping based on the Madinah Mushaf (604 pages)
// Maps surah names to their page ranges and verse counts

interface SurahPageRange {
  start: number;
  end: number;
}

// Surah page ranges from the Madinah Mushaf
const SURAH_PAGES: Record<string, SurahPageRange> = {
  "الفاتحة": { start: 1, end: 1 },
  "البقرة": { start: 2, end: 49 },
  "آل عمران": { start: 50, end: 76 },
  "النساء": { start: 77, end: 106 },
  "المائدة": { start: 106, end: 127 },
  "الأنعام": { start: 128, end: 150 },
  "الأعراف": { start: 151, end: 176 },
  "الأنفال": { start: 177, end: 186 },
  "التوبة": { start: 187, end: 207 },
  "يونس": { start: 208, end: 221 },
  "هود": { start: 221, end: 235 },
  "يوسف": { start: 235, end: 248 },
  "الرعد": { start: 249, end: 255 },
  "إبراهيم": { start: 255, end: 261 },
  "الحجر": { start: 262, end: 267 },
  "النحل": { start: 267, end: 281 },
  "الإسراء": { start: 282, end: 293 },
  "الكهف": { start: 293, end: 304 },
  "مريم": { start: 305, end: 312 },
  "طه": { start: 312, end: 321 },
  "الأنبياء": { start: 322, end: 331 },
  "الحج": { start: 332, end: 341 },
  "المؤمنون": { start: 342, end: 349 },
  "النور": { start: 350, end: 359 },
  "الفرقان": { start: 359, end: 366 },
  "الشعراء": { start: 367, end: 376 },
  "النمل": { start: 377, end: 385 },
  "القصص": { start: 385, end: 396 },
  "العنكبوت": { start: 396, end: 404 },
  "الروم": { start: 404, end: 410 },
  "لقمان": { start: 411, end: 414 },
  "السجدة": { start: 415, end: 417 },
  "الأحزاب": { start: 418, end: 427 },
  "سبأ": { start: 428, end: 434 },
  "فاطر": { start: 434, end: 440 },
  "يس": { start: 440, end: 445 },
  "الصافات": { start: 446, end: 452 },
  "ص": { start: 453, end: 458 },
  "الزمر": { start: 458, end: 467 },
  "غافر": { start: 467, end: 476 },
  "فصلت": { start: 477, end: 482 },
  "الشورى": { start: 483, end: 489 },
  "الزخرف": { start: 489, end: 495 },
  "الدخان": { start: 496, end: 498 },
  "الجاثية": { start: 499, end: 502 },
  "الأحقاف": { start: 502, end: 506 },
  "محمد": { start: 507, end: 510 },
  "الفتح": { start: 511, end: 515 },
  "الحجرات": { start: 515, end: 517 },
  "ق": { start: 518, end: 520 },
  "الذاريات": { start: 520, end: 523 },
  "الطور": { start: 523, end: 525 },
  "النجم": { start: 526, end: 528 },
  "القمر": { start: 528, end: 531 },
  "الرحمن": { start: 531, end: 534 },
  "الواقعة": { start: 534, end: 537 },
  "الحديد": { start: 537, end: 541 },
  "المجادلة": { start: 542, end: 545 },
  "الحشر": { start: 545, end: 549 },
  "الممتحنة": { start: 549, end: 551 },
  "الصف": { start: 551, end: 552 },
  "الجمعة": { start: 553, end: 554 },
  "المنافقون": { start: 554, end: 556 },
  "التغابن": { start: 556, end: 558 },
  "الطلاق": { start: 558, end: 559 },
  "التحريم": { start: 560, end: 561 },
  "الملك": { start: 562, end: 564 },
  "القلم": { start: 564, end: 566 },
  "الحاقة": { start: 566, end: 568 },
  "المعارج": { start: 568, end: 570 },
  "نوح": { start: 570, end: 571 },
  "الجن": { start: 572, end: 573 },
  "المزمل": { start: 574, end: 575 },
  "المدثر": { start: 575, end: 577 },
  "القيامة": { start: 577, end: 578 },
  "الإنسان": { start: 578, end: 580 },
  "المرسلات": { start: 580, end: 581 },
  "النبأ": { start: 582, end: 583 },
  "النازعات": { start: 583, end: 584 },
  "عبس": { start: 585, end: 585 },
  "التكوير": { start: 586, end: 586 },
  "الانفطار": { start: 587, end: 587 },
  "المطففين": { start: 587, end: 589 },
  "الانشقاق": { start: 589, end: 589 },
  "البروج": { start: 590, end: 590 },
  "الطارق": { start: 591, end: 591 },
  "الأعلى": { start: 591, end: 591 },
  "الغاشية": { start: 592, end: 592 },
  "الفجر": { start: 593, end: 594 },
  "البلد": { start: 594, end: 594 },
  "الشمس": { start: 595, end: 595 },
  "الليل": { start: 595, end: 596 },
  "الضحى": { start: 596, end: 596 },
  "الشرح": { start: 596, end: 596 },
  "التين": { start: 597, end: 597 },
  "العلق": { start: 597, end: 597 },
  "القدر": { start: 598, end: 598 },
  "البينة": { start: 598, end: 599 },
  "الزلزلة": { start: 599, end: 599 },
  "العاديات": { start: 599, end: 600 },
  "القارعة": { start: 600, end: 600 },
  "التكاثر": { start: 600, end: 600 },
  "العصر": { start: 601, end: 601 },
  "الهمزة": { start: 601, end: 601 },
  "الفيل": { start: 601, end: 601 },
  "قريش": { start: 602, end: 602 },
  "الماعون": { start: 602, end: 602 },
  "الكوثر": { start: 602, end: 602 },
  "الكافرون": { start: 603, end: 603 },
  "النصر": { start: 603, end: 603 },
  "المسد": { start: 603, end: 603 },
  "الإخلاص": { start: 604, end: 604 },
  "الفلق": { start: 604, end: 604 },
  "الناس": { start: 604, end: 604 }
};

// Verse counts for each surah
const VERSE_COUNTS: Record<string, number> = {
  "الفاتحة": 7,
  "البقرة": 286,
  "آل عمران": 200,
  "النساء": 176,
  "المائدة": 120,
  "الأنعام": 165,
  "الأعراف": 206,
  "الأنفال": 75,
  "التوبة": 129,
  "يونس": 109,
  "هود": 123,
  "يوسف": 111,
  "الرعد": 43,
  "إبراهيم": 52,
  "الحجر": 99,
  "النحل": 128,
  "الإسراء": 111,
  "الكهف": 110,
  "مريم": 98,
  "طه": 135,
  "الأنبياء": 112,
  "الحج": 78,
  "المؤمنون": 118,
  "النور": 64,
  "الفرقان": 77,
  "الشعراء": 227,
  "النمل": 93,
  "القصص": 88,
  "العنكبوت": 69,
  "الروم": 60,
  "لقمان": 34,
  "السجدة": 30,
  "الأحزاب": 73,
  "سبأ": 54,
  "فاطر": 45,
  "يس": 83,
  "الصافات": 182,
  "ص": 88,
  "الزمر": 75,
  "غافر": 85,
  "فصلت": 54,
  "الشورى": 53,
  "الزخرف": 89,
  "الدخان": 59,
  "الجاثية": 37,
  "الأحقاف": 35,
  "محمد": 38,
  "الفتح": 29,
  "الحجرات": 18,
  "ق": 45,
  "الذاريات": 60,
  "الطور": 49,
  "النجم": 62,
  "القمر": 55,
  "الرحمن": 78,
  "الواقعة": 96,
  "الحديد": 29,
  "المجادلة": 22,
  "الحشر": 24,
  "الممتحنة": 13,
  "الصف": 14,
  "الجمعة": 11,
  "المنافقون": 11,
  "التغابن": 18,
  "الطلاق": 12,
  "التحريم": 12,
  "الملك": 30,
  "القلم": 52,
  "الحاقة": 52,
  "المعارج": 44,
  "نوح": 28,
  "الجن": 28,
  "المزمل": 20,
  "المدثر": 56,
  "القيامة": 40,
  "الإنسان": 31,
  "المرسلات": 50,
  "النبأ": 40,
  "النازعات": 46,
  "عبس": 42,
  "التكوير": 29,
  "الانفطار": 19,
  "المطففين": 36,
  "الانشقاق": 25,
  "البروج": 22,
  "الطارق": 17,
  "الأعلى": 19,
  "الغاشية": 26,
  "الفجر": 30,
  "البلد": 20,
  "الشمس": 15,
  "الليل": 21,
  "الضحى": 11,
  "الشرح": 8,
  "التين": 8,
  "العلق": 19,
  "القدر": 5,
  "البينة": 8,
  "الزلزلة": 8,
  "العاديات": 11,
  "القارعة": 11,
  "التكاثر": 8,
  "العصر": 3,
  "الهمزة": 9,
  "الفيل": 5,
  "قريش": 4,
  "الماعون": 7,
  "الكوثر": 3,
  "الكافرون": 6,
  "النصر": 3,
  "المسد": 5,
  "الإخلاص": 4,
  "الفلق": 5,
  "الناس": 6
};

/**
 * Calculate the page number for a ghareeb word based on surah and verse
 */
export function calculatePageNumber(surahName: string, verseNumber: number): number {
  const pageRange = SURAH_PAGES[surahName];
  const verseCount = VERSE_COUNTS[surahName];
  
  if (!pageRange || !verseCount) {
    return -1;
  }
  
  const { start, end } = pageRange;
  const pagesForSurah = end - start + 1;
  
  // Calculate approximate page based on verse position within surah
  const verseRatio = (verseNumber - 1) / verseCount;
  const pageOffset = Math.floor(verseRatio * pagesForSurah);
  
  return Math.min(start + pageOffset, end);
}

/**
 * Get all pages where a surah appears
 */
export function getSurahPages(surahName: string): number[] {
  const pageRange = SURAH_PAGES[surahName];
  if (!pageRange) return [];
  
  const pages: number[] = [];
  for (let p = pageRange.start; p <= pageRange.end; p++) {
    pages.push(p);
  }
  return pages;
}

/**
 * Check if a word could appear on a specific page based on surah/verse
 */
export function isWordOnPage(surahName: string, verseNumber: number, pageNumber: number): boolean {
  const pageRange = SURAH_PAGES[surahName];
  if (!pageRange) return false;
  
  // If page is outside surah range, definitely not
  if (pageNumber < pageRange.start || pageNumber > pageRange.end) {
    return false;
  }
  
  // Calculate expected page and allow ±1 page tolerance
  const expectedPage = calculatePageNumber(surahName, verseNumber);
  return Math.abs(pageNumber - expectedPage) <= 1;
}

export { SURAH_PAGES, VERSE_COUNTS };
