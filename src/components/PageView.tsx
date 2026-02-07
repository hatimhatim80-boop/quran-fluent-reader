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

    // Prepare ghareeb entries with normalized words
    const ghareebEntries = ghareebWords.map((gw, idx) => {
      const normalizedFull = normalizeArabic(gw.wordText);
      const words = normalizedFull.split(/\s+/).filter(w => w.length >= 2);
      return {
        original: gw,
        index: idx,
        normalizedFull,
        words, // Individual normalized words in the phrase
        wordCount: words.length,
        normalizedSurah: normalizeSurahName(gw.surahName),
      };
    });

    // Sort by word count descending (match longer phrases first)
    const sortedEntries = [...ghareebEntries].sort((a, b) => b.wordCount - a.wordCount);

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

      // Split line into tokens (words and spaces)
      const tokens = line.split(/(\s+)/);
      const tokenData = tokens.map((token, idx) => {
        const isSpace = /^\s+$/.test(token);
        // Check if token is a verse number (Arabic numerals with optional decorative marks)
        const cleanToken = token.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(cleanToken);
        
        return {
          token,
          idx,
          isSpace,
          isVerseNumber,
          normalized: (isSpace || isVerseNumber) ? '' : normalizeArabic(token),
          matched: false,
          matchEntry: null as typeof ghareebEntries[0] | null,
          isPartOfPhrase: false,
          phraseStart: false,
          phraseTokens: [] as number[], // indices of tokens in this phrase
        };
      });

      // Try to match multi-word phrases first, then single words
      for (const entry of sortedEntries) {
        if (usedIndices.has(entry.index)) continue;
        if (entry.words.length === 0) continue;

        // Check surah context
        const surahMatch = normalizedLocalSurah === '' || 
          entry.normalizedSurah === normalizedLocalSurah || 
          entry.normalizedSurah.includes(normalizedLocalSurah) || 
          normalizedLocalSurah.includes(entry.normalizedSurah);
        if (!surahMatch) continue;

        // Find consecutive tokens that match the phrase words
        for (let i = 0; i < tokenData.length; i++) {
          if (tokenData[i].isSpace || tokenData[i].isVerseNumber || tokenData[i].matched) continue;
          
          // Check if this token starts a phrase match
          let phraseWordIdx = 0;
          let matchedTokens: number[] = [];
          let j = i;
          
          while (j < tokenData.length && phraseWordIdx < entry.words.length) {
            if (tokenData[j].isSpace) {
              j++;
              continue;
            }
            // Skip verse numbers in phrase matching
            if (tokenData[j].isVerseNumber) {
              j++;
              continue;
            }
            if (tokenData[j].matched) break;
            
            const tokenNorm = tokenData[j].normalized;
            const phraseWord = entry.words[phraseWordIdx];
            
            // Check if this token matches the current phrase word
            const isMatch = tokenNorm === phraseWord || 
              tokenNorm.includes(phraseWord) || 
              phraseWord.includes(tokenNorm);
            
            if (isMatch) {
              matchedTokens.push(j);
              phraseWordIdx++;
              j++;
            } else {
              break;
            }
          }
          
          // If we matched all words in the phrase
          if (phraseWordIdx === entry.words.length && matchedTokens.length > 0) {
            // Mark all matched tokens
            matchedTokens.forEach((tokenIdx, idx) => {
              tokenData[tokenIdx].matched = true;
              tokenData[tokenIdx].matchEntry = entry;
              tokenData[tokenIdx].isPartOfPhrase = matchedTokens.length > 1;
              tokenData[tokenIdx].phraseStart = idx === 0;
              tokenData[tokenIdx].phraseTokens = matchedTokens;
            });
            usedIndices.add(entry.index);
            break; // Move to next entry
          }
        }
      }

      // Build the rendered elements
      const elements: React.ReactNode[] = [];
      let i = 0;
      
      while (i < tokenData.length) {
        const td = tokenData[i];
        
        if (td.isSpace) {
          elements.push(<span key={`${lineIdx}-${i}`}>{td.token}</span>);
          i++;
          continue;
        }
        
        if (td.matched && td.matchEntry) {
          const entry = td.matchEntry;
          const isHighlighted = highlightedWordIndex === entry.index;
          
          if (td.isPartOfPhrase && td.phraseStart) {
            // Collect all tokens in this phrase (including spaces between)
            const phraseTokenIndices = td.phraseTokens;
            const lastPhraseTokenIdx = phraseTokenIndices[phraseTokenIndices.length - 1];
            
            // Collect all tokens from first to last (including spaces)
            const phraseText: string[] = [];
            for (let k = i; k <= lastPhraseTokenIdx; k++) {
              phraseText.push(tokenData[k].token);
            }
            
            elements.push(
              <span
                key={`${lineIdx}-phrase-${i}`}
                className={`${isHighlighted ? 'word-highlight ' : ''}word-ghareeb cursor-pointer`}
                data-ghareeb-index={entry.index}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(entry.original, entry.index);
                }}
              >
                {phraseText.join('')}
              </span>
            );
            
            i = lastPhraseTokenIdx + 1;
            continue;
          } else if (!td.isPartOfPhrase) {
            // Single word match
            elements.push(
              <span
                key={`${lineIdx}-${i}`}
                className={`${isHighlighted ? 'word-highlight ' : ''}word-ghareeb cursor-pointer`}
                data-ghareeb-index={entry.index}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(entry.original, entry.index);
                }}
              >
                {td.token}
              </span>
            );
            i++;
            continue;
          }
        }
        
        // Unmatched token
        elements.push(<span key={`${lineIdx}-${i}`}>{td.token}</span>);
        i++;
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
