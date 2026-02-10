// Meanings map: positionKey -> meaning entry
export interface MeaningEntry {
  wordText: string;
  surahName: string;
  verseNumber: number;
  meaning: string;
}

export const meaningsMap: Record<string, MeaningEntry> = {};
