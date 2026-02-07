import React, { useMemo } from 'react';
import { Surah, GhareebWord } from '@/types/quran';

interface SurahViewProps {
  surah: Surah;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  currentVerseIndex: number;
  onWordClick: (word: GhareebWord, index: number) => void;
  onVerseClick: (verseIndex: number) => void;
}

export function SurahView({
  surah,
  ghareebWords,
  highlightedWordIndex,
  currentVerseIndex,
  onWordClick,
  onVerseClick,
}: SurahViewProps) {
  // Create a map for quick word lookup
  const wordMap = useMemo(() => {
    const map = new Map<string, { word: GhareebWord; globalIndex: number }[]>();
    
    ghareebWords.forEach((gw, globalIndex) => {
      const key = `${gw.verseNumber}-${gw.wordText}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push({ word: gw, globalIndex });
    });
    
    return map;
  }, [ghareebWords]);

  // Render verse with highlighted words
  const renderVerse = (verse: typeof surah.verses[0], verseIdx: number) => {
    const tokens = verse.text.split(/(\s+)/);
    const usedIndices = new Set<number>();
    
    const verseGhareebWords = ghareebWords.filter(w => w.verseNumber === verse.verseNumber);
    
    const elements = tokens.map((token, tokenIndex) => {
      if (/^\s+$/.test(token)) {
        return <span key={tokenIndex}>{token}</span>;
      }

      const normalizedToken = token.trim();
      
      // Check if this token matches any ghareeb word for this verse
      for (let i = 0; i < verseGhareebWords.length; i++) {
        const gw = verseGhareebWords[i];
        if (usedIndices.has(i)) continue;
        
        // Check if the token contains the ghareeb word
        if (normalizedToken.includes(gw.wordText) || gw.wordText.includes(normalizedToken)) {
          usedIndices.add(i);
          
          // Find global index for this word
          const globalIndex = ghareebWords.findIndex(
            w => w.verseNumber === verse.verseNumber && 
                 w.wordText === gw.wordText && 
                 w.order === gw.order
          );
          
          const isHighlighted = highlightedWordIndex === globalIndex;
          
          return (
            <span
              key={tokenIndex}
              className={isHighlighted ? 'word-highlight' : 'word-ghareeb'}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(gw, globalIndex);
              }}
            >
              {token}
            </span>
          );
        }
      }

      return <span key={tokenIndex}>{token}</span>;
    });

    const isCurrentVerse = verseIdx === currentVerseIndex;

    return (
      <div
        key={verseIdx}
        className={`mb-4 p-3 rounded-lg transition-all cursor-pointer ${
          isCurrentVerse ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-muted/50'
        }`}
        onClick={() => onVerseClick(verseIdx)}
      >
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold ml-2">
          {verse.verseNumber}
        </span>
        <span className="quran-verse">{elements}</span>
      </div>
    );
  };

  return (
    <div className="page-frame p-6 sm:p-8 md:p-10">
      {/* Surah Header */}
      <div className="flex justify-center mb-6">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-arabic text-foreground mb-2">
            سورة {surah.name}
          </h2>
          <span className="bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-arabic">
            {surah.verses.length} آية
          </span>
        </div>
      </div>

      {/* Bismillah (except for At-Tawbah) */}
      {surah.name !== 'التَّوۡبَةِ' && surah.name !== 'التوبة' && (
        <div className="text-center mb-6 text-xl sm:text-2xl font-arabic text-primary">
          بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
        </div>
      )}

      {/* Verses */}
      <div className="quran-page min-h-[400px] sm:min-h-[500px]">
        {surah.verses.map((verse, idx) => renderVerse(verse, idx))}
      </div>

      {/* Decorative Footer */}
      <div className="flex justify-center mt-6">
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-ornament/30 to-transparent rounded-full" />
      </div>
    </div>
  );
}
