import React, { useMemo, useEffect, useRef } from 'react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { GhareebWordPopover } from './GhareebWordPopover';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTahfeezStore } from '@/stores/tahfeezStore';

interface PageViewProps {
  page: QuranPage;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  meaningEnabled: boolean;
  isPlaying?: boolean;
  onWordClick: (word: GhareebWord, index: number) => void;
  onRenderedWordsChange?: (words: GhareebWord[]) => void;
}

// Extract surah name from header line
function extractSurahName(line: string): string {
  // Supports both "سُورَةُ ..." (with diacritics) and "سورة ..." (without)
  return line
    .replace(/^سُورَةُ\s*/, '')
    .replace(/^سورة\s*/, '')
    .trim();
}

// Normalize surah name for comparison
function normalizeSurahName(name: string): string {
  return normalizeArabic(name).replace(/\s+/g, '');
}

// Check if line is a surah header
function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

// Check if line is bismillah
function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

// Strict word matching: require exact match or close substring (max 2 chars difference)
function isStrictMatch(tokenNorm: string, phraseWord: string): boolean {
  if (tokenNorm === phraseWord) return true;
  const lenDiff = Math.abs(tokenNorm.length - phraseWord.length);
  if (lenDiff > 2) return false;
  // Must also share at least 80% of the shorter length
  const shorter = Math.min(tokenNorm.length, phraseWord.length);
  if (shorter < 3) return false; // Don't allow substring match for very short words
  return tokenNorm.includes(phraseWord) || phraseWord.includes(tokenNorm);
}

interface MatchedWord {
  word: GhareebWord;
  originalIndex: number;
  lineIdx: number;
  tokenIdx: number;
  isPartOfPhrase: boolean;
  phraseStart: boolean;
  phraseTokens: number[];
}

