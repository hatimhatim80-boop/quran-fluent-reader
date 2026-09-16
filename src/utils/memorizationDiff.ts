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
  /** At least one word could not be judged with confidence. */
  hasUnclear: boolean;
  /** The engine clearly returned less than what was expected. */
  truncated: boolean;
  /** Safe to approve memorization automatically. */
  approvable: boolean;
}

/** A substitution this close is much more likely an engine slip than a mistake. */
const UNCLEAR_THRESHOLD = 0.62;
const EQUAL_THRESHOLD = 0.86;
/** Short Quranic words differ by a single letter — fuzzy distance is unsafe. */
const SHORT_WORD_LEN = 3;

function judge(expNorm: string, heardNorm: string): DiffStatus {
  if (!expNorm || !heardNorm) return 'unclear';
  if (expNorm === heardNorm) return 'correct';
  const sim = similarity(expNorm, heardNorm);
  // For short, look-alike words an approximate match proves nothing.
  if (expNorm.length <= SHORT_WORD_LEN || heardNorm.length <= SHORT_WORD_LEN) {
    return sim >= UNCLEAR_THRESHOLD ? 'unclear' : 'different';
  }
  if (sim >= EQUAL_THRESHOLD) return 'correct';
  return sim >= UNCLEAR_THRESHOLD ? 'unclear' : 'different';
}

export function compareRecitation(expectedText: string, heardText: string): DiffReport {
  const expectedWords = splitWords(expectedText);
  const heardWords = splitWords(heardText);
  const exp = expectedWords.map(w => normalizeSpeechArabic(w));
  const heard = heardWords.map(w => normalizeSpeechArabic(w));

  const n = exp.length;
  const m = heard.length;

  // Word-level edit distance; alignment only — the verdict comes from `judge`.
  const cost = (i: number, j: number) => (judge(exp[i], heard[j]) === 'correct' ? 0 : 1);
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
      const status = judge(exp[i - 1], heard[j - 1]);
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
