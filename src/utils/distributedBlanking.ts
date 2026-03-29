/**
 * Distributed blanking engine for Tahfeez review.
 * Generates blank positions based on reviewMode, distributionMode, and counts.
 * Works with ayah groups and word tokens from TahfeezQuizView.
 */

export interface TokenInfo {
  text: string;
  lineIdx: number;
  tokenIdx: number;
  key: string;
  hasWaqf: boolean;
  waqfMark: string;
}

/** Seeded PRNG for reproducible randomness per round */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Shuffle array in-place using seeded random */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Check if a token text is an actual Quran word (not waqf/number/ornament) */
const WAQF_MARKS = /[ۖۗۘۙۚۛۜ]/;
const ORNAMENTS = /^[﴿﴾()[\]{}۝۞٭؟،۔ۣ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬\s]+$/;
const VERSE_NUM = /^[٠-٩0-9۰-۹]+$/;

export function isActualWord(text: string): boolean {
  const clean = text.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
  if (clean.length === 0) return false;
  if (VERSE_NUM.test(clean)) return false;
  if (ORNAMENTS.test(text)) return false;
  // A standalone waqf mark is not a word
  if (WAQF_MARKS.test(text) && clean.replace(WAQF_MARKS, '').trim().length === 0) return false;
  return true;
}

export interface DistributedBlankingParams {
  reviewMode: 'ayah' | 'word' | 'mixed';
  distributionMode: 'sequential' | 'page-scattered' | 'range-scattered' | 'scope-scattered';
  hiddenAyatCount: number;
  hiddenWordsCount: number;
  seed: number;
  /** Ayah groups for the current page */
  ayahGroups: TokenInfo[][];
  /** All word tokens for the current page */
  allWordTokens: TokenInfo[];
  /** Word hiding mode */
  hiddenWordsMode?: 'fixed-count' | 'percentage';
  /** Percentage of words to hide (when mode=percentage) */
  hiddenWordsPercentage?: number;
  /** How to scope the percentage calculation */
  percentageScope?: 'per-ayah' | 'per-visible-block';
  /** Whether sequential words stay within one ayah */
  wordSequenceMode?: 'same-ayah-only' | 'allow-cross-ayah';
  /** Where to pick words within each ayah */
  wordBlankPosition?: 'start' | 'middle' | 'end' | 'mixed';
}

export interface DistributedBlankingResult {
  keys: Set<string>;
  selectedAyatCount: number;
  selectedWordCount: number;
  sampleSelectedKeys: string[];
}

/**
 * Computes which keys should be blanked based on the distributed blanking settings.
 * Returns a Set of token keys.
 */
export function computeDistributedBlanks(params: DistributedBlankingParams): Set<string> {
  return computeDistributedBlanksDetailed(params).keys;
}

/**
 * Same as computeDistributedBlanks, but returns debug stats for verification.
 */
export function computeDistributedBlanksDetailed(params: DistributedBlankingParams): DistributedBlankingResult {
  const {
    reviewMode, distributionMode, hiddenAyatCount, hiddenWordsCount, seed,
    ayahGroups, allWordTokens,
    hiddenWordsMode = 'fixed-count',
    hiddenWordsPercentage = 25,
    percentageScope = 'per-ayah',
    wordSequenceMode = 'same-ayah-only',
    wordBlankPosition = 'mixed',
  } = params;
  const keys = new Set<string>();
  const rand = seededRandom(seed);
  let selectedAyatCount = 0;
  let selectedWordCount = 0;

  // Explicit isolated paths per review mode (no cross-branch overlap)
  if (reviewMode === 'ayah') {
    selectedAyatCount = blankAyahs(keys, ayahGroups, hiddenAyatCount, distributionMode, rand);
    return {
      keys,
      selectedAyatCount,
      selectedWordCount: 0,
      sampleSelectedKeys: Array.from(keys).slice(0, 10),
    };
  }

  if (reviewMode === 'word') {
    if (hiddenWordsMode === 'percentage') {
      selectedWordCount = blankWordsByPercentage(keys, allWordTokens, ayahGroups, hiddenWordsPercentage, percentageScope, distributionMode, wordSequenceMode, wordBlankPosition, rand);
    } else {
      selectedWordCount = blankWords(keys, allWordTokens, ayahGroups, hiddenWordsCount, distributionMode, wordSequenceMode, wordBlankPosition, rand);
    }
    return {
      keys,
      selectedAyatCount: 0,
      selectedWordCount,
      sampleSelectedKeys: Array.from(keys).slice(0, 10),
    };
  }

  // mixed => apply both explicitly: ayat first, then words from remaining tokens
  if (reviewMode === 'mixed') {
    selectedAyatCount = blankAyahs(keys, ayahGroups, hiddenAyatCount, distributionMode, rand);
    if (hiddenWordsMode === 'percentage') {
      selectedWordCount = blankWordsByPercentage(keys, allWordTokens, ayahGroups, hiddenWordsPercentage, percentageScope, distributionMode, wordSequenceMode, wordBlankPosition, rand);
    } else {
      selectedWordCount = blankWords(keys, allWordTokens, ayahGroups, hiddenWordsCount, distributionMode, wordSequenceMode, wordBlankPosition, rand);
    }
  }

  return {
    keys,
    selectedAyatCount,
    selectedWordCount,
    sampleSelectedKeys: Array.from(keys).slice(0, 10),
  };
}

