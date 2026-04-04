import { describe, it, expect } from 'vitest';
import { canonicalize, buildFlatTokens, matchGhareebToTokens } from '@/utils/canonicalMatch';
import { GhareebWord } from '@/types/quran';

// ── Canonicalize ────────────────────────────────────────────────────────────

describe('canonicalize', () => {
  it('strips diacritics and normalizes alef variants', () => {
    expect(canonicalize('ٱلتَّنَاوُشُ')).toBe('التناوش');
    expect(canonicalize('وَأَنَّىٰ')).toBe('واني');
    expect(canonicalize('بَعِيدٖ')).toBe('بعيد');
  });

  it('normalizes teh marbuta and hamza variants', () => {
    expect(canonicalize('رَحۡمَةٍ')).toBe('رحمه');
    expect(canonicalize('ٱلسَّمَآءِ')).toBe('السما');
    expect(canonicalize('مُؤۡمِنُونَ')).toBe('مومنون');
  });

  it('handles alef wasla, superscript alef, tatweel', () => {
    expect(canonicalize('ٱللَّهِ')).toBe('الله');
    expect(canonicalize('ـٱلـحـق')).toBe('الحق');
  });

  it('trims and collapses whitespace', () => {
    expect(canonicalize('  وَمِنۡ   حَوۡلِهَا  ')).toBe('ومن حولها');
  });
});

// ── Cross-line phrase matching ──────────────────────────────────────────────

function makeGhareebWord(overrides: Partial<GhareebWord> & { wordText: string; surahName: string; verseNumber: number }): GhareebWord {
  return {
    pageNumber: 444,
    meaning: 'test',
    surahNumber: 34,
    wordIndex: 1,
    order: 0,
    uniqueKey: `${overrides.surahNumber || 34}_${overrides.verseNumber}_1`,
    ...overrides,
  };
}

const isHeader = (l: string) => l.startsWith('سُورَةُ') || l.startsWith('سورة ');
const isBismillah = (l: string) => l.includes('بسم الله');

describe('matchGhareebToTokens', () => {
  it('matches a single word on one line', () => {
    const lines = ['مَّكَانٖ قَرِيبٖ ٥١ وَقَالُوٓاْ ءَامَنَّا بِهِۦ'];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [makeGhareebWord({ wordText: 'ءَامَنَّا', surahName: 'سبأ', verseNumber: 52 })];
    // verse 52 not found next → should still match (no verse check blocks it)
    const results = matchGhareebToTokens(flat, ghareeb, ['سبأ']);
    expect(results.length).toBe(1);
    expect(results[0].word.wordText).toBe('ءَامَنَّا');
  });

  it('matches a phrase spanning two lines', () => {
    const lines = [
      'مَّكَانٖ قَرِيبٖ ٥١ وَقَالُوٓاْ ءَامَنَّا بِهِۦ وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن',
      'مَّكَانِۢ بَعِيدٖ ٥٢ وَقَدۡ كَفَرُواْ بِهِۦ مِن قَبۡلُۖ',
    ];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [
      makeGhareebWord({
        wordText: 'وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن مَّكَانِۭ بَعِيدࣲ',
        surahName: 'سبأ',
        surahNumber: 34,
        verseNumber: 52,
      }),
    ];
    const surahCtx = ['سبأ', 'سبأ'];
    const results = matchGhareebToTokens(flat, ghareeb, surahCtx);
    expect(results.length).toBe(1);
    // Phrase should span tokens from both lines
    const matchedLines = new Set(results[0].matchedTokens.map(ft => ft.lineIdx));
    expect(matchedLines.size).toBe(2);
  });

  it('matches two independent phrases in the same verse without collision', () => {
    const lines = [
      'مَّكَانٖ قَرِيبٖ ٥١ وَقَالُوٓاْ ءَامَنَّا بِهِۦ وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن',
      'مَّكَانِۢ بَعِيدٖ ٥٢ وَقَدۡ كَفَرُواْ بِهِۦ مِن قَبۡلُۖ وَيَقۡذِفُونَ',
      'بِٱلۡغَيۡبِ مِن مَّكَانِۢ بَعِيدٖ ٥٣',
    ];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [
      makeGhareebWord({
        wordText: 'وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن مَّكَانِۭ بَعِيدࣲ',
        surahName: 'سبأ',
        surahNumber: 34,
        verseNumber: 52,
        uniqueKey: '34_52_1',
      }),
      makeGhareebWord({
        wordText: 'وَيَقۡذِفُونَ بِٱلۡغَيۡبِ مِن مَّكَانِۭ بَعِيدࣲ',
        surahName: 'سبأ',
        surahNumber: 34,
        verseNumber: 53,
        uniqueKey: '34_53_1',
        wordIndex: 2,
      }),
    ];
    const surahCtx = ['سبأ', 'سبأ', 'سبأ'];
    const results = matchGhareebToTokens(flat, ghareeb, surahCtx);
    expect(results.length).toBe(2);
  });

  it('does not match phrase to wrong verse number', () => {
    const lines = [
      'وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن مَّكَانِۢ بَعِيدٖ ٥٢',
    ];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [
      makeGhareebWord({
        wordText: 'وَأَنَّىٰ لَهُمُ ٱلتَّنَاوُشُ مِن مَّكَانِۭ بَعِيدࣲ',
        surahName: 'سبأ',
        surahNumber: 34,
        verseNumber: 99, // wrong verse
      }),
    ];
    const results = matchGhareebToTokens(flat, ghareeb, ['سبأ']);
    expect(results.length).toBe(0);
  });

  it('handles alef/hamza normalization differences', () => {
    const lines = ['إِنَّا أَنزَلۡنَٰهُ فِي لَيۡلَةِ ٱلۡقَدۡرِ ١'];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [
      makeGhareebWord({
        wordText: 'أَنزَلۡنَٰهُ',
        surahName: 'القدر',
        surahNumber: 97,
        verseNumber: 1,
      }),
    ];
    const results = matchGhareebToTokens(flat, ghareeb, ['القدر']);
    expect(results.length).toBe(1);
  });

  it('loose match handles prefix stripping (و ف ب ل)', () => {
    const lines = ['وَٱلسَّمَآءَ بَنَيۡنَٰهَا ١'];
    const flat = buildFlatTokens(lines, isHeader, isBismillah);
    const ghareeb = [
      makeGhareebWord({
        wordText: 'ٱلسَّمَآءَ',
        surahName: 'الذاريات',
        surahNumber: 51,
        verseNumber: 1,
      }),
    ];
    const results = matchGhareebToTokens(flat, ghareeb, ['الذاريات']);
    expect(results.length).toBe(1);
  });
});
