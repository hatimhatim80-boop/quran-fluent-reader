import React, { useMemo } from 'react';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { useSettingsStore } from '@/stores/settingsStore';
import { TahfeezWord } from '@/stores/tahfeezStore';

interface TahfeezQuizViewProps {
  page: QuranPage;
  quizSource: 'custom' | 'auto';
  selectedWords: TahfeezWord[];
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'full-ayah' | 'full-page';
  blankCount: number;
  revealedIndices: Set<string>; // "lineIdx_tokenIdx"
  timerDone: boolean;
  revealMode: 'all' | 'gradual';
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

interface TokenInfo {
  text: string;
  isSpace: boolean;
  isVerseNumber: boolean;
  lineIdx: number;
  tokenIdx: number;
  key: string; // "lineIdx_tokenIdx"
}

export function TahfeezQuizView({
  page,
  quizSource,
  selectedWords,
  autoBlankMode,
  blankCount,
  revealedIndices,
  timerDone,
  revealMode,
}: TahfeezQuizViewProps) {
  const displayMode = useSettingsStore((s) => s.settings.display?.mode || 'lines15');
  const isLines15 = displayMode === 'lines15';

  // Parse all tokens with their positions
  const { lines, allWordTokens } = useMemo(() => {
    const lines = page.text.split('\n');
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
            text: t, isSpace: false, isVerseNumber: false,
            lineIdx, tokenIdx,
            key: `${lineIdx}_${tokenIdx}`,
          });
        }
      }
    }
    return { lines, allWordTokens };
  }, [page.text]);

  // Determine blanked token keys
  const blankedKeys = useMemo((): Set<string> => {
    const keys = new Set<string>();

    if (quizSource === 'custom') {
      // Match selected words by page + normalized text + position
      for (const sw of selectedWords) {
        if (sw.page !== page.pageNumber) continue;
        // Find matching token
        for (const tok of allWordTokens) {
          if (tok.tokenIdx === sw.wordIndex && normalizeArabic(tok.text) === normalizeArabic(sw.originalWord)) {
            keys.add(tok.key);
            break;
          }
        }
      }
    } else {
      // Auto blanking - work per "ayah" (group tokens between verse numbers)
      if (autoBlankMode === 'full-page') {
        allWordTokens.forEach(t => keys.add(t.key));
      } else {
        // Group tokens into ayahs by detecting verse number boundaries
        const ayahGroups: TokenInfo[][] = [];
        let currentGroup: TokenInfo[] = [];

        const rawLines = page.text.split('\n');
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
                text: t, isSpace: false, isVerseNumber: false,
                lineIdx, tokenIdx,
                key: `${lineIdx}_${tokenIdx}`,
              });
            }
          }
        }
        if (currentGroup.length > 0) ayahGroups.push(currentGroup);

        for (const group of ayahGroups) {
          const wc = group.length;
          const n = autoBlankMode === 'full-ayah' ? wc : Math.min(blankCount, wc);
          let start = 0;
          if (autoBlankMode === 'beginning') start = 0;
          else if (autoBlankMode === 'end') start = wc - n;
          else if (autoBlankMode === 'middle') start = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
          else if (autoBlankMode === 'full-ayah') start = 0;

          for (let i = start; i < start + n && i < wc; i++) {
            keys.add(group[i].key);
          }
        }
      }
    }
    return keys;
  }, [quizSource, selectedWords, autoBlankMode, blankCount, page.pageNumber, allWordTokens, page.text]);

  // Render the full page
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
          <div key={`bismillah-${lineIdx}`} className="bismillah font-arabic">{line}</div>
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
        const isRevealed = revealedIndices.has(key);
        const showBlank = isBlanked && !isRevealed && !timerDone;
        const showRevealedStyle = isBlanked && (isRevealed || (timerDone && revealMode === 'all'));

        lineElements.push(
          <span
            key={`${lineIdx}-${tokenIdx}`}
            className="inline-block mx-px"
            style={showBlank ? { minWidth: `${Math.max(t.length * 0.7, 2)}em` } : undefined}
          >
            {showBlank ? (
              <span
                className="inline-block border-b-2 border-dashed border-primary/50 text-transparent select-none"
                style={{ minWidth: `${Math.max(t.length * 0.7, 2)}em` }}
              >
                {t}
              </span>
            ) : (
              <span className={showRevealedStyle ? 'text-primary font-bold transition-colors duration-500' : ''}>
                {t}
              </span>
            )}
          </span>
        );
      }

      if (isLines15) {
        elements.push(<div key={`line-${lineIdx}`} className="quran-line">{lineElements}</div>);
      } else {
        elements.push(<span key={`line-${lineIdx}`}>{lineElements}{' '}</span>);
      }
    }

    return <div className={isLines15 ? 'quran-lines-container' : 'inline'}>{elements}</div>;
  }, [lines, blankedKeys, revealedIndices, timerDone, revealMode, isLines15]);

  return (
    <div className="page-frame p-5 sm:p-8">
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