function blankAyahs(
  keys: Set<string>,
  ayahGroups: TokenInfo[][],
  count: number,
  distribution: string,
  rand: () => number
): number {
  if (ayahGroups.length === 0 || count <= 0) return 0;
  const n = Math.min(count, ayahGroups.length);

  let selectedIndices: number[];

  if (distribution === 'sequential') {
    const maxStart = Math.max(0, ayahGroups.length - n);
    const start = maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
    selectedIndices = Array.from({ length: n }, (_, i) => start + i);
  } else {
    selectedIndices = distributeEvenly(ayahGroups.length, n, rand);
  }

  for (const idx of selectedIndices) {
    for (const token of ayahGroups[idx]) {
      keys.add(token.key);
    }
  }

  return selectedIndices.length;
}

function blankWords(
  keys: Set<string>,
  allWordTokens: TokenInfo[],
  ayahGroups: TokenInfo[][],
  count: number,
  distribution: string,
  wordSequenceMode: string,
  wordBlankPosition: string,
  rand: () => number
): number {
  if (count <= 0) return 0;
  const available = allWordTokens.filter(t => !keys.has(t.key) && isActualWord(t.text));
  if (available.length === 0) return 0;
  const n = Math.min(count, available.length);

  if (distribution === 'sequential') {
    return blankWordsSequential(keys, available, ayahGroups, n, wordSequenceMode, wordBlankPosition, rand);
  } else {
    // For scattered distributions, apply position preference per ayah
    if (wordBlankPosition !== 'mixed') {
      return blankWordsPositioned(keys, ayahGroups, n, wordBlankPosition, rand);
    }
    const indices = distributeEvenly(available.length, n, rand);
    for (const idx of indices) {
      keys.add(available[idx].key);
    }
    return indices.length;
  }
}

/** Pick words at a specific position (start/middle/end) within each ayah */
function blankWordsPositioned(
  keys: Set<string>,
  ayahGroups: TokenInfo[][],
  count: number,
  position: string,
  rand: () => number
): number {
  let remaining = count;
  let selected = 0;
  const groupIndices = shuffle(Array.from({ length: ayahGroups.length }, (_, i) => i), rand);

  for (const gi of groupIndices) {
    if (remaining <= 0) break;
    const group = ayahGroups[gi];
    const avail = group.filter(t => !keys.has(t.key) && isActualWord(t.text));
    if (avail.length === 0) continue;
    const n = Math.min(remaining, Math.max(1, Math.ceil(avail.length * 0.4)));
    const start = getPositionStart(avail.length, n, position, rand);
    for (let i = start; i < start + n && i < avail.length; i++) {
      keys.add(avail[i].key);
      selected++;
    }
    remaining -= n;
  }
  return selected;
}

/** Get start index based on position preference */
function getPositionStart(total: number, count: number, position: string, rand: () => number): number {
  const maxStart = Math.max(0, total - count);
  if (position === 'start') return 0;
  if (position === 'end') return maxStart;
  if (position === 'middle') return Math.max(0, Math.floor(total / 2) - Math.floor(count / 2));
  // mixed: random
  return maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
}

