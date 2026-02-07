import React, { useMemo } from 'react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';

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

    // Process ghareeb words: normalize and track usage
    const ghareebData = ghareebWords.map((gw, idx) => {
      const normalized = normalizeArabic(gw.wordText);
      // Get individual words from multi-word phrases
      const words = normalized.split(' ').filter(w => w.length >= 2);
      return {
        original: gw,
        index: idx,
        normalizedFull: normalized,
        firstWord: words[0] || normalized,
        allWords: words,
        used: false,
      };
    });

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

        const normalizedToken = normalizeArabic(token);
        
        // Check if this token matches any ghareeb word (not yet used)
        for (const gw of ghareebData) {
          if (gw.used) continue;
          
          // Match if:
          // 1. Token equals the full normalized word/phrase
          // 2. Token equals the first word of a phrase
          // 3. Token contains the first word (for words with attached particles)
          // 4. First word contains the token (for partial matches)
          const isMatch = 
            normalizedToken === gw.normalizedFull ||
            normalizedToken === gw.firstWord ||
            normalizedToken.includes(gw.firstWord) ||
            gw.firstWord.includes(normalizedToken) ||
            gw.allWords.some(w => normalizedToken.includes(w) || w.includes(normalizedToken));
          
          if (isMatch) {
            gw.used = true;
            const isHighlighted = highlightedWordIndex === gw.index;
            
            return (
              <span
                key={`${lineIdx}-${tokenIndex}`}
                className={isHighlighted ? 'word-highlight' : 'word-ghareeb'}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(gw.original, gw.index);
                }}
              >
                {token}
              </span>
            );
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
