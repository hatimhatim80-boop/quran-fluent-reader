import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { useSettingsStore } from '@/stores/settingsStore';
import { TahfeezItem } from '@/stores/tahfeezStore';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { computeDistributedBlanksDetailed } from '@/utils/distributedBlanking';
import { useAutoFlowFit } from '@/hooks/useAutoFlowFit';
import { redistributeLines, shouldRedistribute } from '@/utils/lineRedistributor';
import { formatBismillah, shouldNoJustify, bindVerseNumbersSimple } from '@/utils/lineTokenUtils';

/** Blank placeholder - no visible dots, just the underline */

/** Render a blank span that preserves the original word's width with a dotted line through the middle */
function BlankSpan({ word, dotScale, className, onClick, style }: {
  word: string; dotScale: number; className?: string;
  onClick?: () => void; style?: React.CSSProperties;
}) {
  return (
    <span className={className} onClick={onClick} data-blanked="true"
      style={{ ...style, cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
      {/* Invisible original word to preserve width */}
      <span style={{ visibility: 'hidden', display: 'inline-block' }} aria-hidden="true">{word}</span>
      {/* Dotted line through the middle */}
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          width: '100%',
          borderBottom: `${Math.max(1.5, 2 * dotScale)}px dotted hsl(var(--foreground) / 0.5)`,
        }} />
      </span>
    </span>
  );
}

interface InlineMCQOption {
  text: string;
  isCorrect: boolean;
}

interface TahfeezQuizViewProps {
  page: QuranPage;
  quizSource: 'custom' | 'auto';
  storedItems: TahfeezItem[];
  autoBlankMode: 'beginning' | 'middle' | 'end' | 'beginning-middle' | 'middle-end' | 'beginning-end' | 'beginning-middle-end' | 'full-ayah' | 'full-page' | 'ayah-count' | 'between-waqf' | 'waqf-to-ayah' | 'ayah-to-waqf' | 'next-ayah-mcq' | 'next-waqf-mcq';
  waqfCombinedModes: ('between-waqf' | 'waqf-to-ayah' | 'ayah-to-waqf' | 'between-ayah')[];
  /** Quiz scope - used to determine if hiding should cover all ayahs per page */
  quizScope?: 'current-page' | 'page-range' | 'hizb' | 'surah' | 'juz';
  blankCount: number;
  ayahCount: number;
  activeBlankKey: string | null;       // Currently active blank (highlighted)
  revealedKeys: Set<string>;           // Already revealed keys
  showAll: boolean;                     // Show all at once
  onClickActiveBlank?: () => void;     // Called when user taps the active mic icon
  onClickBlankWord?: (key: string) => void; // Called when user taps any blanked word to jump there
  storeMode?: boolean;                 // When true, tapping words stores them
  onStoreWord?: (lineIdx: number, tokenIdx: number, text: string) => void;
  // Inline MCQ props
  inlineMCQ?: boolean;                 // Whether to show inline MCQ at active blank
  allWordTexts?: string[];             // All word texts for generating distractors
  onInlineMCQAnswer?: (key: string, correct: boolean) => void;
  /** If provided, ONLY these keys are blanked (overrides autoBlankMode computation) */
  forceBlankedKeys?: string[];
  /** Stable ayah IDs to blank (preferred over indices in review mode) */
  forceAyahIds?: string[];
  /** If provided, ONLY these ayah group indices are blanked (overrides autoBlankMode computation) */
  forceAyahIndices?: number[];
  /** Stable ayah IDs already revealed — triggers ayah-revealed highlight */
  revealedAyahIds?: string[];
}

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  const normalized = normalizeArabic(line);
  return normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله');
}

const WAQF_TEST = /[ۖۗۘۙۚۛ]/;
const CLEAN_REGEX = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

interface TokenInfo {
  text: string;
  lineIdx: number;
  tokenIdx: number;
  key: string;
  hasWaqf: boolean;
  waqfMark: string;
}

type BlankingGenerationPath =
  | 'forceAyahIds'
  | 'forceAyahIndices'
  | 'forceBlankedKeys'
  | 'custom-items'
  | 'distributed-ayah-count'
  | 'full-page'
  | 'waqf-combined'
  | 'legacy-auto-mode';

