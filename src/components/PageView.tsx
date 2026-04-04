import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useAutoFitFont } from '@/hooks/useAutoFitFont';
import { useAutoFlowFit } from '@/hooks/useAutoFlowFit';
import { useAutoFit15Lines } from '@/hooks/useAutoFit15Lines';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { canonicalize, buildFlatTokens, matchGhareebToTokens, buildTokenMatchMap, type TokenMatchInfo } from '@/utils/canonicalMatch';
import { GhareebWordPopover } from './GhareebWordPopover';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { getPageMetadata } from '@/utils/juzHizbInfo';
import { redistributeLines, shouldRedistribute } from '@/utils/lineRedistributor';
import { formatBismillah, shouldNoJustify, bindVerseNumbers } from '@/utils/lineTokenUtils';

interface PageViewProps {
  page: QuranPage;
  ghareebWords: GhareebWord[];
  highlightedWordIndex: number;
  highlightedWordKey?: string | null;
  activeHighlightStyle?: 'default' | 'color' | 'bg' | 'border';
  meaningEnabled: boolean;
  disablePopover?: boolean;
  isPlaying?: boolean;
  onWordClick: (word: GhareebWord, index: number) => void;
  onRenderedWordsChange?: (words: GhareebWord[]) => void;
  hidePageBadge?: boolean;
  /** Force a specific display mode (used by hybrid overlay to force lines15) */
  forceDisplayMode?: string;
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

// Check if line is bismillah - use normalization to handle all Unicode variants
function isBismillah(line: string): boolean {
  const normalized = normalizeArabic(line);
  return normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله');
}

// ── Kept for verse-number rendering only ──
const PAGE_TOKEN_CLEAN_RE = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

export function PageView({
  page,
  ghareebWords,
  highlightedWordIndex,
  highlightedWordKey = null,
  activeHighlightStyle = 'default',
  meaningEnabled,
  disablePopover = false,
  isPlaying = false,
  onWordClick,
  onRenderedWordsChange,
  hidePageBadge,
  forceDisplayMode,
}: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRenderedKeysRef = useRef<string>('');
  const storeDisplayMode = useSettingsStore((s) => s.settings.display?.mode || 'continuous');
  const displayMode = forceDisplayMode || storeDisplayMode;
  const textDirection = useSettingsStore((s) => s.settings.display?.textDirection || 'rtl');
  const mobileLinesPerPage = useSettingsStore((s) => s.settings.display?.mobileLinesPerPage || 15);
  const desktopLinesPerPage = useSettingsStore((s) => s.settings.display?.desktopLinesPerPage || 15);
  const textAlign = useSettingsStore((s) => s.settings.display?.textAlign || 'justify');
  const minWordsPerLine = useSettingsStore((s) => s.settings.display?.minWordsPerLine || 5);
  const balanceLastLine = useSettingsStore((s) => s.settings.display?.balanceLastLine ?? false);
  const fontFamily = useSettingsStore((s) => s.settings.fonts.fontFamily);
  const fontWeight = useSettingsStore((s) => s.settings.fonts.fontWeight);
  const { containerRef: autoFitRef, fittedFontSize } = useAutoFitFont(page.text);
  
  // autoFlow15 removed — only continuous mode remains

  // Redistribute lines based on device
  const effectivePageText = useMemo(() => {
    if (displayMode !== 'lines15' || !shouldRedistribute(mobileLinesPerPage, desktopLinesPerPage, balanceLastLine)) return page.text;
    const originalLines = page.text.split('\n');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetLines = isMobile ? mobileLinesPerPage : desktopLinesPerPage;
    return redistributeLines(originalLines, targetLines, minWordsPerLine, balanceLastLine).join('\n');
  }, [page.text, displayMode, mobileLinesPerPage, desktopLinesPerPage, minWordsPerLine, balanceLastLine]);
  const { pageRef: lines15Ref, fittedFontSize: lines15FontSize } = useAutoFit15Lines(effectivePageText, fontFamily, fontWeight);
  const tahfeezMode = useTahfeezStore((s) => s.selectionMode);
  const toggleTahfeezWord = useTahfeezStore((s) => s.toggleWord);
  const isTahfeezSelected = useTahfeezStore((s) => s.isSelected);
  const rangeAnchor = useTahfeezStore((s) => s.rangeAnchor);
  const setRangeAnchor = useTahfeezStore((s) => s.setRangeAnchor);
  const addItem = useTahfeezStore((s) => s.addItem);
  const storedItems = useTahfeezStore((s) => s.storedItems);
  const getItemKey = useTahfeezStore((s) => s.getItemKey);
  // Subscribe to highlight overrides for reactivity (read-only, no editing)
  const highlightVersion = useHighlightOverrideStore((s) => s.version);

  // Per-line auto-shrink removed — page-level font fit handles everything

  // Auto-scroll: always scroll highlighted word into view when it's in the last 3 lines
  useEffect(() => {
    if (highlightedWordIndex < 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-ghareeb-index="${highlightedWordIndex}"]`,
    );
    if (!el) return;
    
    // Check if the word is in the last 3 lines of the visible page
    const container = el.closest('.quran-page, .quran-lines-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const bottomThreshold = containerRect.bottom - (containerRect.height * 0.2); // last ~20% ≈ 3 lines
      if (elRect.top > bottomThreshold) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        return;
      }
    }
    
    // Don't scroll if inside a fixed mushaf page (unless in bottom zone above)
    if (el?.closest('.mushafPage')) return;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [highlightedWordIndex]);

  // Build surah context map
  const surahContextByLine = useMemo(() => {
    const lines = effectivePageText.split('\n');
    const contextMap: string[] = [];

    // If a surah header exists mid-page, lines before it belong to the 
    // PREVIOUS surah. Use empty string so they match any surah's ghareeb words.
    const firstHeaderIdx = lines.findIndex(l => isSurahHeader(l));
    let currentSurah = (firstHeaderIdx > 0) ? '' : (page.surahName || '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Update context when we hit ANY surah header format
      if (isSurahHeader(line)) {
        currentSurah = extractSurahName(line);
      }

      contextMap.push(currentSurah);
    }

    return contextMap;
  }, [effectivePageText, page.surahName]);

  // ── New canonical matching engine (cross-line phrase support) ──
  const flatTokens = useMemo(() => {
    if (!effectivePageText) return [];
    const lines = effectivePageText.split('\n');
    return buildFlatTokens(lines, isSurahHeader, isBismillah);
  }, [effectivePageText]);

  const matchResults = useMemo(() => {
    return matchGhareebToTokens(flatTokens, ghareebWords, surahContextByLine);
  }, [flatTokens, ghareebWords, surahContextByLine]);

  const renderedWords = useMemo((): GhareebWord[] => {
    return matchResults.map((m, idx) => ({ ...m.word, order: idx }));
  }, [matchResults]);

  // Notify parent when rendered words change
  useEffect(() => {
    const keysString = renderedWords.map(w => w.uniqueKey).join(',');
    if (keysString !== lastRenderedKeysRef.current) {
      lastRenderedKeysRef.current = keysString;
      console.log('[PageView] Rendered words updated:', renderedWords.length, 'words');
      onRenderedWordsChange?.(renderedWords);
    }
  }, [renderedWords, onRenderedWordsChange]);

  const tokenMatchMap = useMemo(() => {
    return buildTokenMatchMap(matchResults);
  }, [matchResults]);

  const renderedContent = useMemo(() => {
    if (!effectivePageText) return null;

    const isLines15 = displayMode !== 'continuous';
    const lines = effectivePageText.split('\n');
    
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
          // Bismillah always as independent block line (even in auto-containment)
          elements.push(
            <div key={`bismillah-${idx}`} className="bismillah font-arabic" style={{ display: 'block', textAlign: 'center', textAlignLast: 'center' }}>
              {formatBismillah(line)}
            </div>
          );
        } else if (isLines15) {
          // Tokenize to apply verse-number styling even without ghareeb words
          const tokens = line.split(/(\s+)/);
          const lineElements: React.ReactNode[] = [];
          for (let ti = 0; ti < tokens.length; ti++) {
            const t = tokens[ti];
            const isSpace = /^\s+$/.test(t);
            if (isSpace) {
              lineElements.push(<span key={`${idx}-${ti}`}>{t}</span>);
              continue;
            }
            const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
            const isVN = /^[٠-٩0-9۰-۹]+$/.test(clean);
            if (isVN) {
              lineElements.push(<span key={`${idx}-${ti}`} className="verse-number">{t}</span>);
            } else {
              lineElements.push(<span key={`${idx}-${ti}`} className="quran-word">{t}</span>);
            }
          }
          const processedElements = bindVerseNumbers(lineElements, idx);
          const noJustify = shouldNoJustify(mobileLinesPerPage, desktopLinesPerPage, textAlign);
          elements.push(<div key={idx} className={`quran-line${noJustify ? ' quran-line--no-justify' : ''}`}>{processedElements}</div>);
        } else {
          // Auto-containment: still use block divs with justify for both-side alignment
          const tokens = line.split(/(\s+)/);
          const lineElements: React.ReactNode[] = [];
          for (let ti = 0; ti < tokens.length; ti++) {
            const t = tokens[ti];
            const isSpace = /^\s+$/.test(t);
            if (isSpace) {
              lineElements.push(<span key={`${idx}-${ti}`}>{t}</span>);
              continue;
            }
            const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
            const isVN = /^[٠-٩0-9۰-۹]+$/.test(clean);
            if (isVN) {
              lineElements.push(<span key={`${idx}-${ti}`} className="verse-number">{t}</span>);
            } else {
              lineElements.push(<span key={`${idx}-${ti}`} className="quran-word">{t}</span>);
            }
          }
          const processedElements = bindVerseNumbers(lineElements, idx);
          elements.push(<span key={idx}>{processedElements} </span>);
        }
      }
      
      return isLines15
        ? <div className="quran-lines-container">{elements}</div>
        : <div className="quran-page">{elements}</div>;
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

      // Bismillah - always independent block line
      if (isBismillah(line)) {
        allElements.push(
          <div key={`bismillah-${lineIdx}`} className="bismillah font-arabic" style={{ display: 'block', textAlign: 'center', textAlignLast: 'center' }}>
            {formatBismillah(line)}
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
          const isHighlighted =
            highlightedWordIndex === sequentialIndex ||
            (!!highlightedWordKey && info.word.uniqueKey === highlightedWordKey);
          
          // In tahfeez mode: render as plain spans (no ghareeb color) with selection border only
          if (tahfeezMode) {
            const isTSelected = isTahfeezSelected(info.word.surahNumber, info.word.verseNumber, info.word.wordIndex, page.pageNumber);
            const isAnchor = rangeAnchor && rangeAnchor.lineIdx === lineIdx && rangeAnchor.tokenIdx === i;

            const handleTahfeezClick = (e: React.MouseEvent, tokenIndex: number) => {
              e.stopPropagation();
              if (rangeAnchor && rangeAnchor.lineIdx === lineIdx && rangeAnchor.page === page.pageNumber) {
                // Second click: create phrase from anchor to here
                const startIdx = Math.min(rangeAnchor.tokenIdx, tokenIndex);
                const endIdx = Math.max(rangeAnchor.tokenIdx, tokenIndex);
                if (startIdx === endIdx) {
                  // Same token, just toggle word
                  toggleTahfeezWord({
                    surahNumber: info.word.surahNumber, ayahNumber: info.word.verseNumber,
                    wordIndex: info.word.wordIndex, originalWord: info.word.wordText, page: page.pageNumber,
                  });
                } else {
                  // Collect text for the phrase
                  const phraseTokens = tokens.slice(startIdx, endIdx + 1);
                  const phraseText = phraseTokens.join('');
                  addItem({
                    type: 'phrase',
                    data: {
                      surahNumber: info.word.surahNumber, ayahNumber: info.word.verseNumber,
                      startWordIndex: startIdx, endWordIndex: endIdx,
                      originalText: phraseText, page: page.pageNumber, lineIdx,
                    },
                  });
                }
                setRangeAnchor(null);
              } else {
                // First click: set anchor
                setRangeAnchor({ lineIdx, tokenIdx: tokenIndex, surahNumber: info.word.surahNumber, ayahNumber: info.word.verseNumber, page: page.pageNumber });
              }
            };

            if (info.isPartOfPhrase && info.phraseStart) {
              const lastPhraseTokenIdx = info.phraseTokens[info.phraseTokens.length - 1];
              const phraseText: string[] = [];
              for (let k = i; k <= lastPhraseTokenIdx; k++) {
                phraseText.push(tokenData[k].token);
              }
              lineElements.push(
                <span
                  key={`${lineIdx}-phrase-${i}`}
                  className={`quran-word tahfeez-selectable ${isTSelected ? 'tahfeez-selected' : ''} ${isAnchor ? 'tahfeez-range-anchor' : ''}`}
                  onClick={(e) => handleTahfeezClick(e, i)}
                >
                  {phraseText.join('')}
                </span>
              );
              i = lastPhraseTokenIdx + 1;
              continue;
            } else if (!info.isPartOfPhrase) {
              lineElements.push(
                <span
                  key={`${lineIdx}-${i}`}
                  className={`quran-word tahfeez-selectable ${isTSelected ? 'tahfeez-selected' : ''} ${isAnchor ? 'tahfeez-range-anchor' : ''}`}
                  onClick={(e) => handleTahfeezClick(e, i)}
                >
                  {td.token}
                </span>
              );
              i++;
              continue;
            }
          }
          
          // Normal highlight rendering (non-tahfeez mode)
          if (info.isPartOfPhrase && info.phraseStart) {
            const lastPhraseTokenIdx = info.phraseTokens[info.phraseTokens.length - 1];
            
            const phraseText: string[] = [];
            for (let k = i; k <= lastPhraseTokenIdx; k++) {
              phraseText.push(tokenData[k].token);
            }
            
            const phrase = phraseText.join('');

            if (disablePopover) {
              lineElements.push(
                <span
                  key={`${lineIdx}-phrase-${i}`}
                  className={`ghareeb-word quran-word ${isHighlighted ? 'ghareeb-word--active' : ''}`}
                  data-ghareeb-index={sequentialIndex}
                  data-ghareeb-key={info.word.uniqueKey}
                  data-color-idx={sequentialIndex % 5}
                >
                  {phrase}
                </span>
              );
            } else {
              lineElements.push(
                <GhareebWordPopover
                  key={`${lineIdx}-phrase-${i}`}
                  word={info.word}
                  index={sequentialIndex}
                  isHighlighted={isHighlighted}
                  forceOpen={meaningEnabled && isPlaying && isHighlighted}
                  onSelect={onWordClick}
                  containerRef={containerRef}
                  dataAssemblyId={assemblyId}
                  dataLineIndex={lineIdx}
                  dataTokenIndex={i}
                  pageNumber={page.pageNumber}
                  wasSeen={highlightedWordIndex > sequentialIndex}
                  activeHighlightStyle={activeHighlightStyle}
                >
                  {phrase}
                </GhareebWordPopover>
              );
            }
            
            i = lastPhraseTokenIdx + 1;
            continue;
          } else if (!info.isPartOfPhrase) {
            if (disablePopover) {
              lineElements.push(
                <span
                  key={`${lineIdx}-${i}`}
                  className={`ghareeb-word quran-word ${isHighlighted ? 'ghareeb-word--active' : ''}`}
                  data-ghareeb-index={sequentialIndex}
                  data-ghareeb-key={info.word.uniqueKey}
                  data-color-idx={sequentialIndex % 5}
                >
                  {td.token}
                </span>
              );
            } else {
              lineElements.push(
                <GhareebWordPopover
                  key={`${lineIdx}-${i}`}
                  word={info.word}
                  index={sequentialIndex}
                  isHighlighted={isHighlighted}
                  forceOpen={meaningEnabled && isPlaying && isHighlighted}
                  onSelect={onWordClick}
                  containerRef={containerRef}
                  dataAssemblyId={assemblyId}
                  dataLineIndex={lineIdx}
                  dataTokenIndex={i}
                  pageNumber={page.pageNumber}
                  wasSeen={highlightedWordIndex > sequentialIndex}
                  activeHighlightStyle={activeHighlightStyle}
                >
                  {td.token}
                </GhareebWordPopover>
              );
            }
            i++;
            continue;
          }
        }
        
        // Verse number - render with special styling
        if (td.isVerseNumber) {
          lineElements.push(
            <span key={`${lineIdx}-${i}`} className="verse-number">{td.token}</span>
          );
          i++;
          continue;
        }

        // Normal non-matched word (no override either)
        const isNonMatchSelected = tahfeezMode && isTahfeezSelected(0, 0, i, page.pageNumber);
        const isNonMatchAnchor = tahfeezMode && rangeAnchor && rangeAnchor.lineIdx === lineIdx && rangeAnchor.tokenIdx === i;
        lineElements.push(
          <span 
            key={`${lineIdx}-${i}`}
            data-word-inspectable="true"
            data-line-index={lineIdx}
            data-token-index={i}
            data-assembly-id={assemblyId}
            className={`quran-word ${tahfeezMode ? 'tahfeez-selectable' : ''} ${isNonMatchSelected ? 'tahfeez-selected' : ''} ${isNonMatchAnchor ? 'tahfeez-range-anchor' : ''}`}
            onClick={tahfeezMode && !td.isVerseNumber ? (e) => {
              e.stopPropagation();
              if (rangeAnchor && rangeAnchor.lineIdx === lineIdx && rangeAnchor.page === page.pageNumber) {
                const startIdx = Math.min(rangeAnchor.tokenIdx, i);
                const endIdx = Math.max(rangeAnchor.tokenIdx, i);
                if (startIdx === endIdx) {
                  toggleTahfeezWord({ surahNumber: 0, ayahNumber: 0, wordIndex: i, originalWord: td.token, page: page.pageNumber });
                } else {
                  const phraseTokens = tokens.slice(startIdx, endIdx + 1);
                  addItem({
                    type: 'phrase',
                    data: { surahNumber: 0, ayahNumber: 0, startWordIndex: startIdx, endWordIndex: endIdx, originalText: phraseTokens.join(''), page: page.pageNumber, lineIdx },
                  });
                }
                setRangeAnchor(null);
              } else {
                setRangeAnchor({ lineIdx, tokenIdx: i, surahNumber: 0, ayahNumber: 0, page: page.pageNumber });
              }
            } : undefined}
          >
            {td.token}
          </span>
        );
        i++;
      }

      // Add line elements - block for lines15 mode, inline for continuous
      const noJustify = shouldNoJustify(mobileLinesPerPage, desktopLinesPerPage, textAlign);
      // Bind verse numbers to preceding word with nowrap wrapper
      const processedElements = bindVerseNumbers(lineElements, lineIdx);
      
      if (isLines15) {
        allElements.push(
          <div key={`line-${lineIdx}`} className={`quran-line${noJustify ? ' quran-line--no-justify' : ''}`}>
            {processedElements}
          </div>
        );
      } else {
        allElements.push(
          <span key={`line-${lineIdx}`}>{processedElements} </span>
        );
      }
    }

    return isLines15 
      ? <div className="quran-lines-container">{allElements}</div>
      : <div className="quran-page">{allElements}</div>;
  }, [effectivePageText, page.pageNumber, ghareebWords, highlightedWordIndex, highlightedWordKey, meaningEnabled, disablePopover, isPlaying, onWordClick, surahContextByLine, tokenMatchMap, highlightVersion, displayMode, tahfeezMode, toggleTahfeezWord, isTahfeezSelected, rangeAnchor, setRangeAnchor, addItem, storedItems, activeHighlightStyle]);

  const pageBackgroundColor = useSettingsStore((s) => (s.settings.colors as any).pageBackgroundColor || '');
  const containerBorderColor = useSettingsStore((s) => (s.settings.colors as any).containerBorderColor || '');
  const pageFrameStyle: React.CSSProperties = {
    ...(pageBackgroundColor ? { background: `hsl(${pageBackgroundColor})` } : {}),
    ...(containerBorderColor ? { borderColor: `hsl(${containerBorderColor})` } : {}),
  };

  const pageMeta = useMemo(() => getPageMetadata(page.pageNumber), [page.pageNumber]);

  const pageContent = (
    <div ref={(el) => { (containerRef as any).current = el; (autoFitRef as any).current = el; (lines15Ref as any).current = el; }} className="page-frame p-4 sm:p-6" style={{ ...pageFrameStyle, ...(fittedFontSize ? { fontSize: `${fittedFontSize}rem` } : {}) }} dir={textDirection}>
      {/* Top Header: Hizb - Page Number - Hizb */}
      {!hidePageBadge && (
        <div className="flex items-center justify-between font-arabic text-xs sm:text-sm text-muted-foreground/70">
          <span>الحزب {pageMeta.hizbNumberArabic}</span>
          <span className="text-primary font-bold text-sm sm:text-base">{pageMeta.pageNumberArabic}</span>
          <span>الحزب {pageMeta.hizbNumberArabic}</span>
        </div>
      )}

      {/* Sub Header: Surah Name - Juz Name */}
      {!hidePageBadge && (
        <div className="flex items-center justify-between pb-2 border-b border-ornament/20 font-arabic">
          <span className="text-sm sm:text-base font-bold text-foreground">{pageMeta.surahName}</span>
          <span className="text-sm sm:text-base font-bold text-foreground">{pageMeta.juzName}</span>
        </div>
      )}

      {/* Quran Text */}
      <div className="quran-page min-h-[60vh] sm:min-h-[70vh]">
        {renderedContent}
      </div>

      {/* Footer: Page Number - Hizb */}
      {!hidePageBadge && (
        <div className="flex items-center justify-between pt-2 border-t border-ornament/20 font-arabic text-xs sm:text-sm text-muted-foreground/70">
          <span>{pageMeta.pageNumberArabic}</span>
          <span>الحزب {pageMeta.hizbNumberArabic}</span>
        </div>
      )}
    </div>
  );

  return pageContent;
}