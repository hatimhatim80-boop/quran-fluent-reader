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
  const lineCount = Math.min(targetLineCount, words.length);
  const lines: string[] = [];
  const baseWordsPerLine = Math.floor(words.length / lineCount);
  const extra = words.length % lineCount;
  let idx = 0;
  for (let i = 0; i < lineCount; i++) {
    const count = baseWordsPerLine + (i < extra ? 1 : 0);
    lines.push(words.slice(idx, idx + count).join(' '));
    idx += count;
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
  let remainingLines = availableTextLines;
  const segmentLineCounts: number[] = [];
  
  for (let i = 0; i < textSegments.length; i++) {
    const seg = textSegments[i];
    if (i === textSegments.length - 1) {
      segmentLineCounts.push(Math.max(1, remainingLines));
    } else {
      const proportion = seg.words.length / totalWords;
      let lines = Math.max(1, Math.round(availableTextLines * proportion));
      // Don't allow lines with fewer than 3 words
      lines = Math.min(lines, Math.floor(seg.words.length / 3) || 1);
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
      // Ensure last segment doesn't create sparse lines
      const effectiveCount = Math.min(lineCount, Math.floor(seg.words.length / 2) || 1);
      const distributed = distributeWords(seg.words, Math.max(1, effectiveCount));
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
