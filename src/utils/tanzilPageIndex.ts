/**
 * Tanzil Page Index for Medina Mushaf
 * Based on official Tanzil metadata (quran-data.xml)
 * Each entry: [surah, startAyah] -> page starts at this surah/ayah
 */

// Array of [surah, ayah] - index corresponds to (page - 1)
export const tanzilPageIndex: [number, number][] = [
  [1, 1],   // Page 1
  [2, 1],   // Page 2
  [2, 6],   // Page 3
  [2, 17],  // Page 4
  [2, 25],  // Page 5
  [2, 30],  // Page 6
  [2, 38],  // Page 7
  [2, 49],  // Page 8
  [2, 58],  // Page 9
  [2, 62],  // Page 10
  [2, 70],  // Page 11
  [2, 77],  // Page 12
  [2, 84],  // Page 13
  [2, 89],  // Page 14
  [2, 94],  // Page 15
  [2, 102], // Page 16
  [2, 106], // Page 17
  [2, 113], // Page 18
  [2, 120], // Page 19
  [2, 127], // Page 20
  [2, 135], // Page 21
  [2, 142], // Page 22
  [2, 146], // Page 23
  [2, 154], // Page 24
  [2, 164], // Page 25
  [2, 170], // Page 26
  [2, 177], // Page 27
  [2, 182], // Page 28
  [2, 187], // Page 29
  [2, 191], // Page 30
  [2, 197], // Page 31
  [2, 203], // Page 32
  [2, 211], // Page 33
  [2, 216], // Page 34
  [2, 220], // Page 35
  [2, 225], // Page 36
  [2, 231], // Page 37
  [2, 234], // Page 38
  [2, 238], // Page 39
  [2, 246], // Page 40
  [2, 249], // Page 41
  [2, 253], // Page 42
  [2, 257], // Page 43
  [2, 260], // Page 44
  [2, 265], // Page 45
  [2, 270], // Page 46
  [2, 275], // Page 47
  [2, 282], // Page 48
  [2, 283], // Page 49
  [3, 1],   // Page 50
  [3, 10],  // Page 51
  [3, 16],  // Page 52
  [3, 23],  // Page 53
  [3, 30],  // Page 54
  [3, 38],  // Page 55
  [3, 46],  // Page 56
  [3, 53],  // Page 57
  [3, 62],  // Page 58
  [3, 71],  // Page 59
  [3, 78],  // Page 60
  [3, 84],  // Page 61
  [3, 92],  // Page 62
  [3, 101], // Page 63
  [3, 109], // Page 64
  [3, 116], // Page 65
  [3, 122], // Page 66
  [3, 133], // Page 67
  [3, 141], // Page 68
  [3, 149], // Page 69
  [3, 154], // Page 70
  [3, 158], // Page 71
  [3, 166], // Page 72
  [3, 174], // Page 73
  [3, 181], // Page 74
  [3, 187], // Page 75
  [3, 195], // Page 76
  [4, 1],   // Page 77
  [4, 7],   // Page 78
  [4, 12],  // Page 79
  [4, 15],  // Page 80
  [4, 20],  // Page 81
  [4, 24],  // Page 82
  [4, 27],  // Page 83
  [4, 34],  // Page 84
  [4, 38],  // Page 85
  [4, 45],  // Page 86
  [4, 52],  // Page 87
  [4, 60],  // Page 88
  [4, 66],  // Page 89
  [4, 75],  // Page 90
  [4, 80],  // Page 91
  [4, 87],  // Page 92
  [4, 92],  // Page 93
  [4, 95],  // Page 94
  [4, 102], // Page 95
  [4, 106], // Page 96
  [4, 114], // Page 97
  [4, 122], // Page 98
  [4, 128], // Page 99
  [4, 135], // Page 100
];

// Full 604 pages - will be loaded from XML for complete data
let fullPageIndex: [number, number][] | null = null;

/**
 * Parse tanzil-metadata.xml and extract page boundaries
 */
export async function loadTanzilPageIndex(): Promise<[number, number][]> {
  if (fullPageIndex) return fullPageIndex;
  
  try {
    const response = await fetch('/data/tanzil-metadata.xml');
    const xmlText = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    const pages = doc.querySelectorAll('page');
    const index: [number, number][] = [];
    
    pages.forEach(page => {
      const sura = parseInt(page.getAttribute('sura') || '1', 10);
      const aya = parseInt(page.getAttribute('aya') || '1', 10);
      index.push([sura, aya]);
    });
    
    fullPageIndex = index;
    console.log(`Loaded Tanzil page index: ${index.length} pages`);
    return index;
  } catch (error) {
    console.error('Failed to load Tanzil metadata, using partial index:', error);
    return tanzilPageIndex;
  }
}

/**
 * Get page number for a given surah and ayah using Tanzil's Medina Mushaf mapping
 */
export function getPageForAyah(
  surah: number,
  ayah: number,
  pageIndex: [number, number][]
): number {
  // Binary search for the correct page
  let left = 0;
  let right = pageIndex.length - 1;
  let result = 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const [pageSurah, pageAyah] = pageIndex[mid];
    
    // Compare: is this ayah on or after this page's start?
    if (surah > pageSurah || (surah === pageSurah && ayah >= pageAyah)) {
      result = mid + 1; // Page numbers are 1-indexed
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return result;
}
