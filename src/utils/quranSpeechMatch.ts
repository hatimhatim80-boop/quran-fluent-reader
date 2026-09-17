/**
 * Quran Speech Matching Utilities
 * 
 * Normalization, word splitting, Levenshtein distance, similarity,
 * and ordered hidden-word matching for voice-based Tahfeez quizzes.
 */

/**
 * Normalize Arabic text for speech comparison.
 * Removes diacritics, Quranic marks, normalizes letter forms.
 */
export function normalizeSpeechArabic(text: string): string {
  let n = text;

  // Remove all diacritical marks (tashkeel, tanween, etc.)
  n = n.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, '');

  // Remove tajweed/Quranic special marks
  n = n.replace(/[ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ]/g, '');

  // Remove bracket symbols
  n = n.replace(/[﴿﴾۝]/g, '');

  // Remove additional Uthmani marks
  n = n.replace(/[\u06D4\u06DD\u06DE\u06DF\u06E0\u06E1]/g, '');

  // Normalize alef forms
  n = n.replace(/[ٱإأآٲٳٵٴٶٷ]/g, 'ا');

  // Normalize taa marbuta → ha
  n = n.replace(/ة/g, 'ه');

  // Normalize alef maqsura → ya
  n = n.replace(/ى/g, 'ي');

  // Remove tatweel
  n = n.replace(/ـ/g, '');

  // Remove zero-width and formatting chars
  n = n.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');

  // Remove punctuation
  n = n.replace(/[.,،؟!:;'\"()\[\]{}<>؛]/g, '');

  return n.trim();
}

/**
 * Split text into words (non-empty tokens).
 */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[la][lb];
}

/**
 * Similarity ratio between two strings (0..1).
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface MatchResult {
  success: boolean;
  matched: string[];
  missing: string[];
  score: number; // 0..1 ratio of matched/total
}

export interface RecitationProgress {
  matchedCount: number;
  nextIndex: number;
}

/**
 * Tracks ordered progress through canonical Quran words from a cumulative ASR
 * transcript. The transcript is comparison-only; callers continue rendering
 * the original Quran words. Extra recognizer tokens are tolerated, while each
 * heard token can advance at most one expected word.
 */
export function matchRecitationProgress(
  expectedWords: string[],
  spokenText: string,
  threshold = 0.86,
): RecitationProgress {
  const expected = expectedWords.map(normalizeSpeechArabic).filter(Boolean);
  const spoken = splitWords(normalizeSpeechArabic(spokenText));
  let expectedIndex = 0;

  const stripParticle = (word: string) => word.replace(/^(?:و|ف|ل|ب|ك)+/, '');
  const matches = (heard: string, target: string) => {
    if (!heard || !target) return false;
    const heardCore = stripParticle(heard);
    const targetCore = stripParticle(target);
    if (heard === target || heardCore === target || heard === targetCore || heardCore === targetCore) return true;
    const shortest = Math.min(heardCore.length, targetCore.length);
    if (shortest < 3) return false;
    return similarity(heardCore, targetCore) >= threshold;
  };

  for (let spokenIndex = 0; spokenIndex < spoken.length && expectedIndex < expected.length; spokenIndex++) {
    const heard = spoken[spokenIndex];
    const target = expected[expectedIndex];
    const pair = spokenIndex + 1 < spoken.length ? heard + spoken[spokenIndex + 1] : '';
    if (!matches(heard, target) && !matches(pair, target)) continue;
    if (pair && !matches(heard, target)) spokenIndex++;
    expectedIndex++;
  }

  return { matchedCount: expectedIndex, nextIndex: expectedIndex };
}

/**
 * Match hidden words in order within spoken text.
 * 
 * Walks through spoken words trying to match each target hidden word
 * in sequence. Tolerates extra spoken words (e.g. non-hidden words
 * the user also recited). Uses fuzzy similarity threshold.
 */
export function matchHiddenWordsInOrder(
  spokenText: string,
  targetWords: string[],
  threshold = 0.8
): MatchResult {
  if (targetWords.length === 0) {
    return { success: true, matched: [], missing: [], score: 1 };
  }

  const spokenNorm = normalizeSpeechArabic(spokenText);
  const spokenWordsList = splitWords(spokenNorm);

  const targetNorm = targetWords.map(w => normalizeSpeechArabic(w));

  const matched: string[] = [];
  const missing: string[] = [];
  let spokenIdx = 0;

  for (let t = 0; t < targetNorm.length; t++) {
    const target = targetNorm[t];
    if (!target) {
      matched.push(targetWords[t]);
      continue;
    }

    let found = false;
    // Search forward in spoken words for a match
    while (spokenIdx < spokenWordsList.length) {
      const spoken = spokenWordsList[spokenIdx];
      spokenIdx++;

      if (similarity(spoken, target) >= threshold) {
        matched.push(targetWords[t]);
        found = true;
        break;
      }
    }

    if (!found) {
      missing.push(targetWords[t]);
    }
  }

  const score = targetWords.length > 0 ? matched.length / targetWords.length : 1;
  return {
    success: missing.length === 0,
    matched,
    missing,
    score,
  };
}
