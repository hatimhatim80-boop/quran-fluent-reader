/** Compare original Quran text with raw recognizer output at word level. */
import { normalizeSpeechArabic, similarity, splitWords } from './quranSpeechMatch';

export type DiffStatus = 'correct' | 'missing' | 'extra' | 'different' | 'order' | 'unclear';

export interface DiffToken {
  status: DiffStatus;
  expected: string;
  heard: string;
}

export interface DiffReport {
  tokens: DiffToken[];
  correct: number;
  total: number;
  score: number;
  doubtful: boolean;
  hasUnclear: boolean;
  truncated: boolean;
  approvable: boolean;
}

const UNCLEAR_THRESHOLD = 0.62;
const EQUAL_THRESHOLD = 0.86;
const SHORT_WORD_LENGTH = 3;

function judge(expected: string, heard: string): DiffStatus {
  if (!expected || !heard) return 'unclear';
  if (expected === heard) return 'correct';
  const score = similarity(expected, heard);
  if (expected.length <= SHORT_WORD_LENGTH || heard.length <= SHORT_WORD_LENGTH) {
    return score >= UNCLEAR_THRESHOLD ? 'unclear' : 'different';
  }
  if (score >= EQUAL_THRESHOLD) return 'correct';
  return score >= UNCLEAR_THRESHOLD ? 'unclear' : 'different';
}

export function compareRecitation(originalQuranText: string, rawTranscript: string): DiffReport {
  const expectedWords = splitWords(originalQuranText);
  const heardWords = splitWords(rawTranscript);
  const expectedNormalized = expectedWords.map(normalizeSpeechArabic);
  const heardNormalized = heardWords.map(normalizeSpeechArabic);
  const rowCount = expectedNormalized.length;
  const columnCount = heardNormalized.length;
  const cost = (row: number, column: number) => judge(expectedNormalized[row], heardNormalized[column]) === 'correct' ? 0 : 1;
  const distances = Array.from({ length: rowCount + 1 }, () => Array(columnCount + 1).fill(0));

  for (let row = 0; row <= rowCount; row++) distances[row][0] = row;
  for (let column = 0; column <= columnCount; column++) distances[0][column] = column;
  for (let row = 1; row <= rowCount; row++) {
    for (let column = 1; column <= columnCount; column++) {
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost(row - 1, column - 1),
      );
    }
  }

  const tokens: DiffToken[] = [];
  let row = rowCount;
  let column = columnCount;
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && distances[row][column] === distances[row - 1][column - 1] + cost(row - 1, column - 1)) {
      tokens.push({ status: judge(expectedNormalized[row - 1], heardNormalized[column - 1]), expected: expectedWords[row - 1], heard: heardWords[column - 1] });
      row--;
      column--;
    } else if (row > 0 && distances[row][column] === distances[row - 1][column] + 1) {
      tokens.push({ status: 'missing', expected: expectedWords[row - 1], heard: '' });
      row--;
    } else {
      tokens.push({ status: 'extra', expected: '', heard: heardWords[column - 1] });
      column--;
    }
  }
  tokens.reverse();

  const extras = new Map<string, number[]>();
  tokens.forEach((token, index) => {
    if (token.status !== 'extra') return;
    const key = normalizeSpeechArabic(token.heard);
    extras.set(key, [...(extras.get(key) || []), index]);
  });
  tokens.forEach(token => {
    if (token.status !== 'missing') return;
    const matches = extras.get(normalizeSpeechArabic(token.expected));
    const matchIndex = matches?.shift();
    if (matchIndex === undefined) return;
    token.status = 'order';
    tokens[matchIndex].status = 'order';
  });

  const graded = tokens.filter(token => token.expected);
  const correct = graded.filter(token => token.status === 'correct').length;
  const unclear = graded.filter(token => token.status === 'unclear').length;
  const denominator = graded.length || 1;
  const truncated = expectedWords.length > 0 && heardWords.length < expectedWords.length * 0.6;
  const hasUnclear = unclear > 0;
  const score = correct / denominator;
  const doubtful = heardWords.length === 0 || unclear / denominator > 0.4 || truncated;

  return {
    tokens,
    correct,
    total: graded.length,
    score,
    doubtful,
    hasUnclear,
    truncated,
    approvable: score === 1 && !hasUnclear && !truncated && heardWords.length > 0,
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
