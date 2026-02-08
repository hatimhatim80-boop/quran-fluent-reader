import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDevDebugContextStore } from '@/stores/devDebugContextStore';
import { DevDebugPanel, dispatchWordInspection, DevInspectWordDetail } from '@/components/DevDebugPanel';
import { useDiagnosticModeStore } from '@/stores/diagnosticModeStore';

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Get closest element with word data - supports BOTH highlighted and non-highlighted words.
 * Priority: data-ghareeb-key (highlighted) > data-word-inspectable (any word with position)
 */
function getClosestWordEl(target: EventTarget | null): HTMLElement | null {
  if (!target) return null;

  // event.target can be a Text node.
  const el: Element | null =
    target instanceof Element
      ? target
      : (target as any)?.parentElement instanceof Element
        ? (target as any).parentElement
        : null;

  if (!el) return null;
  
  // First try highlighted word
  const ghareebEl = el.closest?.('[data-ghareeb-key]') as HTMLElement | null;
  if (ghareebEl) return ghareebEl;
  
  // Then try any inspectable word (non-highlighted)
  const inspectableEl = el.closest?.('[data-word-inspectable]') as HTMLElement | null;
  return inspectableEl;
}

function toInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function DevDebugOverlay() {
  // Show overlay if EITHER: diagnostic mode is enabled OR we're in dev environment
  const isDiagnosticEnabled = useDiagnosticModeStore((s) => s.isEnabled);
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldShow = isDiagnosticEnabled || isDev;

  const context = useDevDebugContextStore((s) => s.context);
  const [mappingVersionId, setMappingVersionId] = useState<string>('map-loading');

  // Cache a fast lookup for inspected word hydration
  const wordByKey = useMemo(() => {
    const map = new Map<string, { wordText: string; meaning: string; surahNumber: number; verseNumber: number; wordIndex: number }>();
    if (!context) return map;

    for (const w of context.ghareebWords) {
      map.set(w.uniqueKey, {
        wordText: w.wordText,
        meaning: w.meaning,
        surahNumber: w.surahNumber,
        verseNumber: w.verseNumber,
        wordIndex: w.wordIndex,
      });
    }
    for (const w of context.renderedWords) {
      if (!map.has(w.uniqueKey)) {
        map.set(w.uniqueKey, {
          wordText: w.wordText,
          meaning: w.meaning,
          surahNumber: w.surahNumber,
          verseNumber: w.verseNumber,
          wordIndex: w.wordIndex,
        });
      }
    }

    return map;
  }, [context]);

  // Load mapping version id once (small file)
  useEffect(() => {
    if (!shouldShow) return;

    let cancelled = false;

    fetch('/data/page-mapping.json')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (cancelled) return;
        setMappingVersionId(`map-${shortHash(text.slice(0, 800))}`);
      })
      .catch(() => {
        if (cancelled) return;
        setMappingVersionId('map-unknown');
      });

    return () => {
      cancelled = true;
    };
  }, [shouldShow]);

  // GLOBAL (app-wide) selection wiring
  const longPressTimerRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldShow) return;

    const dispatchFromEl = (el: HTMLElement, source: string) => {
      // Check for highlighted word first
      const ghareebKey = el.dataset.ghareebKey;
      
      // For non-highlighted words, build a position-based key
      const pageNum = context?.pageNumber || 0;
      const lineIdx = toInt(el.dataset.lineIndex) ?? toInt(el.dataset.wordLine) ?? 0;
      const tokenIdx = toInt(el.dataset.tokenIndex) ?? toInt(el.dataset.wordToken) ?? 0;
      const positionKey = `${pageNum}_${lineIdx}_${tokenIdx}`;
      
      // Determine if this is a highlighted (ghareeb) word
      const isHighlighted = !!ghareebKey;
      
      // Use ghareeb key if available, otherwise position key
      const key = ghareebKey || positionKey;

      // Prevent hover spam
      if (source === 'hover' && lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      const fromMap = ghareebKey ? wordByKey.get(ghareebKey) : undefined;
      const domWord = (el.textContent || '').trim();

      const originalWord = fromMap?.wordText || domWord || key;
      const meaning = fromMap?.meaning || '';
      
      // Extract surah/verse info from data attributes or from map
      const surahNumber = fromMap?.surahNumber ?? toInt(el.dataset.surahNumber) ?? 0;
      const verseNumber = fromMap?.verseNumber ?? toInt(el.dataset.verse) ?? 0;
      const wordIndex = fromMap?.wordIndex ?? toInt(el.dataset.wordIndex) ?? 0;

      const detail: DevInspectWordDetail = {
        uniqueKey: key,
        originalWord,
        surahNumber,
        verseNumber,
        wordIndex,
        meaning,
        tokenIndex: toInt(el.dataset.ghareebIndex) ?? tokenIdx,
        assemblyId: el.dataset.assemblyId,
        matchedMeaningId: ghareebKey || null,
        meaningPreview: meaning ? meaning.slice(0, 60) + (meaning.length > 60 ? '...' : '') : '',
        selectionSource: source,
        // NEW: Include position data for override system
        isHighlighted,
        positionKey,
        lineIndex: lineIdx,
        pageNumber: pageNum,
      };
      
      dispatchWordInspection(detail);
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = getClosestWordEl(e.target);
      if (!el) return;
      dispatchFromEl(el, 'pointerdown');

      if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        dispatchFromEl(el, 'long-press');
      }, 500);
    };

    const clearLongPress = () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = getClosestWordEl(e.target);
      if (!el) return;
      dispatchFromEl(el, 'click');
    };

    const onPointerOver = (e: PointerEvent) => {
      // Desktop-friendly hover
      if (e.pointerType !== 'mouse') return;
      const el = getClosestWordEl(e.target);
      if (!el) return;
      dispatchFromEl(el, 'hover');
    };

    // Capture phase so React stopPropagation can't block inspection.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', clearLongPress, true);
    document.addEventListener('pointercancel', clearLongPress, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerover', onPointerOver, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', clearLongPress, true);
      document.removeEventListener('pointercancel', clearLongPress, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onPointerOver, true);
    };
  }, [shouldShow, wordByKey, context?.pageNumber]);

  if (!shouldShow || !context) return null;

  return (
    <div className="fixed top-3 right-3 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        <DevDebugPanel
          page={context.page}
          pageNumber={context.pageNumber}
          ghareebWords={context.ghareebWords}
          renderedWords={context.renderedWords}
          onInvalidateCache={context.invalidateCache}
          mappingVersionId={mappingVersionId}
          allPages={context.allPages}
          ghareebPageMap={context.ghareebPageMap}
          onNavigateToPage={context.onNavigateToPage}
        />
      </div>
    </div>
  );
}