export function PageView({
  page,
  ghareebWords,
  highlightedWordIndex,
  meaningEnabled,
  isPlaying = false,
  onWordClick,
  onRenderedWordsChange,
}: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRenderedKeysRef = useRef<string>('');
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'lines15');
  const tahfeezMode = useTahfeezStore((s) => s.selectionMode);
  const toggleTahfeezWord = useTahfeezStore((s) => s.toggleWord);
  const isTahfeezSelected = useTahfeezStore((s) => s.isSelected);
  // Subscribe to highlight overrides for reactivity (read-only, no editing)
  const highlightVersion = useHighlightOverrideStore((s) => s.version);

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

      // Update context when we hit ANY surah header format
      if (isSurahHeader(line)) {
        currentSurah = extractSurahName(line);
      }

      contextMap.push(currentSurah);
    }

    return contextMap;
  }, [page.text, page.surahName]);

  // First pass: determine which words are matched and in what order
  const matchedWordsInOrder = useMemo((): MatchedWord[] => {
    if (!page.text || ghareebWords.length === 0) return [];

    const lines = page.text.split('\n');
    const matched: MatchedWord[] = [];

    // Prepare ghareeb entries
    const ghareebEntries = ghareebWords.map((gw, idx) => {
      const normalizedFull = normalizeArabic(gw.wordText);
      const words = normalizedFull.split(/\s+/).filter(w => w.length >= 2);
      return {
        original: gw,
        originalIndex: idx,
        normalizedFull,
        words,
        wordCount: words.length,
        normalizedSurah: normalizeSurahName(gw.surahName),
      };
    });

    // Sort by word count descending for greedy matching
    const sortedEntries = [...ghareebEntries].sort((a, b) => b.wordCount - a.wordCount);

    // We must run matching passes across the WHOLE page (all lines)
    // so an earlier loose match can't steal an entry that has a later exact match.
    // Example: "وَسَعَىٰ" (2:114) contains "وسع" as a substring, but "وَٰسِعٌ" (2:115)
    // is the true exact match we want to prefer.
    const usedOriginalIndices = new Set<number>();
    const matchedTokenKeys = new Set<string>(); // `${lineIdx}_${tokenIdx}`

    const runMatchPass = (matchPass: 'exact' | 'loose') => {
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        if (isSurahHeader(line) || isBismillah(line)) continue;

        const localSurah = surahContextByLine[lineIdx] || '';
        const normalizedLocalSurah = normalizeSurahName(localSurah);

        // Split line into tokens
        const tokens = line.split(/(\s+)/);
        const tokenData = tokens.map((token, idx) => {
          const isSpace = /^\s+$/.test(token);
          const cleanToken = token
            .replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '')
            .trim();
          const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(cleanToken);

          return {
            token,
            idx,
            isSpace,
            isVerseNumber,
            normalized: isSpace || isVerseNumber ? '' : normalizeArabic(token),
          };
        });

        for (const entry of sortedEntries) {
          if (usedOriginalIndices.has(entry.originalIndex)) continue;
          if (entry.words.length === 0) continue;

          const surahMatch =
            normalizedLocalSurah === '' ||
            entry.normalizedSurah === normalizedLocalSurah ||
            entry.normalizedSurah.includes(normalizedLocalSurah) ||
            normalizedLocalSurah.includes(entry.normalizedSurah);
          if (!surahMatch) continue;

          for (let i = 0; i < tokenData.length; i++) {
            const startKey = `${lineIdx}_${i}`;
            if (
              tokenData[i].isSpace ||
              tokenData[i].isVerseNumber ||
              matchedTokenKeys.has(startKey)
            ) {
              continue;
            }

            let phraseWordIdx = 0;
            const matchedTokens: number[] = [];
            let j = i;

            while (j < tokenData.length && phraseWordIdx < entry.words.length) {
              const key = `${lineIdx}_${j}`;

              if (tokenData[j].isSpace) {
                j++;
                continue;
              }
              if (tokenData[j].isVerseNumber) {
                j++;
                continue;
              }
              if (matchedTokenKeys.has(key)) break;

              const tokenNorm = tokenData[j].normalized;
              const phraseWord = entry.words[phraseWordIdx];

              const isExact = tokenNorm === phraseWord;
              const isLoose = !isExact && isStrictMatch(tokenNorm, phraseWord);

              const ok = matchPass === 'exact' ? isExact : isExact || isLoose;
              if (ok) {
                matchedTokens.push(j);
                phraseWordIdx++;
                j++;
              } else {
                break;
              }
            }

            if (phraseWordIdx === entry.words.length && matchedTokens.length > 0) {
              // Reserve tokens globally so later passes/lines can't reuse them
              matchedTokens.forEach((tokIdx) => matchedTokenKeys.add(`${lineIdx}_${tokIdx}`));
              usedOriginalIndices.add(entry.originalIndex);

              matched.push({
                word: entry.original,
                originalIndex: entry.originalIndex,
                lineIdx,
                tokenIdx: matchedTokens[0],
                isPartOfPhrase: matchedTokens.length > 1,
                phraseStart: true,
                phraseTokens: matchedTokens,
              });
              break;
            }
          }
        }
      }
    };

    // Pass 1: exact matches across whole page
    runMatchPass('exact');
    // Pass 2: loose matches for remaining entries
    runMatchPass('loose');

    // Sort by reading order: line index first, then token index within line
    matched.sort((a, b) => a.lineIdx !== b.lineIdx ? a.lineIdx - b.lineIdx : a.tokenIdx - b.tokenIdx);
    return matched;
  }, [page.text, ghareebWords, surahContextByLine]);

  // Create the actual rendered words list with sequential indices
  const renderedWords = useMemo((): GhareebWord[] => {
    return matchedWordsInOrder.map((m, idx) => ({
      ...m.word,
      order: idx, // Sequential order 0..N-1
    }));
  }, [matchedWordsInOrder]);

  // Notify parent when rendered words change
  useEffect(() => {
    const keysString = renderedWords.map(w => w.uniqueKey).join(',');
    if (keysString !== lastRenderedKeysRef.current) {
      lastRenderedKeysRef.current = keysString;
      console.log('[PageView] Rendered words updated:', renderedWords.length, 'words');
      onRenderedWordsChange?.(renderedWords);
    }
  }, [renderedWords, onRenderedWordsChange]);

  // Create a map from originalIndex to sequentialIndex for rendering
  const originalToSequentialIndex = useMemo(() => {
    const map = new Map<number, number>();
    matchedWordsInOrder.forEach((m, sequentialIdx) => {
      map.set(m.originalIndex, sequentialIdx);
    });
    return map;
  }, [matchedWordsInOrder]);

  // Build a token-level lookup map from the first pass results
  // Key: "lineIdx_tokenIdx" → match info
  const tokenMatchMap = useMemo(() => {
    const map = new Map<string, {
      originalIndex: number;
      word: GhareebWord;
      sequentialIndex: number;
      isPartOfPhrase: boolean;
      phraseStart: boolean;
      phraseTokens: number[];
    }>();
    matchedWordsInOrder.forEach((m, seqIdx) => {
      m.phraseTokens.forEach((tokIdx, idx) => {
        map.set(`${m.lineIdx}_${tokIdx}`, {
          originalIndex: m.originalIndex,
          word: m.word,
          sequentialIndex: seqIdx,
          isPartOfPhrase: m.phraseTokens.length > 1,
          phraseStart: idx === 0,
          phraseTokens: m.phraseTokens,
        });
      });
    });
    return map;
  }, [matchedWordsInOrder]);

  const renderedContent = useMemo(() => {
    if (!page.text) return null;

    const isLines15 = displayMode === 'lines15';
    const lines = page.text.split('\n');
    
    // If no ghareeb words, render text
    if (ghareebWords.length === 0) {
      const elements: React.ReactNode[] = [];
      
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        
        if (isSurahHeader(line)) {
          elements.push(
            <div key={`header-${idx}`} className="surah-header">
              <span className="text-xl sm:text-2xl font-bold text-primary font-arabic">
                {line}
              </span>
            </div>
          );
        } else if (isBismillah(line)) {
          elements.push(
            <div key={`bismillah-${idx}`} className="bismillah font-arabic">
              {line}
            </div>
          );
        } else if (isLines15) {
          // Line-by-line mode
          if (line.trim()) {
            elements.push(<div key={idx} className="quran-line">{line}</div>);
          }
        } else {
          elements.push(<span key={idx}>{line} </span>);
        }
      }
      
      return <div className={isLines15 ? 'quran-lines-container' : 'inline'}>{elements}</div>;
    }

    const allElements: React.ReactNode[] = [];
    let assemblyIndex = -1;
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      // Surah header
      if (isSurahHeader(line)) {
        assemblyIndex = Math.max(assemblyIndex + 1, 0);
        allElements.push(
          <div key={`header-${lineIdx}`} className="surah-header">
            <span className="text-xl sm:text-2xl font-bold text-primary font-arabic">
              {line}
            </span>
          </div>
        );
        continue;
      }

      // Bismillah
      if (isBismillah(line)) {
        allElements.push(
          <div key={`bismillah-${lineIdx}`} className="bismillah font-arabic">
            {line}
          </div>
        );
        continue;
      }

      const assemblyId = `asm-${Math.max(assemblyIndex, 0)}`;

      // Split line into tokens
      const tokens = line.split(/(\s+)/);
      const tokenData = tokens.map((token, idx) => {
        const isSpace = /^\s+$/.test(token);
        const cleanToken = token.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(cleanToken);
        
        // Use tokenMatchMap from first pass instead of re-running matching
        const matchInfo = tokenMatchMap.get(`${lineIdx}_${idx}`);
        
        return {
          token,
          idx,
          isSpace,
          isVerseNumber,
          matched: !!matchInfo,
          matchInfo: matchInfo || null,
        };
      });

      // Build line elements
      const lineElements: React.ReactNode[] = [];
      let i = 0;
      
      while (i < tokenData.length) {
        const td = tokenData[i];
        
        if (td.isSpace) {
          lineElements.push(<span key={`${lineIdx}-${i}`}>{td.token}</span>);
          i++;
          continue;
        }
        
        
        if (td.matched && td.matchInfo) {
          const info = td.matchInfo;
          const sequentialIndex = info.sequentialIndex;
          const isHighlighted = highlightedWordIndex === sequentialIndex;
          
          
          // Normal highlight rendering
          if (info.isPartOfPhrase && info.phraseStart) {
            const lastPhraseTokenIdx = info.phraseTokens[info.phraseTokens.length - 1];
            
            const phraseText: string[] = [];
            for (let k = i; k <= lastPhraseTokenIdx; k++) {
              phraseText.push(tokenData[k].token);
            }
            
            const phrase = phraseText.join('');

            const isTSelected = tahfeezMode && isTahfeezSelected(info.word.surahNumber, info.word.verseNumber, info.word.wordIndex, page.pageNumber);
            lineElements.push(
                <GhareebWordPopover
                  key={`${lineIdx}-phrase-${i}`}
                  word={info.word}
                  index={sequentialIndex}
                  isHighlighted={isHighlighted}
                  forceOpen={!tahfeezMode && isPlaying && isHighlighted}
                  onSelect={onWordClick}
                  containerRef={containerRef}
                  dataAssemblyId={assemblyId}
                  dataLineIndex={lineIdx}
                  dataTokenIndex={i}
                  pageNumber={page.pageNumber}
                  wasSeen={highlightedWordIndex > sequentialIndex}
                  extraClassName={`${tahfeezMode ? 'tahfeez-selectable' : ''} ${isTSelected ? 'tahfeez-selected' : ''}`}
                  onExtraClick={tahfeezMode ? (e) => {
                    e.stopPropagation();
                    toggleTahfeezWord({
                      surahNumber: info.word.surahNumber,
                      ayahNumber: info.word.verseNumber,
                      wordIndex: info.word.wordIndex,
                      originalWord: info.word.wordText,
                      page: page.pageNumber,
                    });
                  } : undefined}
                >
                  {phrase}
                </GhareebWordPopover>
              );
            
            i = lastPhraseTokenIdx + 1;
            continue;
          } else if (!info.isPartOfPhrase) {
            const isTSelected2 = tahfeezMode && isTahfeezSelected(info.word.surahNumber, info.word.verseNumber, info.word.wordIndex, page.pageNumber);
            lineElements.push(
                <GhareebWordPopover
                  key={`${lineIdx}-${i}`}
                  word={info.word}
                  index={sequentialIndex}
                  isHighlighted={isHighlighted}
                  forceOpen={!tahfeezMode && isPlaying && isHighlighted}
                  onSelect={onWordClick}
                  containerRef={containerRef}
                  dataAssemblyId={assemblyId}
                  dataLineIndex={lineIdx}
                  dataTokenIndex={i}
                  pageNumber={page.pageNumber}
                  wasSeen={highlightedWordIndex > sequentialIndex}
                  extraClassName={`${tahfeezMode ? 'tahfeez-selectable' : ''} ${isTSelected2 ? 'tahfeez-selected' : ''}`}
                  onExtraClick={tahfeezMode ? (e) => {
                    e.stopPropagation();
                    toggleTahfeezWord({
                      surahNumber: info.word.surahNumber,
                      ayahNumber: info.word.verseNumber,
                      wordIndex: info.word.wordIndex,
                      originalWord: info.word.wordText,
                      page: page.pageNumber,
                    });
                  } : undefined}
                >
                  {td.token}
                </GhareebWordPopover>
              );
            i++;
            continue;
          }
        }
        
        // Normal non-matched word (no override either)
        const isNonMatchSelected = tahfeezMode && isTahfeezSelected(0, 0, i, page.pageNumber);
        lineElements.push(
          <span 
            key={`${lineIdx}-${i}`}
            data-word-inspectable="true"
            data-line-index={lineIdx}
            data-token-index={i}
            data-assembly-id={assemblyId}
            className={`${tahfeezMode ? 'tahfeez-selectable' : ''} ${isNonMatchSelected ? 'tahfeez-selected' : ''}`}
            onClick={tahfeezMode && !td.isVerseNumber ? (e) => {
              e.stopPropagation();
              toggleTahfeezWord({
                surahNumber: 0,
                ayahNumber: 0,
                wordIndex: i,
                originalWord: td.token,
                page: page.pageNumber,
              });
            } : undefined}
          >
            {td.token}
          </span>
        );
        i++;
      }

      // Add line elements - block for lines15 mode, inline for continuous
      if (isLines15) {
        allElements.push(
          <div key={`line-${lineIdx}`} className="quran-line">
            {lineElements}
          </div>
        );
      } else {
        allElements.push(
          <span key={`line-${lineIdx}`}>
            {lineElements}{' '}
          </span>
        );
      }
    }

    return <div className={isLines15 ? 'quran-lines-container' : 'inline'}>{allElements}</div>;
  }, [page.text, page.pageNumber, ghareebWords, highlightedWordIndex, isPlaying, onWordClick, surahContextByLine, tokenMatchMap, highlightVersion, displayMode, tahfeezMode, toggleTahfeezWord, isTahfeezSelected]);

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

      {/* Word Count - shows actual rendered count */}
      {renderedWords.length > 0 && (
        <div className="text-center text-xs text-muted-foreground mt-5 font-arabic opacity-70">
          {renderedWords.length} كلمة غريبة
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