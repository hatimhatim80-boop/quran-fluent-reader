/**
 * Canonical matching engine for Ghareeb words/phrases.
 * Supports cross-line phrase matching, strong normalization,
 * and two-pass matching (exact → loose).
 */
import { GhareebWord } from '@/types/quran';

// ─── Canonical Normalization ────────────────────────────────────────────────

const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;
const QURANIC_MARKS_RE = /[ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ﴿﴾۝\u06D4\u06DD\u06DE\u06DF\u06E0\u06E1]/g;
const ALEF_VARIANTS_RE = /[ٱإأآٲٳٵٴٶٷ]/g;
const SUPERSCRIPT_ALEF_RE = /[ٰۤ]/g;
const TATWEEL_RE = /ـ/g;
const HAMZA_MARKS_RE = /[ٕٔ]/g;

/**
 * Strong canonical normalization for matching.
 * Strips all diacritics, normalizes letter variants, trims.
 */
export function canonicalize(text: string): string {
  let s = text;
  // Remove diacritics and Quranic marks
  s = s.replace(DIACRITICS_RE, '');
  s = s.replace(QURANIC_MARKS_RE, '');
  // Normalize alef variants
  s = s.replace(ALEF_VARIANTS_RE, 'ا');
  // Remove superscript alef
  s = s.replace(SUPERSCRIPT_ALEF_RE, '');
  // Letter normalizations
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/ء/g, '');
  s = s.replace(TATWEEL_RE, '');
  s = s.replace(HAMZA_MARKS_RE, '');
  s = s.replace(/ۀ/g, 'ه');
  // Remove non-Arabic non-space
  s = s.replace(/[^\u0621-\u064A\u066E-\u06D3\s]/g, '');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ─── Token Data ─────────────────────────────────────────────────────────────

const PAGE_TOKEN_CLEAN_RE = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

export interface FlatToken {
  token: string;        // original text
  lineIdx: number;
  tokenIdx: number;     // index within the split of that line
  isSpace: boolean;
  isVerseNumber: boolean;
  canonical: string;    // canonicalized form
}

function isVerseNumberToken(cleanToken: string): boolean {
  return /^[٠-٩0-9۰-۹]+$/.test(cleanToken);
}

/**
 * Build a flat list of tokens across all content lines (skip headers/bismillah).
 */
export function buildFlatTokens(
  lines: string[],
  isHeaderLine: (line: string) => boolean,
  isBismillahLine: (line: string) => boolean,
): FlatToken[] {
  const tokens: FlatToken[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (isHeaderLine(line) || isBismillahLine(line)) continue;
    const parts = line.split(/(\s+)/);
    for (let ti = 0; ti < parts.length; ti++) {
      const token = parts[ti];
      const isSpace = /^\s+$/.test(token);
      const cleanToken = token.replace(PAGE_TOKEN_CLEAN_RE, '').trim();
      const isVN = !isSpace && isVerseNumberToken(cleanToken);
      tokens.push({
        token,
        lineIdx,
        tokenIdx: ti,
        isSpace,
        isVerseNumber: isVN,
        canonical: isSpace || isVN ? '' : canonicalize(token),
      });
    }
  }
  return tokens;
}

// ─── Matching Engine ────────────────────────────────────────────────────────

export interface MatchResult {
  ghareebIndex: number;      // index in the original ghareebWords array
  word: GhareebWord;
  matchedTokens: FlatToken[]; // the tokens that form this match
  method: 'exact' | 'loose';
}

interface GhareebEntry {
  original: GhareebWord;
  originalIndex: number;
  canonicalFull: string;       // full phrase canonicalized
  canonicalWords: string[];    // individual words
  wordCount: number;
  normalizedSurah: string;
}

function normalizeSurahName(name: string): string {
  return canonicalize(name).replace(/\s+/g, '');
}

