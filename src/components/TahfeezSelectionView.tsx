import React, { useState, useMemo, useCallback, useRef } from 'react';
import { QuranPage } from '@/types/quran';
import { useTahfeezStore, TahfeezItem, TahfeezPhrase } from '@/stores/tahfeezStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAutoFlowFit } from '@/hooks/useAutoFlowFit';
import { redistributeLines, shouldRedistribute } from '@/utils/lineRedistributor';
import { formatBismillah, shouldNoJustify, bindVerseNumbersSimple } from '@/utils/lineTokenUtils';

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

interface TokenData {
  text: string;
  lineIdx: number;
  tokenIdx: number;
  isSpace: boolean;
  isVerseNumber: boolean;
  isHeader: boolean;
  isBismillah: boolean;
}

interface TahfeezSelectionViewProps {
  page: QuranPage;
  hidePageBadge?: boolean;
}

export function TahfeezSelectionView({ page, hidePageBadge }: TahfeezSelectionViewProps) {
  const { storedItems, addItem, removeItem, getItemKey, rangeAnchor, setRangeAnchor } = useTahfeezStore();
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'lines15');
  const textDirection = useSettingsStore((s) => s.settings.display?.textDirection || 'rtl');
  const mobileLinesPerPage = useSettingsStore((s) => s.settings.display?.mobileLinesPerPage || 15);
  const desktopLinesPerPage = useSettingsStore((s) => s.settings.display?.desktopLinesPerPage || 15);
  const textAlign = useSettingsStore((s) => s.settings.display?.textAlign || 'justify');
  const minWordsPerLine = useSettingsStore((s) => s.settings.display?.minWordsPerLine || 5);
  const balanceLastLine = useSettingsStore((s) => s.settings.display?.balanceLastLine ?? false);
  const isAutoFlow15 = displayMode === 'autoFlow15';
  const isLines15 = isAutoFlow15;
  const [selectionType, setSelectionType] = useState<'word' | 'phrase'>('word');
  const fontFamilyCSS = (() => {
    const fontMap: Record<string, string> = {
      amiri: "'Amiri', serif", amiriQuran: "'Amiri Quran', serif",
      notoNaskh: "'Noto Naskh Arabic', serif", scheherazade: "'Scheherazade New', serif",
      uthman: "'KFGQPC HAFS Uthmanic Script', serif", uthmanicHafs: "'UthmanicHafs', serif",
      meQuran: "'me_quran', serif", qalam: "'Al Qalam Quran', serif",
    };
    return fontMap[useSettingsStore.getState().settings.fonts.fontFamily] || fontMap.uthman;
  })();
  const fontWeight = useSettingsStore((s) => s.settings.fonts.fontWeight);
  const lineHeightSetting = useSettingsStore((s) => s.settings.fonts.lineHeight);
  const { containerRef: autoFlowRef, fittedFontSize } = useAutoFlowFit(
    page.text, fontFamilyCSS, fontWeight, lineHeightSetting, 15, isAutoFlow15, undefined
  );

  // Redistribute lines based on device
  const effectiveText = useMemo(() => {
    if (displayMode !== 'lines15' || !shouldRedistribute(mobileLinesPerPage, desktopLinesPerPage, balanceLastLine)) return page.text;
    const originalLines = page.text.split('\n');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetLines = isMobile ? mobileLinesPerPage : desktopLinesPerPage;
    return redistributeLines(originalLines, targetLines, minWordsPerLine, balanceLastLine).join('\n');
  }, [page.text, displayMode, mobileLinesPerPage, desktopLinesPerPage, minWordsPerLine, balanceLastLine]);

  const { lines, tokens } = useMemo(() => {
    const lines = effectiveText.split('\n');
    const tokens: TokenData[][] = [];
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const isH = isSurahHeader(line);
      const isB = isBismillah(line);
      if (isH || isB) {
        tokens.push([{ text: line, lineIdx, tokenIdx: 0, isSpace: false, isVerseNumber: false, isHeader: isH, isBismillah: isB }]);
        continue;
      }
      const parts = line.split(/(\s+)/);
      const lineTokens: TokenData[] = [];
      for (let tokenIdx = 0; tokenIdx < parts.length; tokenIdx++) {
        const t = parts[tokenIdx];
        const isSpace = /^\s+$/.test(t);
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(clean);
        lineTokens.push({ text: t, lineIdx, tokenIdx, isSpace, isVerseNumber, isHeader: false, isBismillah: false });
      }
      tokens.push(lineTokens);
    }
    return { lines, tokens };
  }, [effectiveText]);

  // Check if a word token is already stored
  const isTokenStored = useCallback((lineIdx: number, tokenIdx: number, text: string): boolean => {
    return storedItems.some(item => {
      if (item.data.page !== page.pageNumber) return false;
      if (item.type === 'word') {
        const w = item.data;
        return w.wordIndex === tokenIdx && w.originalWord === text && (w.lineIdx === undefined || w.lineIdx === lineIdx);
      } else {
        return item.data.lineIdx === lineIdx && tokenIdx >= item.data.startWordIndex && tokenIdx <= item.data.endWordIndex;
      }
    });
  }, [storedItems, page.pageNumber]);

  // Check if token is the range anchor
  const isAnchor = useCallback((lineIdx: number, tokenIdx: number): boolean => {
    if (!rangeAnchor) return false;
    return rangeAnchor.lineIdx === lineIdx && rangeAnchor.tokenIdx === tokenIdx;
  }, [rangeAnchor]);

  const handleTokenClick = useCallback((lineIdx: number, tokenIdx: number, text: string) => {
    if (selectionType === 'word') {
      // Toggle single word
      const existingItem = storedItems.find(item => {
        if (item.data.page !== page.pageNumber) return false;
        if (item.type === 'word') {
          const w = item.data;
          return w.wordIndex === tokenIdx && w.originalWord === text && (w.lineIdx === undefined || w.lineIdx === lineIdx);
        }
        return false;
      });
      if (existingItem) {
        removeItem(getItemKey(existingItem));
      } else {
        addItem({
          type: 'word',
          data: {
            surahNumber: 0,
            ayahNumber: 0,
            wordIndex: tokenIdx,
            originalWord: text,
            page: page.pageNumber,
            lineIdx,
          }
        });
      }
    } else {
      // Phrase mode: anchor then complete
      if (!rangeAnchor || rangeAnchor.page !== page.pageNumber) {
        setRangeAnchor({ lineIdx, tokenIdx, surahNumber: 0, ayahNumber: 0, page: page.pageNumber });
      } else {
        // Complete the phrase - must be same line
        if (rangeAnchor.lineIdx === lineIdx) {
          const start = Math.min(rangeAnchor.tokenIdx, tokenIdx);
          const end = Math.max(rangeAnchor.tokenIdx, tokenIdx);
          // Gather text
          const lineTokens = tokens[lineIdx];
          const phraseTokens = lineTokens.filter(t => !t.isSpace && !t.isVerseNumber && t.tokenIdx >= start && t.tokenIdx <= end);
          const phraseText = phraseTokens.map(t => t.text).join(' ');
          
          addItem({
            type: 'phrase',
            data: {
              surahNumber: 0,
              ayahNumber: 0,
              startWordIndex: start,
              endWordIndex: end,
              originalText: phraseText,
              page: page.pageNumber,
              lineIdx,
            } as TahfeezPhrase,
          });
        }
        setRangeAnchor(null);
      }
    }
  }, [selectionType, storedItems, rangeAnchor, page.pageNumber, tokens, addItem, removeItem, getItemKey, setRangeAnchor]);

  const renderedContent = useMemo(() => {
    const elements: React.ReactNode[] = [];

    for (let li = 0; li < tokens.length; li++) {
      const lineTokens = tokens[li];
      if (lineTokens.length === 1 && lineTokens[0].isHeader) {
        elements.push(
          <div key={`h-${li}`} className="surah-header">
            <span className="text-xl sm:text-2xl font-bold text-primary font-arabic">{lineTokens[0].text}</span>
          </div>
        );
        continue;
      }
      if (lineTokens.length === 1 && lineTokens[0].isBismillah) {
        elements.push(<div key={`b-${li}`} className="bismillah bismillah-compact font-arabic">{formatBismillah(lineTokens[0].text)}</div>);
        continue;
      }

      const lineElements: React.ReactNode[] = [];
      for (const tok of lineTokens) {
        if (tok.isSpace) {
          lineElements.push(<span key={`${li}-${tok.tokenIdx}`}>{tok.text}</span>);
          continue;
        }
        if (tok.isVerseNumber) {
          lineElements.push(<span key={`${li}-${tok.tokenIdx}`} className="verse-number">{tok.text}</span>);
          continue;
        }

        const stored = isTokenStored(tok.lineIdx, tok.tokenIdx, tok.text);
        const anchor = isAnchor(tok.lineIdx, tok.tokenIdx);

        lineElements.push(
          <span
            key={`${li}-${tok.tokenIdx}`}
            className={`cursor-pointer rounded-sm transition-all duration-150 ${
              anchor
                ? 'bg-amber-400/40 ring-2 ring-amber-500'
                : stored
                  ? 'bg-primary/20 ring-1 ring-primary/40'
                  : 'hover:bg-accent/40 active:bg-accent/60'
            }`}
            onClick={() => handleTokenClick(tok.lineIdx, tok.tokenIdx, tok.text)}
          >
            {tok.text}
          </span>
        );
      }

      // Bind verse numbers to preceding word
      const processedElements = bindVerseNumbersSimple(lineElements, li);
      const noJustify = shouldNoJustify(mobileLinesPerPage, desktopLinesPerPage, textAlign);
      if (isLines15) {
        elements.push(<div key={`line-${li}`} className={`quran-line${noJustify ? ' quran-line--no-justify' : ''}`}>{processedElements}</div>);
      } else {
        elements.push(<span key={`line-${li}`}>{processedElements}{' '}</span>);
      }
    }

    return isLines15 
      ? <div className="quran-lines-container">{elements}</div>
      : <div className="quran-page" style={{ textAlign: 'justify', textAlignLast: 'right' }}>{elements}</div>;
  }, [tokens, isLines15, isTokenStored, isAnchor, handleTokenClick]);

  return (
    <div className="space-y-3">
      {!hidePageBadge && (
        <>
          {/* Selection mode toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => { setSelectionType('word'); setRangeAnchor(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-arabic font-bold transition-all ${
                selectionType === 'word'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              تحديد كلمة
            </button>
            <button
              onClick={() => { setSelectionType('phrase'); setRangeAnchor(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-arabic font-bold transition-all ${
                selectionType === 'phrase'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              تحديد جملة
            </button>
          </div>

          {selectionType === 'phrase' && (
            <p className="text-[11px] font-arabic text-center text-muted-foreground">
              {rangeAnchor ? '🔵 انقر على الكلمة الأخيرة لإتمام التحديد' : 'انقر على الكلمة الأولى ثم الأخيرة'}
            </p>
          )}
        </>
      )}

      {/* Quran page for selection */}
      <div ref={autoFlowRef} className="page-frame p-4 sm:p-6" dir={textDirection} style={isAutoFlow15 ? { aspectRatio: '3 / 4.2', overflow: 'hidden' } : undefined}>
        {!hidePageBadge && (
          <div className="flex justify-center mb-5">
            <span className="bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-arabic shadow-sm">
              صفحة {page.pageNumber}
            </span>
          </div>
        )}
        <div className="quran-page min-h-[350px] sm:min-h-[450px]">
          {renderedContent}
        </div>
      </div>
    </div>
  );
}
