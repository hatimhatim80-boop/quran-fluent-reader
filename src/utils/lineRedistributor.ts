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

export function redistributeLines(originalLines: string[], targetLineCount: number): string[] {
  if (targetLineCount >= 15) return originalLines;

  // Separate special lines from text lines
  const result: { type: 'special' | 'text'; content: string; originalIndex: number }[] = [];
  const textWords: string[] = [];

  for (let i = 0; i < originalLines.length; i++) {
    const line = originalLines[i];
    if (isSurahHeader(line) || isBismillah(line)) {
      // Flush any accumulated text words before special line
      if (textWords.length > 0) {
        result.push({ type: 'text', content: '', originalIndex: i });
      }
      result.push({ type: 'special', content: line, originalIndex: i });
    } else if (line.trim()) {
      // Accumulate words from text lines
      const words = line.split(/\s+/).filter(w => w.length > 0);
      textWords.push(...words);
    }
  }

  // Now distribute textWords into targetLineCount lines
  if (textWords.length === 0) return originalLines;

  const redistributedLines: string[] = [];

  // Add special lines that appear before text
  for (const item of result) {
    if (item.type === 'special') {
      redistributedLines.push(item.content);
    }
  }

  // Distribute words evenly
  const wordsPerLine = Math.ceil(textWords.length / targetLineCount);
  for (let i = 0; i < targetLineCount; i++) {
    const start = i * wordsPerLine;
    const end = Math.min(start + wordsPerLine, textWords.length);
    if (start >= textWords.length) break;
    redistributedLines.push(textWords.slice(start, end).join(' '));
  }

  return redistributedLines;
}

/**
 * Check if we should redistribute (only on mobile-ish screens)
 */
export function shouldRedistribute(mobileLinesPerPage: number): boolean {
  if (typeof window === 'undefined') return false;
  return mobileLinesPerPage < 15 && window.innerWidth < 768;
}
