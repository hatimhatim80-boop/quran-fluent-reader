import React, { useMemo } from 'react';
import { QuranPage, GhareebWord } from '@/types/quran';

interface PageViewProps {
  page: QuranPage;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  onWordClick: (word: GhareebWord, index: number) => void;
}

export function PageView({
  page,
  ghareebWords,
  highlightedWordIndex,
  onWordClick,
}: PageViewProps) {
  const renderedContent = useMemo(() => {
    if (!page.text || ghareebWords.length === 0) {
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

    // Create a map of ghareeb words for quick lookup
    const wordUsage: { [key: string]: number } = {};
    
    return page.text.split('\n').map((line, lineIdx) => {
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

      // Split line by whitespace while preserving spaces
      const tokens = line.split(/(\s+)/);
      
      const elements = tokens.map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
        }

        const normalizedToken = token.trim();
        
        // Check if this token matches any ghareeb word
        for (let i = 0; i < ghareebWords.length; i++) {
          const gw = ghareebWords[i];
          
          // Check for match (considering that tokens might have diacritics)
          if (normalizedToken.includes(gw.wordText) || gw.wordText.includes(normalizedToken)) {
            const key = `${gw.wordText}-${gw.order}`;
            const usageCount = wordUsage[key] || 0;
            
            // Only highlight first occurrence of each unique word
            if (usageCount === 0) {
              wordUsage[key] = usageCount + 1;
              const isHighlighted = highlightedWordIndex === i;
              
              return (
                <span
                  key={`${lineIdx}-${tokenIndex}`}
                  className={isHighlighted ? 'word-highlight' : 'word-ghareeb'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onWordClick(gw, i);
                  }}
                >
                  {token}
                </span>
              );
            }
          }
        }

        return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
      });

      return (
        <div key={lineIdx} className="mb-1">
          {elements}
        </div>
      );
    });
  }, [page.text, ghareebWords, highlightedWordIndex, onWordClick]);

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

      {/* Decorative Footer */}
      <div className="flex justify-center mt-6">
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-ornament/30 to-transparent rounded-full" />
      </div>
    </div>
  );
}
