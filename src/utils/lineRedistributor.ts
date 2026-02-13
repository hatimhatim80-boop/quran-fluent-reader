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

  // Build segments: groups of text lines separated by special lines
  const result: string[] = [];
  let textWords: string[] = [];
  let specialLinesCount = 0;

  const flushText = () => {
    if (textWords.length === 0) return;
    // Calculate how many lines this text segment gets
    // proportional to total text lines available
    const availableLines = Math.max(1, targetLineCount - specialLinesCount);
    const distributed = distributeWords(textWords, availableLines);
    result.push(...distributed);
    textWords = [];
  };

  // First pass: count special lines
  for (const line of originalLines) {
    if (isSurahHeader(line) || isBismillah(line)) {
      specialLinesCount++;
    }
  }

  // Second pass: build output preserving special line positions
  for (const line of originalLines) {
    if (isSurahHeader(line) || isBismillah(line)) {
      flushText();
      result.push(line);
    } else if (line.trim()) {
      const words = line.split(/\s+/).filter(w => w.length > 0);
      textWords.push(...words);
    }
  }
  flushText();

  return result;
}

/**
 * Check if we should redistribute (only on mobile-ish screens)
 */
export function shouldRedistribute(mobileLinesPerPage: number): boolean {
  if (typeof window === 'undefined') return false;
  return mobileLinesPerPage < 15 && window.innerWidth < 768;
}