function blankWordsByPercentage(
  keys: Set<string>,
  allWordTokens: TokenInfo[],
  ayahGroups: TokenInfo[][],
  percentage: number,
  percentageScope: string,
  distribution: string,
  wordSequenceMode: string,
  wordBlankPosition: string,
  rand: () => number
): number {
  if (percentage <= 0) return 0;

  let selectedWords = 0;

  if (percentageScope === 'per-ayah') {
    for (const group of ayahGroups) {
      const available = group.filter(t => !keys.has(t.key) && isActualWord(t.text));
      if (available.length === 0) continue;
      const countToHide = Math.max(1, Math.round((percentage / 100) * available.length));
      const n = Math.min(countToHide, available.length);

      if (distribution === 'sequential') {
        const start = getPositionStart(available.length, n, wordBlankPosition, rand);
        for (let i = start; i < start + n && i < available.length; i++) {
          keys.add(available[i].key);
          selectedWords++;
        }
      } else {
        if (wordBlankPosition !== 'mixed') {
          const start = getPositionStart(available.length, n, wordBlankPosition, rand);
          for (let i = start; i < start + n && i < available.length; i++) {
            keys.add(available[i].key);
            selectedWords++;
          }
        } else {
          const indices = distributeEvenly(available.length, n, rand);
          for (const idx of indices) {
            keys.add(available[idx].key);
          }
          selectedWords += indices.length;
        }
      }
    }
  } else {
    const available = allWordTokens.filter(t => !keys.has(t.key) && isActualWord(t.text));
    if (available.length === 0) return 0;
    const countToHide = Math.max(1, Math.round((percentage / 100) * available.length));
    const n = Math.min(countToHide, available.length);

    if (distribution === 'sequential') {
      selectedWords += blankWordsSequential(keys, available, ayahGroups, n, wordSequenceMode, wordBlankPosition, rand);
    } else {
      if (wordBlankPosition !== 'mixed') {
        selectedWords += blankWordsPositioned(keys, ayahGroups, n, wordBlankPosition, rand);
      } else {
        const indices = distributeEvenly(available.length, n, rand);
        for (const idx of indices) {
          keys.add(available[idx].key);
        }
        selectedWords += indices.length;
      }
    }
  }

  return selectedWords;
}

/** Sequential word blanking that respects wordSequenceMode */
function blankWordsSequential(
  keys: Set<string>,
  available: TokenInfo[],
  ayahGroups: TokenInfo[][],
  count: number,
  wordSequenceMode: string,
  rand: () => number
): number {
  if (count <= 0 || available.length === 0) return 0;
  let selectedWords = 0;
  if (wordSequenceMode === 'same-ayah-only') {
    // Build a map: for each ayah group, find the available tokens in order
    const availableKeys = new Set(available.map(a => a.key));
    const ayahAvailable: TokenInfo[][] = [];
    for (const group of ayahGroups) {
      const avail = group.filter(t => availableKeys.has(t.key));
      if (avail.length > 0) ayahAvailable.push(avail);
    }
    if (ayahAvailable.length === 0) return 0;

    // Pick a random ayah that has enough words, or pick the one with the most
    let remaining = count;
    const shuffledAyahIdxs = shuffle(Array.from({ length: ayahAvailable.length }, (_, i) => i), rand);

    for (const ai of shuffledAyahIdxs) {
      if (remaining <= 0) break;
      const avail = ayahAvailable[ai];
      const n = Math.min(remaining, avail.length);
      const maxStart = Math.max(0, avail.length - n);
      const start = maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
      for (let i = start; i < start + n; i++) {
        keys.add(avail[i].key);
        selectedWords++;
      }
      remaining -= n;
    }
  } else {
    // allow-cross-ayah: pick consecutive words from the flat available list
    const maxStart = Math.max(0, available.length - count);
    const start = maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
    for (let i = start; i < start + count && i < available.length; i++) {
      keys.add(available[i].key);
      selectedWords++;
    }
  }

  return selectedWords;
}

/**
 * Distribute n items evenly across totalCount positions with randomness.
 * Divides the range into n segments and picks one random item per segment.
 */
function distributeEvenly(totalCount: number, n: number, rand: () => number): number[] {
  if (n >= totalCount) return Array.from({ length: totalCount }, (_, i) => i);
  
  const segmentSize = totalCount / n;
  const indices: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const segStart = Math.floor(i * segmentSize);
    const segEnd = Math.floor((i + 1) * segmentSize);
    const idx = segStart + Math.floor(rand() * (segEnd - segStart));
    indices.push(Math.min(idx, totalCount - 1));
  }
  
  // Deduplicate
  const unique = [...new Set(indices)];
  if (unique.length < n) {
    const used = new Set(unique);
    const remaining = Array.from({ length: totalCount }, (_, i) => i).filter(i => !used.has(i));
    const shuffled = shuffle(remaining, rand);
    for (let i = 0; unique.length < n && i < shuffled.length; i++) {
      unique.push(shuffled[i]);
    }
  }
  
  return unique.sort((a, b) => a - b);
}