function parseVerseNumber(value: string): number | null {
  const latinized = value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const parsed = Number.parseInt(latinized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Check if tokenCanonical loosely matches phraseWord.
 * - Substring match where one contains the other
 * - Length diff ≤ 3
 * - Prefix stripping for common prefixes (و ف ب ل ك)
 */
function looseWordMatch(tokenCan: string, phraseCan: string): boolean {
  if (tokenCan === phraseCan) return true;
  if (tokenCan.length < 2 || phraseCan.length < 2) return false;

  const lenDiff = Math.abs(tokenCan.length - phraseCan.length);

  // Substring containment with small length diff
  if (lenDiff <= 3) {
    if (tokenCan.includes(phraseCan) || phraseCan.includes(tokenCan)) return true;
  }

  // Try stripping common prefixes from token
  const prefixes = ['و', 'ف', 'ب', 'ل', 'ك', 'ال', 'وال', 'فال', 'بال', 'لل'];
  for (const pf of prefixes) {
    if (tokenCan.startsWith(pf) && tokenCan.length > pf.length + 1) {
      const stripped = tokenCan.slice(pf.length);
      if (stripped === phraseCan) return true;
    }
    if (phraseCan.startsWith(pf) && phraseCan.length > pf.length + 1) {
      const stripped = phraseCan.slice(pf.length);
      if (stripped === tokenCan) return true;
    }
  }

  return false;
}

/**
 * Find the verse number that follows after a given position in the flat token list.
 */
function findNextVerseNumber(flatTokens: FlatToken[], startIdx: number): number | null {
  for (let i = startIdx; i < flatTokens.length; i++) {
    if (flatTokens[i].isVerseNumber) {
      const clean = flatTokens[i].token.replace(PAGE_TOKEN_CLEAN_RE, '').trim();
      return parseVerseNumber(clean);
    }
  }
  return null;
}

interface SegmentTokenRange {
  position: number;
  start: number;
  end: number;
}

interface VerseSegment {
  verseNumber: number | null;
  normalizedSurah: string;
  canonicalText: string;
  compactText: string;
  tokenRanges: SegmentTokenRange[];
  compactRanges: SegmentTokenRange[];
}

function matchesSurahContext(entry: GhareebEntry, normalizedLocalSurah: string): boolean {
  return (
    normalizedLocalSurah === '' ||
    entry.normalizedSurah === normalizedLocalSurah ||
    entry.normalizedSurah.includes(normalizedLocalSurah) ||
    normalizedLocalSurah.includes(entry.normalizedSurah)
  );
}

function buildVerseSegments(flatTokens: FlatToken[], surahContextByLine: string[]): VerseSegment[] {
  const segments: VerseSegment[] = [];
  let currentPositions: number[] = [];
  let currentSurah = '';

  const flush = (verseNumber: number | null) => {
    if (currentPositions.length === 0) return;

    let canonicalText = '';
    let compactText = '';
    let canonicalCursor = 0;
    let compactCursor = 0;
    const tokenRanges: SegmentTokenRange[] = [];
    const compactRanges: SegmentTokenRange[] = [];

    for (const position of currentPositions) {
      const token = flatTokens[position];
      if (!token.canonical) continue;

      if (tokenRanges.length > 0) {
        canonicalText += ' ';
        canonicalCursor += 1;
      }

      const start = canonicalCursor;
      canonicalText += token.canonical;
      canonicalCursor += token.canonical.length;
      tokenRanges.push({ position, start, end: canonicalCursor });

      const compactStart = compactCursor;
      compactText += token.canonical;
      compactCursor += token.canonical.length;
      compactRanges.push({ position, start: compactStart, end: compactCursor });
    }

    segments.push({
      verseNumber,
      normalizedSurah: currentSurah,
      canonicalText,
      compactText,
      tokenRanges,
      compactRanges,
    });

    currentPositions = [];
    currentSurah = '';
  };

  for (let i = 0; i < flatTokens.length; i++) {
    const token = flatTokens[i];

    if (token.isSpace) continue;

    if (token.isVerseNumber) {
      const clean = token.token.replace(PAGE_TOKEN_CLEAN_RE, '').trim();
      flush(parseVerseNumber(clean));
      continue;
    }

    if (!token.canonical) continue;

    currentPositions.push(i);
    if (!currentSurah) {
      currentSurah = normalizeSurahName(surahContextByLine[token.lineIdx] || '');
    }
  }

  flush(null);
  return segments;
}

function collectMatchedPositions(ranges: SegmentTokenRange[], start: number, end: number): number[] {
  return ranges
    .filter((range) => range.start < end && range.end > start)
    .map((range) => range.position);
}

function matchEntryInSegment(
  entry: GhareebEntry,
  segment: VerseSegment,
  pass: 'exact' | 'loose',
): { matchedPositions: number[]; start: number; end: number; matchedAyahText: string } | null {
  if (segment.verseNumber !== null && segment.verseNumber !== entry.original.verseNumber) {
    return null;
  }

  const exactStart = segment.canonicalText.indexOf(entry.canonicalFull);
  if (exactStart !== -1) {
    const exactEnd = exactStart + entry.canonicalFull.length;
    const matchedPositions = collectMatchedPositions(segment.tokenRanges, exactStart, exactEnd);
    if (matchedPositions.length > 0) {
      return {
        matchedPositions,
        start: exactStart,
        end: exactEnd,
        matchedAyahText: segment.canonicalText,
      };
    }
  }

  if (pass === 'exact') return null;

  const compactPhrase = entry.canonicalWords.join('');
  if (!compactPhrase) return null;

  const looseStart = segment.compactText.indexOf(compactPhrase);
  if (looseStart === -1) return null;

  const looseEnd = looseStart + compactPhrase.length;
  const matchedPositions = collectMatchedPositions(segment.compactRanges, looseStart, looseEnd);
  if (matchedPositions.length === 0) return null;

  return {
    matchedPositions,
    start: looseStart,
    end: looseEnd,
    matchedAyahText: segment.canonicalText,
  };
}

/**
 * Main matching function. Returns matches in reading order.
 * Supports cross-line phrase matching.
 */
export function matchGhareebToTokens(
  flatTokens: FlatToken[],
  ghareebWords: GhareebWord[],
  surahContextByLine: string[],
): MatchResult[] {
  if (flatTokens.length === 0 || ghareebWords.length === 0) return [];

  // Prepare entries
  const entries: GhareebEntry[] = ghareebWords.map((gw, idx) => {
    const canonicalFull = canonicalize(gw.wordText);
    const canonicalWords = canonicalFull.split(/\s+/).filter(w => w.length >= 2);
    return {
      original: gw,
      originalIndex: idx,
      canonicalFull,
      canonicalWords,
      wordCount: canonicalWords.length,
      normalizedSurah: normalizeSurahName(gw.surahName),
    };
  });

  // Sort by word count descending (greedy: match longer phrases first)
  const sortedEntries = [...entries].sort((a, b) => b.wordCount - a.wordCount);
  const verseSegments = buildVerseSegments(flatTokens, surahContextByLine);

  const usedEntryIndices = new Set<number>();
  const usedTokenPositions = new Set<number>(); // indices into flatTokens
  const results: MatchResult[] = [];

  const runPass = (pass: 'exact' | 'loose') => {
    for (const entry of sortedEntries) {
      if (usedEntryIndices.has(entry.originalIndex)) continue;
      if (entry.canonicalWords.length === 0) continue;

      // Try to find this phrase starting at each content token
      for (let startPos = 0; startPos < flatTokens.length; startPos++) {
        const startToken = flatTokens[startPos];
        if (startToken.isSpace || startToken.isVerseNumber) continue;
        if (usedTokenPositions.has(startPos)) continue;

        // Check surah context
        const localSurah = surahContextByLine[startToken.lineIdx] || '';
        const normalizedLocalSurah = normalizeSurahName(localSurah);
        const surahOk = matchesSurahContext(entry, normalizedLocalSurah);
        if (!surahOk) continue;

        // Try matching phrase words starting from startPos
        let phraseWordIdx = 0;
        const matchedPositions: number[] = [];
        let pos = startPos;

        while (pos < flatTokens.length && phraseWordIdx < entry.canonicalWords.length) {
          const ft = flatTokens[pos];
          if (ft.isSpace) { pos++; continue; }
          if (ft.isVerseNumber) { pos++; continue; }
          if (usedTokenPositions.has(pos)) break;

          const tokenCan = ft.canonical;
          const phraseCan = entry.canonicalWords[phraseWordIdx];

          const isExact = tokenCan === phraseCan;
          const isLoose = !isExact && looseWordMatch(tokenCan, phraseCan);
          const ok = pass === 'exact' ? isExact : (isExact || isLoose);

          if (ok) {
            matchedPositions.push(pos);
            phraseWordIdx++;
            pos++;
          } else {
            break;
          }
        }

        if (phraseWordIdx === entry.canonicalWords.length && matchedPositions.length > 0) {
          // Verify verse number if available
          const lastMatchPos = matchedPositions[matchedPositions.length - 1];
          const nextVerse = findNextVerseNumber(flatTokens, lastMatchPos + 1);
          if (nextVerse !== null && nextVerse !== entry.original.verseNumber) {
            continue; // Wrong verse
          }

          // Mark as used
          usedEntryIndices.add(entry.originalIndex);
          matchedPositions.forEach(p => usedTokenPositions.add(p));

          results.push({
            ghareebIndex: entry.originalIndex,
            word: entry.original,
            matchedTokens: matchedPositions.map(p => flatTokens[p]),
            method: pass,
          });

          if (process.env.NODE_ENV !== 'production') {
            console.debug(`[CanonicalMatch] ✅ ${pass}: "${entry.original.wordText}" → tokens [${matchedPositions.join(',')}]`);
          }

          break; // Found match for this entry
        }
      }

      if (!usedEntryIndices.has(entry.originalIndex)) {
        for (const segment of verseSegments) {
          if (!matchesSurahContext(entry, segment.normalizedSurah)) continue;

          const rangeMatch = matchEntryInSegment(entry, segment, pass);
          if (!rangeMatch) continue;
          if (rangeMatch.matchedPositions.some((position) => usedTokenPositions.has(position))) continue;

          usedEntryIndices.add(entry.originalIndex);
          rangeMatch.matchedPositions.forEach((position) => usedTokenPositions.add(position));

          results.push({
            ghareebIndex: entry.originalIndex,
            word: entry.original,
            matchedTokens: rangeMatch.matchedPositions.map((position) => flatTokens[position]),
            method: pass,
          });

          if (process.env.NODE_ENV !== 'production') {
            console.debug('[CanonicalMatch] ✅ range match', {
              method: pass,
              originalPhrase: entry.original.wordText,
              normalizedPhrase: entry.canonicalFull,
              matchedAyahText: rangeMatch.matchedAyahText,
              start: rangeMatch.start,
              end: rangeMatch.end,
            });
          }

          break;
        }
      }

      // Log unmatched in dev
      if (!usedEntryIndices.has(entry.originalIndex) && pass === 'loose') {
        if (process.env.NODE_ENV !== 'production') {
          const sameVerseSegment = verseSegments.find(
            (segment) =>
              segment.verseNumber === entry.original.verseNumber &&
              matchesSurahContext(entry, segment.normalizedSurah),
          );
          console.debug('[CanonicalMatch] ❌ unmatched', {
            originalPhrase: entry.original.wordText,
            normalizedPhrase: entry.canonicalFull,
            matchedAyahText: sameVerseSegment?.canonicalText ?? '',
            start: null,
            end: null,
            reason: sameVerseSegment ? 'range-search-failed' : 'ayah-segment-not-found',
          });
        }
      }
    }
  };

  // Pass 1: exact canonical matches
  runPass('exact');
  // Pass 2: loose matches for remaining
  runPass('loose');

  // Sort by reading order (position in flat list)
  results.sort((a, b) => {
    const aFirst = a.matchedTokens[0];
    const bFirst = b.matchedTokens[0];
    if (aFirst.lineIdx !== bFirst.lineIdx) return aFirst.lineIdx - bFirst.lineIdx;
    return aFirst.tokenIdx - bFirst.tokenIdx;
  });

  return results;
}

// ─── Token Match Map Builder ────────────────────────────────────────────────

export interface TokenMatchInfo {
  originalIndex: number;
  word: GhareebWord;
  sequentialIndex: number;
  isPartOfPhrase: boolean;
  phraseStart: boolean;
  // All tokens in this phrase (as FlatToken[])
  phraseTokens: FlatToken[];
}

/**
 * Build a lookup map: "lineIdx_tokenIdx" → TokenMatchInfo
 */
export function buildTokenMatchMap(
  matchResults: MatchResult[],
): Map<string, TokenMatchInfo> {
  const map = new Map<string, TokenMatchInfo>();

  matchResults.forEach((result, seqIdx) => {
    const isPhrase = result.matchedTokens.length > 1;
    result.matchedTokens.forEach((ft, idx) => {
      const key = `${ft.lineIdx}_${ft.tokenIdx}`;
      map.set(key, {
        originalIndex: result.ghareebIndex,
        word: result.word,
        sequentialIndex: seqIdx,
        isPartOfPhrase: isPhrase,
        phraseStart: idx === 0,
        phraseTokens: result.matchedTokens,
      });
    });
  });

  return map;
}
