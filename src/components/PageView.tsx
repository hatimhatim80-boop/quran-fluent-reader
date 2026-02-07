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

    // Process ghareeb words: normalize and group by normalized text
    const ghareebByNormalized = new Map<string, Array<{
      original: GhareebWord;
      index: number;
      normalizedFull: string;
      firstWord: string;
      allWords: string[];
      normalizedSurah: string;
    }>>();

    ghareebWords.forEach((gw, idx) => {
      const normalized = normalizeArabic(gw.wordText);
      const words = normalized.split(' ').filter(w => w.length >= 2);
      const entry = {
        original: gw,
        index: idx,
        normalizedFull: normalized,
        firstWord: words[0] || normalized,
        allWords: words,
        normalizedSurah: normalizeSurahName(gw.surahName),
      };
      
      const key = normalized;
      if (!ghareebByNormalized.has(key)) {
        ghareebByNormalized.set(key, []);
      }
      ghareebByNormalized.get(key)!.push(entry);
    });

    // Track which ghareeb entries have been used (by their index)
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

      // Split line by whitespace while preserving spaces
      const tokens = line.split(/(\s+)/);
      
      const elements = tokens.map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
        }

        // Skip verse numbers (Arabic or decorated numerals)
        // Verse numbers are typically: ١٢٣ or ﴿١٢٣﴾ or (123) etc.
        const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(token.replace(/[﴿﴾()[\]{}۝]/g, '').trim()) ||
                              /^[﴿﴾()[\]{}۝٠-٩0-9۰-۹\s]+$/.test(token);
        if (isVerseNumber) {
          return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
        }

        const normalizedToken = normalizeArabic(token);
        
        // Skip if normalized token is too short or empty (likely punctuation/numbers)
        if (normalizedToken.length < 2) {
          return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
        }
        
        // Find matching ghareeb entries
        let matchedEntry: {
          original: GhareebWord;
          index: number;
          normalizedFull: string;
          firstWord: string;
          allWords: string[];
          normalizedSurah: string;
        } | null = null;
        for (const [key, entries] of ghareebByNormalized) {
          // Check if token matches this normalized key
          const firstWord = entries[0]?.firstWord || key;
          const allWords = entries[0]?.allWords || [key];
          
          // Require minimum length match to avoid false positives
          if (firstWord.length < 2 && normalizedToken.length < 2) continue;
          
          const isMatch = 
            normalizedToken === key ||
            normalizedToken === firstWord ||
            (normalizedToken.length >= 3 && firstWord.length >= 3 && (normalizedToken.includes(firstWord) || firstWord.includes(normalizedToken))) ||
            allWords.some(w => w.length >= 3 && normalizedToken.length >= 3 && (normalizedToken.includes(w) || w.includes(normalizedToken)));
          
          if (!isMatch) continue;
          
          // Filter by surah context and unused
          const validEntries = entries.filter(e => 
            !usedIndices.has(e.index) && 
            (normalizedLocalSurah === '' || e.normalizedSurah === normalizedLocalSurah || e.normalizedSurah.includes(normalizedLocalSurah) || normalizedLocalSurah.includes(e.normalizedSurah))
          );
          
          if (validEntries.length > 0) {
            // Pick the first unused one (they're already in order)
            matchedEntry = validEntries[0];
            break;
          }
          
          // Fallback: if no surah match, pick any unused entry
          const anyUnused = entries.find(e => !usedIndices.has(e.index));
          if (anyUnused) {
            matchedEntry = anyUnused;
            break;
          }
        }
        
        if (matchedEntry) {
          usedIndices.add(matchedEntry.index);
          const isHighlighted = highlightedWordIndex === matchedEntry.index;
          const gw = matchedEntry;
          
          // Use local surah from page context for display
          const displaySurah = localSurah || gw.original.surahName;
          
          return (
            <span
              key={`${lineIdx}-${tokenIndex}`}
              className={`${isHighlighted ? 'word-highlight ' : ''}word-ghareeb cursor-pointer`}
              data-ghareeb-index={gw.index}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(gw.original, gw.index);
              }}
            >
              {token}
            </span>
          );
        }

        return <span key={`${lineIdx}-${tokenIndex}`}>{token}</span>;
      });

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
