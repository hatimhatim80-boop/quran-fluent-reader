/**
 * Redistributes mushaf page lines into a different number of lines
 * with balanced word distribution.
 * 
 * Skips surah headers and bismillah lines (keeps them as-is).
 * Only redistributes actual quran text lines.
 */

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

/**
 * Distributes words evenly across targetLineCount lines.
 */
function distributeWords(words: string[], targetLineCount: number): string[] {
  if (words.length === 0) return [];
  const MIN_WORDS_PER_LINE = 5;
  const maxPossibleLines = Math.floor(words.length / MIN_WORDS_PER_LINE) || 1;
  const lineCount = Math.min(targetLineCount, maxPossibleLines, words.length);

  // Calculate total character count (including spaces between words)
  const totalChars = words.reduce((sum, w) => sum + w.length, 0) + (words.length - 1); // words + spaces
  const targetCharsPerLine = totalChars / lineCount;

  const lines: string[] = [];
  let currentLineWords: string[] = [];
  let currentLineChars = 0;
  let linesRemaining = lineCount;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordsRemaining = words.length - i;
    const addedChars = currentLineWords.length === 0 ? word.length : word.length + 1; // +1 for space

    // Must we start filling remaining lines? (ensure MIN_WORDS_PER_LINE for remaining lines)
    const mustBreak = wordsRemaining <= (linesRemaining - 1) * MIN_WORDS_PER_LINE && currentLineWords.length >= MIN_WORDS_PER_LINE;

    // Would adding this word exceed the target?
    const wouldExceed = currentLineChars + addedChars > targetCharsPerLine * 1.15;

    if (mustBreak || (wouldExceed && currentLineWords.length >= MIN_WORDS_PER_LINE && linesRemaining > 1)) {
      lines.push(currentLineWords.join(' '));
      currentLineWords = [word];
      currentLineChars = word.length;
      linesRemaining--;
    } else {
      currentLineWords.push(word);
      currentLineChars += addedChars;
    }
  }

  if (currentLineWords.length > 0) {
    lines.push(currentLineWords.join(' '));
  }

  return lines;
}

export function redistributeLines(originalLines: string[], targetLineCount: number): string[] {
  if (targetLineCount >= 15) return originalLines;

  // First pass: collect text segments and special lines
  let specialLinesCount = 0;
  const segments: { type: 'special'; text: string }[] | { type: 'text'; words: string[] }[] = [];
  let currentWords: string[] = [];

  const flushWords = () => {
    if (currentWords.length > 0) {
      (segments as any[]).push({ type: 'text', words: [...currentWords] });
      currentWords = [];
    }
  };

  for (const line of originalLines) {
    if (isSurahHeader(line) || isBismillah(line)) {
      flushWords();
      (segments as any[]).push({ type: 'special', text: line });
      specialLinesCount++;
    } else if (line.trim()) {
      const words = line.split(/\s+/).filter(w => w.length > 0);
      currentWords.push(...words);
    }
  }
  flushWords();

  // Calculate available text lines
  const availableTextLines = Math.max(1, targetLineCount - specialLinesCount);

  // Count total words across all text segments
  const textSegments = (segments as any[]).filter(s => s.type === 'text');
  const totalWords = textSegments.reduce((sum: number, s: any) => sum + s.words.length, 0);

  // Distribute lines proportionally to each text segment
  // Ensure each segment gets at least 1 line and no line has fewer than 3 words
  const MIN_WORDS_PER_LINE = 5;
  let remainingLines = availableTextLines;
  const segmentLineCounts: number[] = [];
  
  for (let i = 0; i < textSegments.length; i++) {
    const seg = textSegments[i];
    // Max lines this segment can have while keeping MIN_WORDS_PER_LINE
    const maxForSegment = Math.floor(seg.words.length / MIN_WORDS_PER_LINE) || 1;
    if (i === textSegments.length - 1) {
      segmentLineCounts.push(Math.max(1, Math.min(remainingLines, maxForSegment)));
    } else {
      const proportion = seg.words.length / totalWords;
      let lines = Math.max(1, Math.round(availableTextLines * proportion));
      lines = Math.min(lines, maxForSegment);
      lines = Math.min(lines, remainingLines - (textSegments.length - 1 - i));
      lines = Math.max(1, lines);
      segmentLineCounts.push(lines);
      remainingLines -= lines;
    }
  }

  // Build result
  const result: string[] = [];
  let textSegIdx = 0;
  for (const seg of (segments as any[])) {
    if (seg.type === 'special') {
      result.push(seg.text);
    } else {
      const lineCount = segmentLineCounts[textSegIdx];
      const distributed = distributeWords(seg.words, Math.max(1, lineCount));
      result.push(...distributed);
      textSegIdx++;
    }
  }

  return result;
}

/**
 * Get the effective line count based on device width
 */
export function getEffectiveLineCount(mobileLinesPerPage: number, desktopLinesPerPage: number): number {
  if (typeof window === 'undefined') return 15;
  const isMobile = window.innerWidth < 768;
  return isMobile ? mobileLinesPerPage : desktopLinesPerPage;
}

/**
 * Check if we should redistribute
 */
export function shouldRedistribute(mobileLinesPerPage: number, desktopLinesPerPage?: number): boolean {
  if (typeof window === 'undefined') return false;
  const isMobile = window.innerWidth < 768;
  const lineCount = isMobile ? mobileLinesPerPage : (desktopLinesPerPage ?? 15);
  return lineCount < 15;
}
