import { describe, expect, it } from 'vitest';
import { computeDistributedBlanksDetailed, type TokenInfo } from '@/utils/distributedBlanking';

function buildSampleData() {
  const ayahGroups: TokenInfo[][] = [
    [
      { text: 'الحمد', lineIdx: 0, tokenIdx: 0, key: '0_0', hasWaqf: false, waqfMark: '' },
      { text: 'لله', lineIdx: 0, tokenIdx: 1, key: '0_1', hasWaqf: false, waqfMark: '' },
      { text: 'رب', lineIdx: 0, tokenIdx: 2, key: '0_2', hasWaqf: false, waqfMark: '' },
      { text: 'العالمين', lineIdx: 0, tokenIdx: 3, key: '0_3', hasWaqf: false, waqfMark: '' },
    ],
    [
      { text: 'الرحمن', lineIdx: 1, tokenIdx: 0, key: '1_0', hasWaqf: false, waqfMark: '' },
      { text: 'الرحيم', lineIdx: 1, tokenIdx: 1, key: '1_1', hasWaqf: false, waqfMark: '' },
      { text: 'مالك', lineIdx: 1, tokenIdx: 2, key: '1_2', hasWaqf: false, waqfMark: '' },
      { text: 'يوم', lineIdx: 1, tokenIdx: 3, key: '1_3', hasWaqf: false, waqfMark: '' },
    ],
    [
      { text: 'الدين', lineIdx: 2, tokenIdx: 0, key: '2_0', hasWaqf: false, waqfMark: '' },
      { text: 'إياك', lineIdx: 2, tokenIdx: 1, key: '2_1', hasWaqf: false, waqfMark: '' },
      { text: 'نعبد', lineIdx: 2, tokenIdx: 2, key: '2_2', hasWaqf: false, waqfMark: '' },
      { text: 'ونستعين', lineIdx: 2, tokenIdx: 3, key: '2_3', hasWaqf: false, waqfMark: '' },
    ],
  ];

  const noise: TokenInfo[] = [
    { text: '١', lineIdx: 3, tokenIdx: 0, key: '3_0', hasWaqf: false, waqfMark: '' },
    { text: 'ۖ', lineIdx: 3, tokenIdx: 1, key: '3_1', hasWaqf: true, waqfMark: 'ۖ' },
    { text: '۞', lineIdx: 3, tokenIdx: 2, key: '3_2', hasWaqf: false, waqfMark: '' },
  ];

  return {
    ayahGroups,
    allWordTokens: [...ayahGroups.flat(), ...noise],
  };
}

describe('computeDistributedBlanksDetailed', () => {
  it('A) ayah mode blanks ayat only (no word branch count)', () => {
    const { ayahGroups, allWordTokens } = buildSampleData();
    const result = computeDistributedBlanksDetailed({
      reviewMode: 'ayah',
      distributionMode: 'sequential',
      hiddenAyatCount: 2,
      hiddenWordsCount: 5,
      seed: 42,
      ayahGroups,
      allWordTokens,
      hiddenWordsMode: 'fixed-count',
      hiddenWordsPercentage: 50,
    });

    expect(result.selectedAyatCount).toBe(2);
    expect(result.selectedWordCount).toBe(0);
  });

  it('B) word mode fixed-count=4 selects exactly 4 words', () => {
    const { ayahGroups, allWordTokens } = buildSampleData();
    const result = computeDistributedBlanksDetailed({
      reviewMode: 'word',
      distributionMode: 'page-scattered',
      hiddenAyatCount: 2,
      hiddenWordsCount: 4,
      seed: 42,
      ayahGroups,
      allWordTokens,
      hiddenWordsMode: 'fixed-count',
    });

    expect(result.selectedAyatCount).toBe(0);
    expect(result.selectedWordCount).toBe(4);
    expect(result.keys.size).toBe(4);
  });

  it('C) word mode fixed-count clamps to max available words', () => {
    const { ayahGroups, allWordTokens } = buildSampleData();
    const result = computeDistributedBlanksDetailed({
      reviewMode: 'word',
      distributionMode: 'sequential',
      hiddenAyatCount: 2,
      hiddenWordsCount: 50,
      seed: 42,
      ayahGroups,
      allWordTokens,
      hiddenWordsMode: 'fixed-count',
      wordSequenceMode: 'allow-cross-ayah',
    });

    expect(result.selectedAyatCount).toBe(0);
    expect(result.selectedWordCount).toBe(12);
    expect(result.keys.size).toBe(12);
  });

  it('D) mixed mode applies both branches clearly', () => {
    const { ayahGroups, allWordTokens } = buildSampleData();
    const result = computeDistributedBlanksDetailed({
      reviewMode: 'mixed',
      distributionMode: 'sequential',
      hiddenAyatCount: 2,
      hiddenWordsCount: 3,
      seed: 42,
      ayahGroups,
      allWordTokens,
      hiddenWordsMode: 'fixed-count',
      wordSequenceMode: 'allow-cross-ayah',
    });

    expect(result.selectedAyatCount).toBe(2);
    expect(result.selectedWordCount).toBe(3);
    expect(result.keys.size).toBe(11);
  });
});