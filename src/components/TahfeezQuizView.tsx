import React, { useMemo } from 'react';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { useSettingsStore } from '@/stores/settingsStore';
import { TahfeezItem } from '@/stores/tahfeezStore';
import { useAutoFitFont } from '@/hooks/useAutoFitFont';
import { redistributeLines, shouldRedistribute } from '@/utils/lineRedistributor';
import { formatBismillah, shouldNoJustify, bindVerseNumbersSimple } from '@/utils/lineTokenUtils';

interface TahfeezQuizViewProps {
  page: QuranPage;
  quizSource: 'custom' | 'auto';
  storedItems: TahfeezItem[];
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'beginning-middle' | 'middle-end' | 'beginning-end' | 'full-ayah' | 'full-page' | 'ayah-count';
  blankCount: number;
  ayahCount: number;
  activeBlankKey: string | null;       // Currently active blank (highlighted)
  revealedKeys: Set<string>;           // Already revealed keys
  showAll: boolean;                     // Show all at once
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

interface TokenInfo {
  text: string;
  lineIdx: number;
  tokenIdx: number;
  key: string;
}

export function TahfeezQuizView({
  page,
  quizSource,
  storedItems,
  autoBlankMode,
  blankCount,
  ayahCount,
  activeBlankKey,
  revealedKeys,
  showAll,
}: TahfeezQuizViewProps) {
  const { settings } = useSettingsStore();
  const displayMode = settings.display?.mode || 'auto15';
  const textDirection = settings.display?.textDirection || 'rtl';
  const mobileLinesPerPage = settings.display?.mobileLinesPerPage || 15;
  const desktopLinesPerPage = settings.display?.desktopLinesPerPage || 15;
  const textAlign = settings.display?.textAlign || 'justify';
  const minWordsPerLine = settings.display?.minWordsPerLine || 5;
  const isLines15 = false;
  const pageBackgroundColor = (settings.colors as any).pageBackgroundColor || '';
  const pageFrameStyle = pageBackgroundColor ? { background: `hsl(${pageBackgroundColor})` } : undefined;
  const highlightStyle = (settings.colors as any).highlightStyle || 'background';
  const balanceLastLine = useSettingsStore((s) => s.settings.display?.balanceLastLine ?? false);
  const { containerRef: autoFitRef, fittedFontSize } = useAutoFitFont(page.text);

  // Redistribute lines based on device
  const effectiveText = useMemo(() => {
    if (!shouldRedistribute(mobileLinesPerPage, desktopLinesPerPage, balanceLastLine)) return page.text;
    const originalLines = page.text.split('\n');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetLines = isMobile ? mobileLinesPerPage : desktopLinesPerPage;
    return redistributeLines(originalLines, targetLines, minWordsPerLine, balanceLastLine).join('\n');
  }, [page.text, displayMode, mobileLinesPerPage, desktopLinesPerPage, minWordsPerLine, balanceLastLine]);

  // Parse all word tokens (excluding headers, bismillah, spaces, verse numbers)
  const { lines, allWordTokens } = useMemo(() => {
    const lines = effectiveText.split('\n');
    const allWordTokens: TokenInfo[] = [];
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (isSurahHeader(line) || isBismillah(line)) continue;
      const tokens = line.split(/(\s+)/);
      for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
        const t = tokens[tokenIdx];
        const isSpace = /^\s+$/.test(t);
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(clean);
        if (!isSpace && !isVerseNumber) {
          allWordTokens.push({
            text: t,
            lineIdx,
            tokenIdx,
            key: `${lineIdx}_${tokenIdx}`,
          });
        }
      }
    }
    return { lines, allWordTokens };
  }, [effectiveText]);

  // Determine which keys should be blanked
  const blankedKeys = useMemo((): Set<string> => {
    const keys = new Set<string>();

    if (quizSource === 'custom') {
      for (const item of storedItems) {
        if (item.data.page !== page.pageNumber) continue;
        if (item.type === 'word') {
          const sw = item.data;
          for (const tok of allWordTokens) {
            if (tok.tokenIdx === sw.wordIndex && normalizeArabic(tok.text) === normalizeArabic(sw.originalWord)) {
              keys.add(tok.key);
              break;
            }
          }
        } else {
          const p = item.data;
          for (const tok of allWordTokens) {
            if (tok.lineIdx === p.lineIdx && tok.tokenIdx >= p.startWordIndex && tok.tokenIdx <= p.endWordIndex) {
              keys.add(tok.key);
            }
          }
        }
      }
    } else {
      // Auto blanking
      if (autoBlankMode === 'full-page') {
        allWordTokens.forEach(t => keys.add(t.key));
      } else {
        // Group tokens into ayahs by verse numbers
        const ayahGroups: TokenInfo[][] = [];
        let currentGroup: TokenInfo[] = [];
        const rawLines = effectiveText.split('\n');
        for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
          const line = rawLines[lineIdx];
          if (isSurahHeader(line) || isBismillah(line)) continue;
          const tokens = line.split(/(\s+)/);
          for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
            const t = tokens[tokenIdx];
            const isSpace = /^\s+$/.test(t);
            const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
            const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(clean);
            if (isSpace) continue;
            if (isVerseNumber) {
              if (currentGroup.length > 0) {
                ayahGroups.push(currentGroup);
                currentGroup = [];
              }
            } else {
              currentGroup.push({
                text: t, lineIdx, tokenIdx, key: `${lineIdx}_${tokenIdx}`,
              });
            }
          }
        }
        if (currentGroup.length > 0) ayahGroups.push(currentGroup);

        if (autoBlankMode === 'ayah-count') {
          const count = Math.min(ayahCount, ayahGroups.length);
          for (let a = 0; a < count; a++) {
            ayahGroups[a].forEach(t => keys.add(t.key));
          }
        } else {
          for (const group of ayahGroups) {
            const wc = group.length;
            const isFullAyah = autoBlankMode === 'full-ayah';

            if (isFullAyah) {
              group.forEach(t => keys.add(t.key));
            } else if (autoBlankMode === 'beginning' || autoBlankMode === 'middle' || autoBlankMode === 'end') {
              const n = Math.min(blankCount, wc);
              let start = 0;
              if (autoBlankMode === 'beginning') start = 0;
              else if (autoBlankMode === 'end') start = wc - n;
              else if (autoBlankMode === 'middle') start = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
              for (let i = start; i < start + n && i < wc; i++) {
                keys.add(group[i].key);
              }
            } else {
              // Combined modes: beginning-middle, middle-end, beginning-end
              const n = Math.min(blankCount, Math.floor(wc / 2));
              if (autoBlankMode === 'beginning-middle') {
                // Beginning
                for (let i = 0; i < n && i < wc; i++) keys.add(group[i].key);
                // Middle
                const midStart = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
                for (let i = midStart; i < midStart + n && i < wc; i++) keys.add(group[i].key);
              } else if (autoBlankMode === 'middle-end') {
                // Middle
                const midStart = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
                for (let i = midStart; i < midStart + n && i < wc; i++) keys.add(group[i].key);
                // End
                for (let i = Math.max(0, wc - n); i < wc; i++) keys.add(group[i].key);
              } else if (autoBlankMode === 'beginning-end') {
                // Beginning
                for (let i = 0; i < n && i < wc; i++) keys.add(group[i].key);
                // End
                for (let i = Math.max(0, wc - n); i < wc; i++) keys.add(group[i].key);
              }
            }
          }
        }
      }
    }
    return keys;
  }, [quizSource, storedItems, autoBlankMode, blankCount, ayahCount, page.pageNumber, allWordTokens, effectiveText]);

  // Export blanked keys list (ordered) for parent to use in sequencing
  // This is used by the parent component via a ref or callback
  // Compute first keys per ayah group (for per-ayah first-word timer)
  const { blankedKeysList, firstKeysSet } = useMemo(() => {
    const orderedKeys = allWordTokens.filter(t => blankedKeys.has(t.key)).map(t => t.key);
    
    // Find first blanked key per ayah group
    const firstKeys = new Set<string>();
    if (quizSource === 'custom') {
      // For custom: first key of each stored item
      for (const item of storedItems) {
        if (item.data.page !== page.pageNumber) continue;
        if (item.type === 'word') {
          const sw = item.data;
          for (const tok of allWordTokens) {
            if (tok.tokenIdx === sw.wordIndex && blankedKeys.has(tok.key)) {
              firstKeys.add(tok.key);
              break;
            }
          }
        } else {
          const p = item.data;
          for (const tok of allWordTokens) {
            if (tok.lineIdx === p.lineIdx && tok.tokenIdx >= p.startWordIndex && tok.tokenIdx <= p.endWordIndex && blankedKeys.has(tok.key)) {
              firstKeys.add(tok.key);
              break;
            }
          }
        }
      }
    } else {
      // For auto: find first blanked key of each contiguous blank group within each ayah
      const rawLines = effectiveText.split('\n');
      let currentGroup: TokenInfo[] = [];
      const groups: TokenInfo[][] = [];
      for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
        const line = rawLines[lineIdx];
        if (isSurahHeader(line) || isBismillah(line)) continue;
        const tokens = line.split(/(\s+)/);
        for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
          const t = tokens[tokenIdx];
          const isSpace = /^\s+$/.test(t);
          const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
          const isVerseNumber = !isSpace && /^[٠-٩0-9۰-۹]+$/.test(clean);
          if (isSpace) continue;
          if (isVerseNumber) {
            if (currentGroup.length > 0) { groups.push(currentGroup); currentGroup = []; }
          } else {
            currentGroup.push({ text: t, lineIdx, tokenIdx, key: `${lineIdx}_${tokenIdx}` });
          }
        }
      }
      if (currentGroup.length > 0) groups.push(currentGroup);
      
      // For each ayah group, find first key of each contiguous blank sequence
      for (const group of groups) {
        let prevWasBlanked = false;
        for (const t of group) {
          const isBlanked = blankedKeys.has(t.key);
          if (isBlanked && !prevWasBlanked) {
            // Start of a new contiguous blank group
            firstKeys.add(t.key);
          }
          prevWasBlanked = isBlanked;
        }
      }
    }
    
    return { blankedKeysList: orderedKeys, firstKeysSet: firstKeys };
  }, [allWordTokens, blankedKeys, quizSource, storedItems, page.pageNumber, effectiveText]);

  // Attach to DOM for parent to read
  React.useEffect(() => {
    const el = document.getElementById('tahfeez-blanked-keys');
    if (el) {
      el.setAttribute('data-keys', JSON.stringify(blankedKeysList));
      el.setAttribute('data-first-keys', JSON.stringify([...firstKeysSet]));
    }
  }, [blankedKeysList, firstKeysSet]);


  // Render
  const renderedContent = useMemo(() => {
    const elements: React.ReactNode[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      if (isSurahHeader(line)) {
        elements.push(
          <div key={`header-${lineIdx}`} className="surah-header">
            <span className="text-xl sm:text-2xl font-bold text-primary font-arabic">{line}</span>
          </div>
        );
        continue;
      }
      if (isBismillah(line)) {
        elements.push(
          <div key={`bismillah-${lineIdx}`} className="bismillah bismillah-compact font-arabic">{formatBismillah(line)}</div>
        );
        continue;
      }

      const tokens = line.split(/(\s+)/);
      const lineElements: React.ReactNode[] = [];

      for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
        const t = tokens[tokenIdx];
        const isSpace = /^\s+$/.test(t);
        if (isSpace) {
          lineElements.push(<span key={`${lineIdx}-${tokenIdx}`}>{t}</span>);
          continue;
        }
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(clean);
        if (isVerseNumber) {
          lineElements.push(<span key={`${lineIdx}-${tokenIdx}`} className="verse-number">{t}</span>);
          continue;
        }

        const key = `${lineIdx}_${tokenIdx}`;
        const isBlanked = blankedKeys.has(key);
        const isActive = activeBlankKey === key;
        const isRevealed = revealedKeys.has(key);

        // Determine display state
        const shouldHide = isBlanked && !isRevealed && !showAll && !isActive;
        const shouldShowAsActive = isBlanked && isActive && !isRevealed && !showAll;
        const shouldShowAsRevealed = isBlanked && (isRevealed || showAll);

        if (shouldHide) {
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`} className="tahfeez-blank">{t}</span>
          );
        } else if (shouldShowAsActive) {
          const activeClass = highlightStyle === 'text-only' ? 'tahfeez-active-blank--text-only' : 'tahfeez-active-blank';
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`} className={activeClass}>{t}</span>
          );
        } else if (shouldShowAsRevealed) {
          const revealedClass = highlightStyle === 'text-only' ? 'tahfeez-revealed--text-only' : 'tahfeez-revealed';
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`} className={revealedClass}>{t}</span>
          );
        } else {
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`}>{t}</span>
          );
        }
      }

      // Bind verse numbers to preceding word
      const processedElements = bindVerseNumbersSimple(lineElements, lineIdx);
      const noJustify = shouldNoJustify(mobileLinesPerPage, desktopLinesPerPage, textAlign);
      if (isLines15) {
        elements.push(<div key={`line-${lineIdx}`} className={`quran-line${noJustify ? ' quran-line--no-justify' : ''}`}>{processedElements}</div>);
      } else {
        elements.push(<span key={`line-${lineIdx}`}>{processedElements}{' '}</span>);
      }
    }

    return isLines15 
      ? <div className="quran-lines-container">{elements}</div>
      : <div className="quran-page" style={{ textAlign: 'justify', textAlignLast: 'right' }}>{elements}</div>;
  }, [lines, blankedKeys, activeBlankKey, revealedKeys, showAll, isLines15]);


  return (
    <div ref={autoFitRef} className="page-frame p-4 sm:p-8" style={{ ...pageFrameStyle, ...(fittedFontSize ? { fontSize: `${fittedFontSize}rem` } : {}) }} dir={textDirection}>
      <div id="tahfeez-blanked-keys" className="hidden" />
      <div className="flex justify-center mb-5">
        <span className="bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-arabic shadow-sm">
          صفحة {page.pageNumber}
        </span>
      </div>
      <div className="quran-page min-h-[350px] sm:min-h-[450px]">
        {renderedContent}
      </div>
    </div>
  );
}