export function TahfeezQuizView({
  page,
  quizSource,
  storedItems,
  autoBlankMode,
  waqfCombinedModes,
  quizScope,
  blankCount,
  ayahCount,
  activeBlankKey,
  revealedKeys,
  showAll,
  onClickActiveBlank,
  onClickBlankWord,
  storeMode,
  onStoreWord,
  inlineMCQ,
  allWordTexts,
  onInlineMCQAnswer,
  forceBlankedKeys,
  forceAyahIds,
  forceAyahIndices,
  revealedAyahIds,
}: TahfeezQuizViewProps) {
  const { dotScale } = useTahfeezStore();
  const waqfDisplayMode = useTahfeezStore(s => s.waqfDisplayMode);
  const { settings } = useSettingsStore();
  const revealedColor = useTahfeezStore(s => s.revealedColor);
  const revealedAyahColor = useTahfeezStore(s => s.revealedAyahColor);
  const revealedAyahStyle = useTahfeezStore(s => s.revealedAyahStyle);
  const revealedWithBg = useTahfeezStore(s => s.revealedWithBg);
  const activeWordColor = useTahfeezStore(s => s.activeWordColor);
  const reviewMode = useTahfeezStore(s => s.reviewMode);
  const hiddenAyatCount = useTahfeezStore(s => s.hiddenAyatCount);
  const hiddenWordsCount = useTahfeezStore(s => s.hiddenWordsCount);
  const distributionMode = useTahfeezStore(s => s.distributionMode);
  const distributionSeed = useTahfeezStore(s => s.distributionSeed);
  const hiddenWordsMode = useTahfeezStore(s => s.hiddenWordsMode);
  const hiddenWordsPercentage = useTahfeezStore(s => s.hiddenWordsPercentage);
  const percentageScope = useTahfeezStore(s => s.percentageScope);
  const wordSequenceMode = useTahfeezStore(s => s.wordSequenceMode);
  const wordBlankPosition = useTahfeezStore(s => s.wordBlankPosition);
  const displayMode = settings.display?.mode || 'auto15';
  const textDirection = settings.display?.textDirection || 'rtl';
  const mobileLinesPerPage = settings.display?.mobileLinesPerPage || 15;
  const desktopLinesPerPage = settings.display?.desktopLinesPerPage || 15;
  const textAlign = settings.display?.textAlign || 'justify';
  const minWordsPerLine = settings.display?.minWordsPerLine || 5;
  const isAutoFlow15 = false;
  const isLines15 = false;
  const pageBackgroundColor = (settings.colors as any).pageBackgroundColor || '';
  const pageFrameStyle = pageBackgroundColor ? { background: `hsl(${pageBackgroundColor})` } : undefined;
  
  const balanceLastLine = useSettingsStore((s) => s.settings.display?.balanceLastLine ?? false);
  const fontFamilyCSS = (() => {
    const fontMap: Record<string, string> = {
      amiri: "'Amiri', serif", amiriQuran: "'Amiri Quran', serif",
      notoNaskh: "'Noto Naskh Arabic', serif", scheherazade: "'Scheherazade New', serif",
      uthman: "'KFGQPC HAFS Uthmanic Script', serif", uthmanicHafs: "'UthmanicHafs', serif",
      uthmanicHafs22: "'UthmanicHafs22', serif", hafsNastaleeq: "'HafsNastaleeq', serif",
      meQuran: "'me_quran', serif", qalam: "'Al Qalam Quran', serif",
      custom: settings.fonts.customFontFamily ? `'${settings.fonts.customFontFamily}', serif` : "'Amiri', serif",
    };
    return fontMap[settings.fonts.fontFamily] || fontMap.uthman;
  })();
  const { containerRef: autoFlowRef, fittedFontSize: autoFlowFontSize } = useAutoFlowFit(
    page.text, fontFamilyCSS, settings.fonts.fontWeight, settings.fonts.lineHeight, 15, isAutoFlow15, undefined
  );

  // Redistribute lines based on device
  const effectiveText = useMemo(() => {
    if (!shouldRedistribute(mobileLinesPerPage, desktopLinesPerPage, balanceLastLine)) return page.text;
    const originalLines = page.text.split('\n');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetLines = isMobile ? mobileLinesPerPage : desktopLinesPerPage;
    return redistributeLines(originalLines, targetLines, minWordsPerLine, balanceLastLine).join('\n');
  }, [page.text, displayMode, mobileLinesPerPage, desktopLinesPerPage, minWordsPerLine, balanceLastLine]);

  // Parse all word tokens (excluding headers, bismillah-as-separator, spaces, verse numbers)
  // Exception: page 1 (Al-Fatiha) — bismillah IS the first ayah and must be tokenized.
  const isFatihaPage = page.pageNumber === 1;
  // Combined tokenization: lines + allWordTokens + ayahGroups (single source of truth)
  const { lines, allWordTokens, ayahGroups } = useMemo(() => {
    const lines = effectiveText.split('\n');
    const ayahGroups: TokenInfo[][] = [];

    if (isFatihaPage) {
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        if (isSurahHeader(line)) continue;
        const tokens = line.split(/(\s+)/);
        const lineGroup: TokenInfo[] = [];
        for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
          const t = tokens[tokenIdx];
          if (/^\s+$/.test(t)) continue;
          const clean = t.replace(CLEAN_REGEX, '').trim();
          if (/^[٠-٩0-9۰-۹]+$/.test(clean)) continue;
          if (clean.length === 0) continue; // skip standalone waqf/decorative marks
          const wm = t.match(WAQF_TEST);
          lineGroup.push({
            text: t, lineIdx, tokenIdx,
            key: `${lineIdx}_${tokenIdx}`,
            hasWaqf: !!wm, waqfMark: wm ? wm[0] : '',
          });
        }
        if (lineGroup.length > 0) ayahGroups.push(lineGroup);
      }
    } else {
      let currentGroup: TokenInfo[] = [];
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        if (isSurahHeader(line) || isBismillah(line)) continue;
        const tokens = line.split(/(\s+)/);
        for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
          const t = tokens[tokenIdx];
          if (/^\s+$/.test(t)) continue;
          const clean = t.replace(CLEAN_REGEX, '').trim();
          const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(clean);
          if (isVerseNumber) {
            if (currentGroup.length > 0) { ayahGroups.push(currentGroup); currentGroup = []; }
            continue;
          }
          if (clean.length === 0) continue; // skip standalone waqf/decorative marks
          const wm = t.match(WAQF_TEST);
          currentGroup.push({
            text: t, lineIdx, tokenIdx,
            key: `${lineIdx}_${tokenIdx}`,
            hasWaqf: !!wm, waqfMark: wm ? wm[0] : '',
          });
        }
      }
      if (currentGroup.length > 0) ayahGroups.push(currentGroup);
    }

    return { lines, allWordTokens: ayahGroups.flat(), ayahGroups };
  }, [effectiveText]);

  // Build stable ayah entity metadata (stable ID per ayah group)
  const ayahEntityMeta = useMemo(() => {
    const keyToAyahId = new Map<string, string>();
    const ayahIdToKeys = new Map<string, string[]>();
    ayahGroups.forEach((group, ayahIndex) => {
      const ayahId = `ayah_${page.pageNumber}_${ayahIndex}`;
      const keys = group.map((token) => token.key);
      ayahIdToKeys.set(ayahId, keys);
      keys.forEach((key) => keyToAyahId.set(key, ayahId));
    });
    if (import.meta.env.DEV) console.log('[tahfeez][ayahMeta] page:', page.pageNumber, 'ayahGroups:', ayahGroups.length, 'stableIds:', [...ayahIdToKeys.keys()]);
    return { keyToAyahId, ayahIdToKeys };
  }, [ayahGroups, page.pageNumber]);

  // Determine which keys should be blanked (uses precomputed ayahGroups)
  const blankingComputation = useMemo(() => {
    // Stable ayah ID-based blanking (preferred for SRS review)
    if (forceAyahIds && forceAyahIds.length > 0) {
      const keys = new Set<string>();
      forceAyahIds.forEach((ayahId) => {
        const mappedKeys = ayahEntityMeta.ayahIdToKeys.get(ayahId);
        if (import.meta.env.DEV) console.log('[tahfeez][blanking] forceAyahId:', ayahId, '→ keys:', mappedKeys?.length ?? 0, mappedKeys ? `[${mappedKeys.slice(0, 3).join(',')}...]` : '(not found)');
        mappedKeys?.forEach((key) => keys.add(key));
      });
      if (keys.size === 0) {
        if (import.meta.env.DEV) console.warn('[tahfeez][blanking] forceAyahIds provided but no keys matched! ayahIds:', forceAyahIds, 'available:', [...ayahEntityMeta.ayahIdToKeys.keys()]);
      }
      return {
        keys,
        generationPath: 'forceAyahIds' as BlankingGenerationPath,
        distributedStats: null,
      };
    }

    if (forceAyahIndices && forceAyahIndices.length > 0) {
      const keys = new Set<string>();
      forceAyahIndices.forEach((ayahIndex) => {
        const group = ayahGroups[ayahIndex];
        if (!group) return;
        group.forEach((token) => keys.add(token.key));
      });
      return {
        keys,
        generationPath: 'forceAyahIndices' as BlankingGenerationPath,
        distributedStats: null,
      };
    }

    // If forceBlankedKeys is provided, use it directly (for SRS word-level review)
    if (forceBlankedKeys && forceBlankedKeys.length > 0) {
      const keys = new Set(forceBlankedKeys);
      return {
        keys,
        generationPath: 'forceBlankedKeys' as BlankingGenerationPath,
        distributedStats: null,
      };
    }

    const keys = new Set<string>();
    let generationPath: BlankingGenerationPath = 'legacy-auto-mode';
    let distributedStats: { actualSelectedAyatCount: number; actualSelectedWordCount: number; sampleSelectedKeys: string[] } | null = null;

    if (quizSource === 'custom') {
      generationPath = 'custom-items';
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
      if (autoBlankMode === 'ayah-count' || autoBlankMode === 'full-ayah') {
        // full-ayah: hide one complete ayah only
        // ayah-count: use hiddenAyatCount, but if scope is multi-page (hizb/juz/surah), hide all ayahs per page
        const isMultiPageScope = quizScope === 'hizb' || quizScope === 'juz' || quizScope === 'surah';
        const effectiveAyatCount = autoBlankMode === 'full-ayah'
          ? 1
          : isMultiPageScope
            ? ayahGroups.length
            : hiddenAyatCount;

        generationPath = 'distributed-ayah-count';
        const distributed = computeDistributedBlanksDetailed({
          // Enforce strict mode separation: word-only → no ayahs; ayah-only → no words
          reviewMode,
          distributionMode,
          hiddenAyatCount: reviewMode === 'word' ? 0 : hiddenAyatCount,
          hiddenWordsCount: hiddenWordsCount,
          seed: distributionSeed + page.pageNumber,
          ayahGroups,
          allWordTokens,
          hiddenWordsMode,
          hiddenWordsPercentage,
          percentageScope,
          wordSequenceMode,
          wordBlankPosition,
        });
        distributedStats = {
          actualSelectedAyatCount: distributed.selectedAyatCount,
          actualSelectedWordCount: distributed.selectedWordCount,
          sampleSelectedKeys: distributed.sampleSelectedKeys,
        };
        for (const k of distributed.keys) keys.add(k);
      } else if (autoBlankMode === 'full-page') {
        generationPath = 'full-page';
        allWordTokens.forEach(t => keys.add(t.key));
      } else if (waqfCombinedModes.length > 0) {
        generationPath = 'waqf-combined';
        // Waqf-based blanking modes (can combine multiple)
        const shouldKeepWaqfWord = waqfDisplayMode === 'with-word';

        for (const group of ayahGroups) {
          const waqfIndices: number[] = [];
          for (let i = 0; i < group.length; i++) {
            if (group[i].hasWaqf) waqfIndices.push(i);
          }

          // In 'with-word' mode, waqf-bearing words are NOT blanked
          const isProtected = (i: number) => shouldKeepWaqfWord && group[i].hasWaqf;

          if (waqfCombinedModes.includes('between-waqf')) {
            if (waqfIndices.length >= 2) {
              for (let w = 0; w < waqfIndices.length - 1; w++) {
                for (let i = waqfIndices[w] + 1; i < waqfIndices[w + 1]; i++) {
                  if (!isProtected(i)) keys.add(group[i].key);
                }
              }
            } else if (waqfIndices.length === 1) {
              for (let i = waqfIndices[0] + 1; i < group.length; i++) {
                if (!isProtected(i)) keys.add(group[i].key);
              }
            }
          }

          if (waqfCombinedModes.includes('waqf-to-ayah')) {
            if (waqfIndices.length > 0) {
              const lastWaqf = waqfIndices[waqfIndices.length - 1];
              for (let i = lastWaqf + 1; i < group.length; i++) {
                if (!isProtected(i)) keys.add(group[i].key);
              }
            }
          }

          if (waqfCombinedModes.includes('ayah-to-waqf')) {
            if (waqfIndices.length > 0) {
              const firstWaqf = waqfIndices[0];
              for (let i = 0; i < firstWaqf; i++) {
                if (!isProtected(i)) keys.add(group[i].key);
              }
            }
          }

          if (waqfCombinedModes.includes('between-ayah')) {
            // Blank all words between verse boundaries (entire ayah content)
            for (let i = 0; i < group.length; i++) {
              if (!isProtected(i)) keys.add(group[i].key);
            }
          }
        }
      } else {
        for (const group of ayahGroups) {
          const wc = group.length;

          if (autoBlankMode === 'beginning' || autoBlankMode === 'middle' || autoBlankMode === 'end') {
            const n = Math.min(blankCount, wc);
            let start = 0;
            if (autoBlankMode === 'beginning') start = 0;
            else if (autoBlankMode === 'end') start = wc - n;
            else if (autoBlankMode === 'middle') start = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
            for (let i = start; i < start + n && i < wc; i++) {
              keys.add(group[i].key);
            }
          } else if (autoBlankMode === 'beginning-middle-end') {
            const n = Math.min(blankCount, Math.floor(wc / 3));
            for (let i = 0; i < n && i < wc; i++) keys.add(group[i].key);
            const midStart = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
            for (let i = midStart; i < midStart + n && i < wc; i++) keys.add(group[i].key);
            for (let i = Math.max(0, wc - n); i < wc; i++) keys.add(group[i].key);
          } else {
            const n = Math.min(blankCount, Math.floor(wc / 2));
            if (autoBlankMode === 'beginning-middle') {
              for (let i = 0; i < n && i < wc; i++) keys.add(group[i].key);
              const midStart = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
              for (let i = midStart; i < midStart + n && i < wc; i++) keys.add(group[i].key);
            } else if (autoBlankMode === 'middle-end') {
              const midStart = Math.max(0, Math.floor(wc / 2) - Math.floor(n / 2));
              for (let i = midStart; i < midStart + n && i < wc; i++) keys.add(group[i].key);
              for (let i = Math.max(0, wc - n); i < wc; i++) keys.add(group[i].key);
            } else if (autoBlankMode === 'beginning-end') {
              for (let i = 0; i < n && i < wc; i++) keys.add(group[i].key);
              for (let i = Math.max(0, wc - n); i < wc; i++) keys.add(group[i].key);
            }
          }
        }
      }
    }

    return { keys, generationPath, distributedStats };
  }, [quizSource, storedItems, autoBlankMode, blankCount, ayahCount, page.pageNumber, allWordTokens, ayahGroups, waqfCombinedModes, waqfDisplayMode, forceBlankedKeys, forceAyahIds, forceAyahIndices, reviewMode, hiddenAyatCount, hiddenWordsCount, distributionMode, distributionSeed, hiddenWordsMode, hiddenWordsPercentage, percentageScope, wordSequenceMode, wordBlankPosition, quizScope, ayahEntityMeta]);
  const blankedKeys = blankingComputation.keys;

  // Build set of keys whose ayah has been revealed (for ayah-level highlight)
  const revealedAyahKeySet = useMemo(() => {
    const keys = new Set<string>();
    (revealedAyahIds || []).forEach((ayahId) => {
      const mappedKeys = ayahEntityMeta.ayahIdToKeys.get(ayahId);
      if (import.meta.env.DEV) console.log('[tahfeez][reveal] revealedAyahId:', ayahId, '→ highlight keys:', mappedKeys?.length ?? 0);
      mappedKeys?.forEach((key) => keys.add(key));
    });
    if (import.meta.env.DEV && revealedAyahIds && revealedAyahIds.length > 0 && keys.size === 0) {
      console.warn('[tahfeez][reveal] revealedAyahIds provided but no keys matched!', revealedAyahIds);
    }
    return keys;
  }, [revealedAyahIds, ayahEntityMeta]);

  // Export blanked keys list (ordered) for parent to use in sequencing
  // This is used by the parent component via a ref or callback
  // Compute first keys per ayah group (for per-ayah first-word timer)
  const { blankedKeysList, firstKeysSet } = useMemo(() => {
    const orderedKeys = allWordTokens.filter(t => blankedKeys.has(t.key)).map(t => t.key);

    const firstKeys = new Set<string>();
    if (quizSource === 'custom') {
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
      // Use precomputed ayahGroups
      for (const group of ayahGroups) {
        let prevWasBlanked = false;
        for (const t of group) {
          const isBlanked = blankedKeys.has(t.key);
          if (isBlanked && !prevWasBlanked) firstKeys.add(t.key);
          prevWasBlanked = isBlanked;
        }
      }
    }

    return { blankedKeysList: orderedKeys, firstKeysSet: firstKeys };
  }, [allWordTokens, blankedKeys, quizSource, storedItems, page.pageNumber, ayahGroups]);

  // Attach to DOM for parent to read
  // Also export word texts mapped by key for voice recognition
  const blankedWordTexts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tok of allWordTokens) {
      if (blankedKeys.has(tok.key)) {
        map[tok.key] = tok.text;
      }
    }
    return map;
  }, [allWordTokens, blankedKeys]);

  // Compute reveal groups: ayah-based and waqf-based
  const revealKeyGroups = useMemo(() => {
    const ayahRevealGroups: string[][] = [];
    const waqfGroups: string[][] = [];

    // Build ayah groups (only blanked keys)
    for (const group of ayahGroups) {
      const blankedInGroup = group.filter(t => blankedKeys.has(t.key)).map(t => t.key);
      if (blankedInGroup.length > 0) ayahRevealGroups.push(blankedInGroup);
    }

    // Build waqf groups: include the waqf-bearing word in its segment
    for (const group of ayahGroups) {
      const waqfIndices = group.reduce((acc: number[], t, i) => t.hasWaqf ? [...acc, i] : acc, []);
      const boundaries = [-1, ...waqfIndices, group.length];
      for (let b = 0; b < boundaries.length - 1; b++) {
        const start = boundaries[b] + 1;
        // Include waqf word in the segment it terminates (not the final group.length boundary)
        const end = b < boundaries.length - 2 ? boundaries[b + 1] + 1 : boundaries[b + 1];
        const segment = group.slice(start, end).filter(t => blankedKeys.has(t.key)).map(t => t.key);
        if (segment.length > 0) waqfGroups.push(segment);
      }
    }

    return { ayahGroups: ayahRevealGroups, waqfGroups };
  }, [ayahGroups, blankedKeys]);

  React.useEffect(() => {
    const el = document.getElementById('tahfeez-blanked-keys');
    if (el) {
      el.setAttribute('data-keys', JSON.stringify(blankedKeysList));
      el.setAttribute('data-first-keys', JSON.stringify([...firstKeysSet]));
      el.setAttribute('data-word-texts', JSON.stringify(blankedWordTexts));
      el.setAttribute('data-page', String(page.pageNumber));
      el.setAttribute('data-ayah-groups', JSON.stringify(revealKeyGroups.ayahGroups));
      el.setAttribute('data-waqf-groups', JSON.stringify(revealKeyGroups.waqfGroups));
      el.setAttribute('data-generation-path', blankingComputation.generationPath);
      el.setAttribute('data-review-mode', reviewMode);
      el.setAttribute(
        'data-actual-selected-ayat',
        String(
          blankingComputation.generationPath === 'distributed-ayah-count' && blankingComputation.distributedStats
            ? blankingComputation.distributedStats.actualSelectedAyatCount
            : 0
        )
      );
      el.setAttribute(
        'data-actual-selected-words',
        String(
          blankingComputation.generationPath === 'distributed-ayah-count' && blankingComputation.distributedStats
            ? blankingComputation.distributedStats.actualSelectedWordCount
            : 0
        )
      );
    }
  }, [blankedKeysList, firstKeysSet, blankedWordTexts, revealKeyGroups, page.pageNumber, blankingComputation, reviewMode]);


  // Build font string for measuring
  const fontSize = autoFlowFontSize || settings.fonts.quranFontSize || 28;
  const fontWeight = settings.fonts.fontWeight || 400;

  // Inline MCQ: generate options for the active blank
  const [inlineMCQFeedback, setInlineMCQFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [inlineMCQSelected, setInlineMCQSelected] = useState<number | null>(null);

  // Reset inline MCQ state when active key changes
  useEffect(() => {
    setInlineMCQFeedback(null);
    setInlineMCQSelected(null);
  }, [activeBlankKey]);

  const inlineMCQOptions: InlineMCQOption[] = useMemo(() => {
    if (!inlineMCQ || !activeBlankKey || !allWordTexts) return [];
    const correctText = blankedWordTexts[activeBlankKey] || '';
    if (!correctText) return [];
    const correctNorm = normalizeArabic(correctText, 'aggressive');
    const candidates = allWordTexts.filter(t => {
      const norm = normalizeArabic(t, 'aggressive');
      return norm !== correctNorm && t !== correctText && norm.length > 0;
    });
    const unique = [...new Set(candidates)];
    // Shuffle and pick 2 distractors
    const shuffled = [...unique].sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, 2);
    while (distractors.length < 2) distractors.push('ـــ');
    const opts: InlineMCQOption[] = [
      { text: correctText, isCorrect: true },
      ...distractors.map(d => ({ text: d, isCorrect: false })),
    ];
    // Shuffle options
    return opts.sort(() => Math.random() - 0.5);
  }, [inlineMCQ, activeBlankKey, allWordTexts, blankedWordTexts]);

  const handleInlineMCQChoice = useCallback((idx: number, opt: InlineMCQOption) => {
    if (inlineMCQFeedback) return;
    setInlineMCQSelected(idx);
    setInlineMCQFeedback(opt.isCorrect ? 'correct' : 'wrong');
    setTimeout(() => {
      if (activeBlankKey && onInlineMCQAnswer) {
        onInlineMCQAnswer(activeBlankKey, opt.isCorrect);
      }
    }, opt.isCorrect ? 400 : 800);
  }, [activeBlankKey, inlineMCQFeedback, onInlineMCQAnswer]);

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
      // In Al-Fatiha (page 1), bismillah is verse 1 — render as tokenizable line, not header.
      // In all other pages, bismillah is a chapter separator and rendered as a visual header.
      if (isBismillah(line) && !isFatihaPage) {
        elements.push(
          <div key={`bismillah-${lineIdx}`} className="bismillah bismillah-compact font-arabic" style={{ display: 'block', textAlign: 'center', textAlignLast: 'center' }}>{formatBismillah(line)}</div>
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
        const isAyahRevealed = revealedAyahKeySet.has(key);

        // Determine display state
        const shouldHide = isBlanked && !isRevealed && !isAyahRevealed && !showAll && !isActive;
        const shouldShowAsActive = isBlanked && isActive && !isRevealed && !isAyahRevealed && !showAll;
        const shouldShowAsRevealedAyah = isBlanked && isAyahRevealed && !isActive;
        const shouldShowAsRevealed = isBlanked && (isRevealed || showAll) && !isAyahRevealed;

        // Check if this word is already stored (for store mode visual feedback)
        const isStored = storeMode && storedItems.some(item => {
          if (item.data.page !== page.pageNumber) return false;
          if (item.type === 'word') {
            const w = item.data;
            return w.wordIndex === tokenIdx && w.originalWord === t && (w.lineIdx === undefined || w.lineIdx === lineIdx);
          }
          return false;
        });

        const storeClickHandler = storeMode && onStoreWord ? () => onStoreWord(lineIdx, tokenIdx, t) : undefined;

        // ── Inline style maps for revealed states (bypass CSS specificity issues) ──
        const REVEALED_AYAH_COLORS: Record<string, { color: string; bg: string }> = {
          green:   { color: 'hsl(140 55% 35%)', bg: 'hsl(140 55% 35% / 0.18)' },
          blue:    { color: 'hsl(210 70% 40%)', bg: 'hsl(210 70% 40% / 0.18)' },
          orange:  { color: 'hsl(30 80% 38%)',  bg: 'hsl(30 80% 38% / 0.18)' },
          purple:  { color: 'hsl(270 60% 42%)', bg: 'hsl(270 60% 42% / 0.18)' },
          primary: { color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.18)' },
        };
        const REVEALED_WORD_COLORS: Record<string, { color: string; bg: string }> = {
          green:   { color: 'hsl(140 55% 35%)', bg: 'hsl(140 50% 90%)' },
          blue:    { color: 'hsl(210 70% 35%)', bg: 'hsl(210 60% 90%)' },
          orange:  { color: 'hsl(30 80% 35%)',  bg: 'hsl(30 70% 90%)' },
          purple:  { color: 'hsl(270 60% 40%)', bg: 'hsl(270 50% 92%)' },
          primary: { color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.15)' },
        };

        if (shouldHide) {
          const blankClickHandler = !storeMode && onClickBlankWord ? () => onClickBlankWord(key) : storeClickHandler;
          // Separate waqf mark from word if waqfDisplayMode is 'sign-only'
          const tokenWaqfMatch = t.match(WAQF_TEST);
          if (tokenWaqfMatch && waqfDisplayMode === 'sign-only') {
            const wordPart = t.replace(WAQF_TEST, '').trim() || t;
            lineElements.push(
              <React.Fragment key={`${lineIdx}-${tokenIdx}`}>
                <BlankSpan word={wordPart} dotScale={dotScale}
                  className={`tahfeez-blank${storeMode ? ' tahfeez-store-target' : ''}${isStored ? ' tahfeez-stored' : ''}`}
                  onClick={blankClickHandler} />
                <span style={{ opacity: 0.7 }}>{tokenWaqfMatch[0]}</span>
              </React.Fragment>
            );
          } else {
            lineElements.push(
              <BlankSpan key={`${lineIdx}-${tokenIdx}`} word={t} dotScale={dotScale}
                className={`tahfeez-blank${storeMode ? ' tahfeez-store-target' : ''}${isStored ? ' tahfeez-stored' : ''}`}
                onClick={blankClickHandler} />
            );
          }
        } else if (shouldShowAsActive) {
          if (inlineMCQ && inlineMCQOptions.length > 0) {
            // Inline MCQ: show a vertical list of choices at the blank position
            lineElements.push(
              <span key={`${lineIdx}-${tokenIdx}`} className="tahfeez-inline-mcq-wrapper" data-tahfeez-active="true"
                style={{ display: 'inline-block', verticalAlign: 'top', position: 'relative' }}>
                <span className="tahfeez-inline-mcq-list" style={{
                  display: 'inline-flex', flexDirection: 'column', gap: '4px',
                  padding: '4px 6px', borderRadius: '8px',
                  background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                  boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)',
                }}>
                  {inlineMCQOptions.map((opt, oi) => {
                    let bg = 'transparent';
                    let color = 'inherit';
                    let borderColor = 'hsl(var(--border))';
                    if (inlineMCQFeedback) {
                      if (opt.isCorrect) { bg = 'hsl(140 60% 40% / 0.15)'; borderColor = 'hsl(140 60% 40%)'; color = 'hsl(140 60% 30%)'; }
                      else if (oi === inlineMCQSelected && !opt.isCorrect) { bg = 'hsl(0 70% 45% / 0.15)'; borderColor = 'hsl(0 70% 45%)'; color = 'hsl(0 70% 40%)'; }
                    }
                    return (
                      <span key={oi} onClick={() => handleInlineMCQChoice(oi, opt)}
                        className="font-arabic"
                        style={{
                          display: 'block', padding: '3px 10px', borderRadius: '6px',
                          border: `1px solid ${borderColor}`, background: bg, color,
                          cursor: inlineMCQFeedback ? 'default' : 'pointer',
                          fontSize: `${Math.max(14, fontSize * 0.6)}px`, lineHeight: '1.5',
                          textAlign: 'center', whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease',
                        }}>
                        {opt.text}
                      </span>
                    );
                  })}
                </span>
              </span>
            );
          } else {
            // Normal active: show dotted line with pulsing glow
            const tokenWaqfMatch2 = t.match(WAQF_TEST);
            if (tokenWaqfMatch2 && waqfDisplayMode === 'sign-only') {
              const wordPart = t.replace(WAQF_TEST, '').trim() || t;
              lineElements.push(
                <React.Fragment key={`${lineIdx}-${tokenIdx}`}>
                  <BlankSpan word={wordPart} dotScale={dotScale}
                    className={`tahfeez-active-indicator tahfeez-active--${activeWordColor}`}
                    onClick={storeMode ? storeClickHandler : onClickActiveBlank}
                    style={{ '--tahfeez-active': 'true' } as React.CSSProperties} />
                  <span style={{ opacity: 0.7 }}>{tokenWaqfMatch2[0]}</span>
                </React.Fragment>
              );
            } else {
              lineElements.push(
                <BlankSpan key={`${lineIdx}-${tokenIdx}`} word={t} dotScale={dotScale}
                  className={`tahfeez-active-indicator tahfeez-active--${activeWordColor}`}
                  onClick={storeMode ? storeClickHandler : onClickActiveBlank}
                  style={{ '--tahfeez-active': 'true' } as React.CSSProperties} />
              );
            }
          }
        } else if (shouldShowAsRevealedAyah) {
          // Ayah-level revealed highlight — inline styles to guarantee visibility
          const ayahPalette = REVEALED_AYAH_COLORS[revealedAyahColor] || REVEALED_AYAH_COLORS.green;
          const ayahInline: React.CSSProperties = {
            display: 'inline-block',
            color: ayahPalette.color,
            fontWeight: 700,
            transition: 'all 0.35s ease',
            ...(storeMode ? { cursor: 'pointer' } : {}),
          };
          if (revealedAyahStyle === 'background') {
            ayahInline.background = ayahPalette.bg;
            ayahInline.borderRadius = '0.45rem';
            ayahInline.paddingInline = '0.12em';
          } else if (revealedAyahStyle === 'border') {
            ayahInline.borderRadius = '0.45rem';
            ayahInline.paddingInline = '0.12em';
            ayahInline.boxShadow = `inset 0 -2px 0 ${ayahPalette.color}, 0 0 0 1px hsl(var(--foreground) / 0.08)`;
          }
          lineElements.push(
            <span
              key={`${lineIdx}-${tokenIdx}`}
              data-revealed-ayah="true"
              className={`${storeMode ? 'tahfeez-store-target' : ''}${isStored ? ' tahfeez-stored' : ''}`}
              onClick={storeClickHandler}
              style={ayahInline}
            >
              {t}
            </span>
          );
        } else if (shouldShowAsRevealed) {
          // Word-level revealed — inline styles to guarantee visibility
          const wordPalette = REVEALED_WORD_COLORS[revealedColor] || REVEALED_WORD_COLORS.green;
          const wordInline: React.CSSProperties = {
            display: 'inline-block',
            color: wordPalette.color,
            fontWeight: 600,
            transition: 'all 0.4s ease',
            ...(storeMode ? { cursor: 'pointer' } : {}),
          };
          if (revealedWithBg) {
            wordInline.background = wordPalette.bg;
            wordInline.borderRadius = '4px';
            wordInline.padding = '0 3px';
            wordInline.margin = '0 -3px';
          }
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`}
              data-revealed-word="true"
              className={`${storeMode ? 'tahfeez-store-target' : ''}${isStored ? ' tahfeez-stored' : ''}`}
              onClick={storeClickHandler} style={wordInline}>{t}</span>
          );
        } else {
          lineElements.push(
            <span key={`${lineIdx}-${tokenIdx}`} className={`${storeMode ? 'tahfeez-store-target' : ''}${isStored ? ' tahfeez-stored' : ''}`}
              onClick={storeClickHandler} style={storeMode ? { cursor: 'pointer' } : undefined}>{t}</span>
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
      : <div className="quran-page">{elements}</div>;
  }, [lines, blankedKeys, activeBlankKey, revealedKeys, revealedAyahKeySet, showAll, isLines15, storeMode, storedItems, onStoreWord, page.pageNumber, inlineMCQ, inlineMCQOptions, inlineMCQFeedback, inlineMCQSelected, revealedAyahColor, revealedAyahStyle, revealedColor, revealedWithBg]);


  // Auto-scroll active blank into view (centered in scroll container)
  useEffect(() => {
    if (!activeBlankKey) return;
    const doScroll = () => {
      const el = document.querySelector<HTMLElement>('[data-tahfeez-active="true"]');
      if (!el) return;

      let scrollParent: HTMLElement | null = el.parentElement;
      while (scrollParent) {
        const style = getComputedStyle(scrollParent);
        if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') break;
        scrollParent = scrollParent.parentElement;
      }

      if (!scrollParent) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        return;
      }

      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const idealCenter = parentRect.height * 0.4;
      const relativeTop = elRect.top - parentRect.top;
      if (relativeTop < 0 || relativeTop > parentRect.height * 0.75) {
        const nextTop = scrollParent.scrollTop + relativeTop - idealCenter + (elRect.height / 2);
        scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      }
    };
    const t1 = setTimeout(doScroll, 150);
    const t2 = setTimeout(doScroll, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activeBlankKey]);

  // Debug info: compute actual blanked ayah and word counts
  const debugInfo = useMemo(() => {
    if (quizSource !== 'auto') return null;

    // Fallback counts based on visible blanked keys
    let blankedAyahCount = 0;
    let blankedWordCount = 0;
    for (const group of ayahGroups) {
      const allBlanked = group.length > 0 && group.every(t => blankedKeys.has(t.key));
      if (allBlanked) blankedAyahCount++;
    }
    for (const t of allWordTokens) {
      if (blankedKeys.has(t.key)) blankedWordCount++;
    }

    const actualSelectedAyatCount =
      blankingComputation.generationPath === 'distributed-ayah-count' && blankingComputation.distributedStats
        ? blankingComputation.distributedStats.actualSelectedAyatCount
        : blankedAyahCount;
    const actualSelectedWordCount =
      blankingComputation.generationPath === 'distributed-ayah-count' && blankingComputation.distributedStats
        ? blankingComputation.distributedStats.actualSelectedWordCount
        : blankedWordCount;
    const sampleSelectedKeys =
      blankingComputation.generationPath === 'distributed-ayah-count' && blankingComputation.distributedStats
        ? blankingComputation.distributedStats.sampleSelectedKeys
        : Array.from(blankedKeys).slice(0, 10);

    return {
      generationPath: blankingComputation.generationPath,
      reviewMode,
      hiddenAyatCount,
      hiddenWordsMode,
      hiddenWordsCount,
      hiddenWordsPercentage,
      distributionMode,
      requestedAyat: 0,
      actualSelectedAyat: actualSelectedAyatCount,
      requestedWords: hiddenWordsMode === 'percentage' ? `${hiddenWordsPercentage}%` : hiddenWordsCount,
      actualSelectedWords: actualSelectedWordCount,
      sampleSelectedKeys,
    };
  }, [blankedKeys, ayahGroups, allWordTokens, reviewMode, hiddenAyatCount, hiddenWordsCount, hiddenWordsMode, hiddenWordsPercentage, distributionMode, quizSource, blankingComputation]);

  useEffect(() => {
    if (!debugInfo) return;
    console.debug('[tahfeez][blanking-debug]', {
      page: page.pageNumber,
      reviewMode: debugInfo.reviewMode,
      hiddenAyatCount: debugInfo.hiddenAyatCount,
      hiddenWordsMode: debugInfo.hiddenWordsMode,
      hiddenWordsCount: debugInfo.hiddenWordsCount,
      hiddenWordsPercentage: debugInfo.hiddenWordsPercentage,
      distributionMode: debugInfo.distributionMode,
      actualSelectedAyatCount: debugInfo.actualSelectedAyat,
      actualSelectedWordCount: debugInfo.actualSelectedWords,
      sampleSelectedKeys: debugInfo.sampleSelectedKeys,
      generationPath: debugInfo.generationPath,
    });
  }, [debugInfo, page.pageNumber]);

  return (
    <div ref={autoFlowRef} className="page-frame p-4 sm:p-6" style={{ ...pageFrameStyle, ...(isAutoFlow15 ? { aspectRatio: '3 / 4.2', overflow: 'hidden' } : {}) }} dir={textDirection}>
      <div id="tahfeez-blanked-keys" className="hidden" />
      {/* Debug panel removed — data retained in console only */}
      <div className="flex justify-center mb-5">
        <span className="bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-arabic shadow-sm">
          صفحة {page.pageNumber}
        </span>
      </div>
      <div className="min-h-[350px] sm:min-h-[450px]">
        {renderedContent}
      </div>
    </div>
  );
}
