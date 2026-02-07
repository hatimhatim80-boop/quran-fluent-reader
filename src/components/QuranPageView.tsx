import React, { useMemo } from 'react';
import { GhareebWord } from '@/types/quran';

interface QuranPageViewProps {
  pageText: string;
  pageNumber: number;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  onWordClick: (word: GhareebWord, index: number) => void;
}

export function QuranPageView({
  pageText,
  pageNumber,
  ghareebWords,
  highlightedWordIndex,
  onWordClick,
}: QuranPageViewProps) {
  const renderedContent = useMemo(() => {
    if (!pageText || ghareebWords.length === 0) {
      return <span>{pageText}</span>;
    }

    // Create a map of ghareeb words for quick lookup
    const wordMap = new Map<string, { word: GhareebWord; index: number }[]>();
    ghareebWords.forEach((gw, index) => {
      const normalized = gw.word_text.trim();
      if (!wordMap.has(normalized)) {
        wordMap.set(normalized, []);
      }
      wordMap.get(normalized)!.push({ word: gw, index });
    });

    // Split text by whitespace while preserving spaces
    const tokens = pageText.split(/(\s+)/);
    const usedIndices = new Set<number>();

    return tokens.map((token, tokenIndex) => {
      // If it's whitespace, just render it
      if (/^\s+$/.test(token)) {
        return <span key={tokenIndex}>{token}</span>;
      }

      // Check if this token matches any ghareeb word
      const normalized = token.trim();
      const matches = wordMap.get(normalized);

      if (matches && matches.length > 0) {
        // Find the first unused match
        const unusedMatch = matches.find(m => !usedIndices.has(m.index));
        
        if (unusedMatch) {
          usedIndices.add(unusedMatch.index);
          const isHighlighted = highlightedWordIndex === unusedMatch.index;
          
          return (
            <span
              key={tokenIndex}
              className={isHighlighted ? 'word-highlight' : 'word-ghareeb'}
              onClick={() => onWordClick(unusedMatch.word, unusedMatch.index)}
            >
              {token}
            </span>
          );
        }
      }

      return <span key={tokenIndex}>{token}</span>;
    });
  }, [pageText, ghareebWords, highlightedWordIndex, onWordClick]);

  return (
    <div className="page-frame p-6 sm:p-8 md:p-10">
      {/* Page Number Header */}
      <div className="flex justify-center mb-4">
        <span className="bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-arabic">
          صفحة {pageNumber}
        </span>
      </div>

      {/* Quran Text */}
      <div className="quran-page min-h-[400px] sm:min-h-[500px]">
        {renderedContent}
      </div>

      {/* Decorative Footer */}
      <div className="flex justify-center mt-6">
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-ornament/30 to-transparent rounded-full" />
      </div>
    </div>
  );
}
