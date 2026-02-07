import React, { useMemo, useEffect } from 'react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';

interface PageViewProps {
  page: QuranPage;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  onWordClick: (word: GhareebWord, index: number) => void;
}

// Extract surah name from header line like "سُورَةُ البقرة"
function extractSurahName(line: string): string {
  return line.replace(/^سُورَةُ\s*/, '').trim();
}

// Normalize surah name for comparison
function normalizeSurahName(name: string): string {
  return normalizeArabic(name).replace(/\s+/g, '');
}

export function PageView({
  page,
  ghareebWords,
  highlightedWordIndex,
  onWordClick,
}: PageViewProps) {
  useEffect(() => {
    if (highlightedWordIndex < 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-ghareeb-index="${highlightedWordIndex}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [highlightedWordIndex]);

  // Build surah context map: for each line index, what's the current surah
  const surahContextByLine = useMemo(() => {
    const lines = page.text.split('\n');
    const contextMap: string[] = [];
    let currentSurah = page.surahName || '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('سُورَةُ')) {
        currentSurah = extractSurahName(line);
      }
      contextMap.push(currentSurah);
    }
    
    return contextMap;
  }, [page.text, page.surahName]);

  const renderedContent = useMemo(() => {
    if (!page.text) {
      return null;
    }

    // If no ghareeb words, just render plain text
    if (ghareebWords.length === 0) {
      return page.text.split('\n').map((line, idx) => (
        <div key={idx} className="mb-2">
          {line.startsWith('سُورَةُ') ? (
            <div className="text-center text-xl sm:text-2xl font-bold text-primary my-4 py-2 border-y border-ornament/30">
              {line}
            </div>
          ) : line.startsWith('بِسۡمِ ٱللَّهِ') ? (
            <div className="text-center text-lg sm:text-xl text-primary/80 my-3">
              {line}
            </div>
          ) : (
            <span>{line}</span>
          )}
        </div>
      ));
    }

    // Prepare ghareeb entries with normalized text, sorted by length (longest first for multi-word matching)
    const ghareebEntries = ghareebWords.map((gw, idx) => ({
      original: gw,
      index: idx,
      normalizedFull: normalizeArabic(gw.wordText),
      normalizedSurah: normalizeSurahName(gw.surahName),
    })).sort((a, b) => b.normalizedFull.length - a.normalizedFull.length);

    // Track which ghareeb entries have been used
    const usedIndices = new Set<number>();

    return page.text.split('\n').map((line, lineIdx) => {
      // Get the surah context for this line
      const localSurah = surahContextByLine[lineIdx] || '';
      const normalizedLocalSurah = normalizeSurahName(localSurah);

      // Check for surah header
      if (line.startsWith('سُورَةُ')) {
        return (
          <div key={lineIdx} className="text-center text-xl sm:text-2xl font-bold text-primary my-4 py-2 border-y border-ornament/30">
            {line}
          </div>
        );
      }

      // Check for bismillah
      if (line.startsWith('بِسۡمِ ٱللَّهِ')) {
        return (
          <div key={lineIdx} className="text-center text-lg sm:text-xl text-primary/80 my-3">
            {line}
          </div>
        );
      }

      // For phrase matching, we need to work with the normalized line
      const normalizedLine = normalizeArabic(line);
      
      // Find all phrase matches in this line
      interface PhraseMatch {
        startIdx: number; // position in original line
        endIdx: number;
        text: string; // original text
        entry: typeof ghareebEntries[0];
      }
      const phraseMatches: PhraseMatch[] = [];
      
      for (const entry of ghareebEntries) {
        if (usedIndices.has(entry.index)) continue;
        if (entry.normalizedFull.length < 2) continue;
        
        // Check surah context
        const surahMatch = normalizedLocalSurah === '' || 
          entry.normalizedSurah === normalizedLocalSurah || 
          entry.normalizedSurah.includes(normalizedLocalSurah) || 
          normalizedLocalSurah.includes(entry.normalizedSurah);
        if (!surahMatch) continue;
        
        // Find the phrase in the normalized line
        const phraseIdx = normalizedLine.indexOf(entry.normalizedFull);
        if (phraseIdx === -1) continue;
        
        // Map back to original line position
        // We need to find the corresponding position in the original text
        let origStart = 0;
        let normCount = 0;
        
        // Count through original line until we reach the normalized position
        for (let i = 0; i < line.length && normCount < phraseIdx; i++) {
          const char = line[i];
          const normChar = normalizeArabic(char);
          if (normChar.length > 0) {
            normCount += normChar.length;
          }
          origStart = i + 1;
        }
        
        // Find the end position by matching the phrase length in normalized space
        let origEnd = origStart;
        let matchedNormLen = 0;
        for (let i = origStart; i < line.length && matchedNormLen < entry.normalizedFull.length; i++) {
          const char = line[i];
          const normChar = normalizeArabic(char);
          if (normChar.length > 0) {
            matchedNormLen += normChar.length;
          }
          origEnd = i + 1;
        }
        
        // Extract the original text for this match
        const originalText = line.slice(origStart, origEnd);
        
        // Check for overlaps with existing matches
        const overlaps = phraseMatches.some(m => 
          (origStart >= m.startIdx && origStart < m.endIdx) ||
          (origEnd > m.startIdx && origEnd <= m.endIdx) ||
          (origStart <= m.startIdx && origEnd >= m.endIdx)
        );
        
        if (!overlaps) {
          phraseMatches.push({
            startIdx: origStart,
            endIdx: origEnd,
            text: originalText,
            entry,
          });
          usedIndices.add(entry.index);
        }
      }
      
      // Sort matches by position
      phraseMatches.sort((a, b) => a.startIdx - b.startIdx);
      
      // Build the line with highlighted phrases
      const elements: React.ReactNode[] = [];
      let lastIdx = 0;
      
      phraseMatches.forEach((match, matchIdx) => {
        // Add text before this match
        if (match.startIdx > lastIdx) {
          const beforeText = line.slice(lastIdx, match.startIdx);
          elements.push(<span key={`${lineIdx}-before-${matchIdx}`}>{beforeText}</span>);
        }
        
        // Add the highlighted phrase
        const isHighlighted = highlightedWordIndex === match.entry.index;
        elements.push(
          <span
            key={`${lineIdx}-match-${matchIdx}`}
            className={`${isHighlighted ? 'word-highlight ' : ''}word-ghareeb cursor-pointer`}
            data-ghareeb-index={match.entry.index}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(match.entry.original, match.entry.index);
            }}
          >
            {match.text}
          </span>
        );
        
        lastIdx = match.endIdx;
      });
      
      // Add remaining text
      if (lastIdx < line.length) {
        elements.push(<span key={`${lineIdx}-end`}>{line.slice(lastIdx)}</span>);
      }
      
      // If no matches, just render the line
      if (elements.length === 0) {
        elements.push(<span key={`${lineIdx}-full`}>{line}</span>);
      }

      return (
        <div key={lineIdx} className="mb-1">
          {elements}
        </div>
      );
    });
  }, [page.text, ghareebWords, highlightedWordIndex, onWordClick, surahContextByLine]);

  return (
    <div className="page-frame p-6 sm:p-8 md:p-10">
      {/* Page Number Header */}
      <div className="flex justify-center mb-4">
        <span className="bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-arabic">
          صفحة {page.pageNumber}
        </span>
      </div>

      {/* Quran Text */}
      <div className="quran-page min-h-[400px] sm:min-h-[500px]">
        {renderedContent}
      </div>

      {/* Word Count */}
      {ghareebWords.length > 0 && (
        <div className="text-center text-xs text-muted-foreground mt-4 font-arabic">
          {ghareebWords.length} كلمة غريبة في هذه الصفحة
        </div>
      )}

      {/* Decorative Footer */}
      <div className="flex justify-center mt-4">
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-ornament/30 to-transparent rounded-full" />
      </div>
    </div>
  );
}
