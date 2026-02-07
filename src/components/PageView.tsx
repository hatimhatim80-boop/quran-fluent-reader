import React, { useMemo, useEffect, useRef } from 'react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { GhareebWordPopover } from './GhareebWordPopover';

interface PageViewProps {
  page: QuranPage;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  onWordClick: (word: GhareebWord, index: number) => void;
}

// Extract surah name from header line
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedWordIndex < 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-ghareeb-index="${highlightedWordIndex}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [highlightedWordIndex]);

  // Build surah context map
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
    if (!page.text) return null;

    // If no ghareeb words, render plain text
    if (ghareebWords.length === 0) {
      return page.text.split('\n').map((line, idx) => (
        <div key={idx} className="mb-1">
          {line.startsWith('سُورَةُ') ? (
            <div className="surah-header">
              <span className="text-lg sm:text-xl font-bold text-primary font-arabic">
                {line}
              </span>
            </div>
          ) : line.startsWith('بِسۡمِ ٱللَّهِ') ? (
            <div className="bismillah font-arabic">{line}</div>
          ) : (
            <span>{line}</span>
          )}
        </div>
      ));
    }

    // Prepare ghareeb entries
    const ghareebEntries = ghareebWords.map((gw, idx) => {
      const normalizedFull = normalizeArabic(gw.wordText);
      const words = normalizedFull.split(/\s+/).filter(w => w.length >= 2);
      return {
        original: gw,
        index: idx,
        normalizedFull,
        words,
        wordCount: words.length,
        normalizedSurah: normalizeSurahName(gw.surahName),
      };
    });

    // Sort by word count descending
    const sortedEntries = [...ghareebEntries].sort((a, b) => b.wordCount - a.wordCount);
    const usedIndices = new Set<number>();

    return page.text.split('\n').map((line, lineIdx) => {
      const localSurah = surahContextByLine[lineIdx] || '';
      const normalizedLocalSurah = normalizeSurahName(localSurah);

      // Surah header
      if (line.startsWith('سُورَةُ')) {
        return (
          <div key={lineIdx} className="surah-header">
            <span className="text-lg sm:text-xl font-bold text-primary font-arabic">
              {line}
            </span>
          </div>
        );
      }

      // Bismillah
      if (line.startsWith('بِسۡمِ ٱللَّهِ')) {
        return (
          <div key={lineIdx} className="bismillah font-arabic">
            {line}
          </div>
        );
      }

      // Split line into tokens
      const tokens = line.split(/(\s+)/);
      const tokenData = tokens.map((token, idx) => {
        const isSpace = /^\s+$/.test(token);
        const cleanToken = token.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
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
          phraseTokens: [] as number[],
        };
      });

      // Match phrases
      for (const entry of sortedEntries) {
        if (usedIndices.has(entry.index)) continue;
        if (entry.words.length === 0) continue;

        const surahMatch = normalizedLocalSurah === '' || 
          entry.normalizedSurah === normalizedLocalSurah || 
          entry.normalizedSurah.includes(normalizedLocalSurah) || 
          normalizedLocalSurah.includes(entry.normalizedSurah);
        if (!surahMatch) continue;

        for (let i = 0; i < tokenData.length; i++) {
          if (tokenData[i].isSpace || tokenData[i].isVerseNumber || tokenData[i].matched) continue;
          
          let phraseWordIdx = 0;
          let matchedTokens: number[] = [];
          let j = i;
          
          while (j < tokenData.length && phraseWordIdx < entry.words.length) {
            if (tokenData[j].isSpace) {
              j++;
              continue;
            }
            if (tokenData[j].isVerseNumber) {
              j++;
              continue;
            }
            if (tokenData[j].matched) break;
            
            const tokenNorm = tokenData[j].normalized;
            const phraseWord = entry.words[phraseWordIdx];
            
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
          
          if (phraseWordIdx === entry.words.length && matchedTokens.length > 0) {
            matchedTokens.forEach((tokenIdx, idx) => {
              tokenData[tokenIdx].matched = true;
              tokenData[tokenIdx].matchEntry = entry;
              tokenData[tokenIdx].isPartOfPhrase = matchedTokens.length > 1;
              tokenData[tokenIdx].phraseStart = idx === 0;
              tokenData[tokenIdx].phraseTokens = matchedTokens;
            });
            usedIndices.add(entry.index);
            break;
          }
        }
      }

      // Build elements
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
            const phraseTokenIndices = td.phraseTokens;
            const lastPhraseTokenIdx = phraseTokenIndices[phraseTokenIndices.length - 1];
            
            const phraseText: string[] = [];
            for (let k = i; k <= lastPhraseTokenIdx; k++) {
              phraseText.push(tokenData[k].token);
            }
            
            elements.push(
              <GhareebWordPopover
                key={`${lineIdx}-phrase-${i}`}
                word={entry.original}
                index={entry.index}
                isHighlighted={isHighlighted}
                onSelect={onWordClick}
                containerRef={containerRef}
              >
                {phraseText.join('')}
              </GhareebWordPopover>
            );
            
            i = lastPhraseTokenIdx + 1;
            continue;
          } else if (!td.isPartOfPhrase) {
            elements.push(
              <GhareebWordPopover
                key={`${lineIdx}-${i}`}
                word={entry.original}
                index={entry.index}
                isHighlighted={isHighlighted}
                onSelect={onWordClick}
                containerRef={containerRef}
              >
                {td.token}
              </GhareebWordPopover>
            );
            i++;
            continue;
          }
        }
        
        elements.push(<span key={`${lineIdx}-${i}`}>{td.token}</span>);
        i++;
      }

      return (
        <div key={lineIdx} className="mb-0.5">
          {elements}
        </div>
      );
    });
  }, [page.text, ghareebWords, highlightedWordIndex, onWordClick, surahContextByLine]);

  return (
    <div ref={containerRef} className="page-frame p-5 sm:p-8">
      {/* Page Number */}
      <div className="flex justify-center mb-5">
        <span className="bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-arabic shadow-sm">
          صفحة {page.pageNumber}
        </span>
      </div>

      {/* Quran Text */}
      <div className="quran-page min-h-[350px] sm:min-h-[450px]">
        {renderedContent}
      </div>

      {/* Word Count - subtle */}
      {ghareebWords.length > 0 && (
        <div className="text-center text-xs text-muted-foreground mt-5 font-arabic opacity-70">
          {ghareebWords.length} كلمة غريبة
        </div>
      )}

      {/* Decorative divider */}
      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-px bg-gradient-to-r from-transparent to-ornament/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-ornament/30" />
          <div className="w-8 h-px bg-gradient-to-l from-transparent to-ornament/30" />
        </div>
      </div>
    </div>
  );
}
