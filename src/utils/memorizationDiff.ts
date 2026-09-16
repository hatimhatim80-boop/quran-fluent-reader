/**
 * Word-level comparison between the Quranic text of a memorization unit and
 * the text the speech engine produced for the student.
 *
 * Three texts are kept strictly apart:
 *   - the original Quranic text (never altered, always what the UI shows)
 *   - the raw recognizer output
 *   - the normalized forms, used for matching only
 */

import { normalizeSpeechArabic, splitWords, similarity } from './quranSpeechMatch';

export type DiffStatus = 'correct' | 'missing' | 'extra' | 'different' | 'order' | 'unclear';

export interface DiffToken {
  status: DiffStatus;
  /** Original Quranic word (empty for an extra spoken word). */
  expected: string;
  /** What the engine heard at this position (empty for a missing word). */
  heard: string;
}

export interface DiffReport {
  tokens: DiffToken[];
  correct: number;
  total: number;
  /** 0..1, informational only — the token list is the real result. */
  score: number;
  /** True when too much of the attempt is doubtful to judge the student. */
  doubtful: boolean;
}

/** A substitution this close is much more likely an engine slip than a mistake. */
const UNCLEAR_THRESHOLD = 0.62;
const EQUAL_THRESHOLD = 0.86;

export function compareRecitation(expectedText: string, heardText: string): DiffReport {
  const expectedWords = splitWords(expectedText);
  const heardWords = splitWords(heardText);
  const exp = expectedWords.map(w => normalizeSpeechArabic(w)).filter((_, i) => true);
  const heard = heardWords.map(w => normalizeSpeechArabic(w));

  const n = exp.length;
  const m = heard.length;

  // Word-level edit distance with a fuzzy substitution cost.
  const cost = (i: number, j: number) => (similarity(exp[i], heard[j]) >= EQUAL_THRESHOLD ? 0 : 1);
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost(i - 1, j - 1),
      );
    }
  }

  const tokens: DiffToken[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + cost(i - 1, j - 1)) {
      const sim = similarity(exp[i - 1], heard[j - 1]);
      const status: DiffStatus =
        sim >= EQUAL_THRESHOLD ? 'correct' : sim >= UNCLEAR_THRESHOLD ? 'unclear' : 'different';
      tokens.push({ status, expected: expectedWords[i - 1], heard: heardWords[j - 1] });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      tokens.push({ status: 'missing', expected: expectedWords[i - 1], heard: '' });
      i--;
    } else if (j > 0) {
      tokens.push({ status: 'extra', expected: '', heard: heardWords[j - 1] });
      j--;
    } else {
      break;
    }
  }
  tokens.reverse();

  // A word that is "missing" here but shows up as "extra" elsewhere is an
  // ordering problem, not a forgotten word.
  const extraNorm = new Map<string, number[]>();
  tokens.forEach((t, idx) => {
    if (t.status !== 'extra') return;
    const key = normalizeSpeechArabic(t.heard);
    const list = extraNorm.get(key) || [];
    list.push(idx);
    extraNorm.set(key, list);
  });
  tokens.forEach(t => {
    if (t.status !== 'missing') return;
    const key = normalizeSpeechArabic(t.expected);
    const hits = extraNorm.get(key);
    if (hits && hits.length > 0) {
      const idx = hits.shift()!;
      t.status = 'order';
      tokens[idx].status = 'order';
    }
  });

  const graded = tokens.filter(t => t.expected);
  const correct = graded.filter(t => t.status === 'correct').length;
  const unclear = graded.filter(t => t.status === 'unclear').length;
  const total = graded.length || 1;

  return {
    tokens,
    correct,
    total: graded.length,
    score: correct / total,
    // Nothing heard at all, or most of it doubtful → do not blame the student.
    doubtful: heardWords.length === 0 || unclear / total > 0.4,
  };
}

export const DIFF_LABEL: Record<DiffStatus, string> = {
  correct: 'صحيح',
  missing: 'كلمة ناقصة',
  extra: 'كلمة زائدة',
  different: 'كلمة مختلفة',
  order: 'اختلاف في الترتيب',
  unclear: 'غير واضح',
};
