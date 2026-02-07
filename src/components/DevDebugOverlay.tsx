import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDevDebugContextStore } from '@/stores/devDebugContextStore';
import { DevDebugPanel, dispatchWordInspection } from '@/components/DevDebugPanel';

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

function getClosestGhareebEl(target: EventTarget | null): HTMLElement | null {
  if (!target) return null;

  // event.target can be a Text node.
  const el: Element | null =
    target instanceof Element
      ? target
      : (target as any)?.parentElement instanceof Element
        ? (target as any).parentElement
        : null;

  if (!el) return null;
  return (el.closest?.('[data-ghareeb-key]') as HTMLElement | null) ?? null;
}

function toInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function DevDebugOverlay() {
  const isProd = process.env.NODE_ENV === 'production';

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
    if (isProd) return;

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
  }, [isProd]);

  // GLOBAL (app-wide) selection wiring
  const longPressTimerRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isProd) return;

    const dispatchFromEl = (el: HTMLElement, source: string) => {
      const key = el.dataset.ghareebKey;
      if (!key) return;

      // Prevent hover spam
      if (source === 'hover' && lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      const fromMap = wordByKey.get(key);
      const domWord = (el.textContent || '').trim();

      const originalWord = fromMap?.wordText || domWord || key;
      const meaning = fromMap?.meaning || '';

      dispatchWordInspection({
        uniqueKey: key,
        originalWord,
        surahNumber: fromMap?.surahNumber ?? toInt(el.dataset.surahNumber) ?? 0,
        verseNumber: fromMap?.verseNumber ?? toInt(el.dataset.verse) ?? 0,
        wordIndex: fromMap?.wordIndex ?? toInt(el.dataset.wordIndex) ?? 0,
        meaning,
        tokenIndex: toInt(el.dataset.ghareebIndex),
        assemblyId: el.dataset.assemblyId,
        matchedMeaningId: key,
        meaningPreview: meaning ? meaning.slice(0, 60) + (meaning.length > 60 ? '...' : '') : '',
        selectionSource: source,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = getClosestGhareebEl(e.target);
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
      const el = getClosestGhareebEl(e.target);
      if (!el) return;
      dispatchFromEl(el, 'click');
    };

    const onPointerOver = (e: PointerEvent) => {
      // Desktop-friendly hover
      if (e.pointerType !== 'mouse') return;
      const el = getClosestGhareebEl(e.target);
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
  }, [isProd, wordByKey]);

  if (isProd || !context) return null;

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
        />
      </div>
    </div>
  );
}
