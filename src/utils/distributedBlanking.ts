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
}

/**
 * Computes which keys should be blanked based on the distributed blanking settings.
 * Returns a Set of token keys.
 * 
 * For 'sequential' mode: picks consecutive ayahs/words
 * For 'page-scattered' mode: picks random positions within the page
 * For 'range-scattered' and 'scope-scattered': same as page-scattered per-page
 *   (cross-page distribution is handled at the page selection level)
 */
export function computeDistributedBlanks(params: DistributedBlankingParams): Set<string> {
  const { reviewMode, distributionMode, hiddenAyatCount, hiddenWordsCount, seed, ayahGroups, allWordTokens } = params;
  const keys = new Set<string>();
  const rand = seededRandom(seed);

  if (reviewMode === 'ayah' || reviewMode === 'mixed') {
    blankAyahs(keys, ayahGroups, hiddenAyatCount, distributionMode, rand);
  }

  if (reviewMode === 'word' || reviewMode === 'mixed') {
    blankWords(keys, allWordTokens, ayahGroups, hiddenWordsCount, distributionMode, rand);
  }

  return keys;
}

function blankAyahs(
  keys: Set<string>,
  ayahGroups: TokenInfo[][],
  count: number,
  distribution: string,
  rand: () => number
) {
  if (ayahGroups.length === 0) return;
  const n = Math.min(count, ayahGroups.length);

  let selectedIndices: number[];

  if (distribution === 'sequential') {
    // Start from a random position but keep them consecutive
    const maxStart = Math.max(0, ayahGroups.length - n);
    const start = maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
    selectedIndices = Array.from({ length: n }, (_, i) => start + i);
  } else {
    // Scattered: distribute evenly across the page
    selectedIndices = distributeEvenly(ayahGroups.length, n, rand);
  }

  for (const idx of selectedIndices) {
    for (const token of ayahGroups[idx]) {
      keys.add(token.key);
    }
  }
}

function blankWords(
  keys: Set<string>,
  allWordTokens: TokenInfo[],
  ayahGroups: TokenInfo[][],
  count: number,
  distribution: string,
  rand: () => number
) {
  // Filter out tokens that are already blanked (from ayah blanking in mixed mode)
  const available = allWordTokens.filter(t => !keys.has(t.key));
  if (available.length === 0) return;
  const n = Math.min(count, available.length);

  if (distribution === 'sequential') {
    // Pick consecutive words from a random starting point
    const maxStart = Math.max(0, available.length - n);
    const start = maxStart > 0 ? Math.floor(rand() * (maxStart + 1)) : 0;
    for (let i = start; i < start + n && i < available.length; i++) {
      keys.add(available[i].key);
    }
  } else {
    // Scattered: distribute evenly
    const indices = distributeEvenly(available.length, n, rand);
    for (const idx of indices) {
      keys.add(available[idx].key);
    }
  }
}

/**
 * Distribute n items evenly across totalCount positions with randomness.
 * Divides the range into n segments and picks one random item per segment.
 * This prevents clustering at the beginning/end.
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
  // If we lost some due to dedup, fill from remaining
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
