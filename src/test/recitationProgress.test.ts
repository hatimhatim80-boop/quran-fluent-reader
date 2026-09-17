import { describe, expect, it } from 'vitest';
import { matchRecitationProgress } from '@/utils/quranSpeechMatch';

describe('matchRecitationProgress', () => {
  const words = ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَٰلَمِينَ'];

  it('tracks ordered progress while preserving canonical display words', () => {
    expect(matchRecitationProgress(words, 'الحمد لله').matchedCount).toBe(2);
    expect(words[0]).toBe('ٱلْحَمْدُ');
  });

  it('tolerates unrelated recognizer tokens without skipping Quran order', () => {
    expect(matchRecitationProgress(words, 'صوت الحمد ضوضاء لله')).toEqual({ matchedCount: 2, nextIndex: 2 });
  });

  it('does not advance to a later Quran word before the current word', () => {
    expect(matchRecitationProgress(words, 'رب العالمين').matchedCount).toBe(0);
  });
});