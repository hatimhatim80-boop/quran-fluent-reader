import React, { useState, useMemo, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import { ensureGhareebMeaningVisibleAboveBottomBar } from '@/utils/ghareebAutoScroll';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { ReviewSessionSetup } from './ReviewSessionSetup';
import { Button } from '@/components/ui/button';
import { GhareebWord } from '@/types/quran';
import { Plus, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settingsStore';
import { canonicalize } from '@/utils/canonicalMatch';

interface GhareebSRSPanelProps {
  pageWords: GhareebWord[];
  allWords: GhareebWord[];
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  renderPageWithHighlight: (page: number, wordKey: string | null, highlightStyle: 'color' | 'bg' | 'border') => React.ReactNode;
}

export function GhareebSRSPanel({
  pageWords,
  allWords,
  currentPage,
  onNavigateToPage,
  renderPageWithHighlight,
}: GhareebSRSPanelProps) {
  const { addCard, hasCard, cards, exportData, importData, clearAll } = useSRSStore();
  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionName, setSessionName] = useState<string>('');
  const [highlightStyle] = useState<'color' | 'bg' | 'border'>('color');

  const totalCards = cards.filter(c => c.type === 'ghareeb').length;

  const addWordsAsCards = useCallback((words: GhareebWord[]) => {
    let added = 0;
    words.forEach((w) => {
      const id = `ghareeb_${w.uniqueKey}`;
      if (!hasCard(id)) {
        addCard({
          id,
          type: 'ghareeb',
          page: w.pageNumber,
          contentKey: w.uniqueKey,
          label: `${w.wordText} — ${w.meaning}`,
          meta: {
            wordText: w.wordText,
            meaning: w.meaning,
            surahName: w.surahName,
            surahNumber: w.surahNumber,
            verseNumber: w.verseNumber,
          },
        });
        added += 1;
      }
    });
    return added;
  }, [addCard, hasCard]);

  const addPageWords = useCallback(() => {
    const added = addWordsAsCards(pageWords);
    if (added > 0) toast.success(`تمت إضافة ${added} كلمة للمراجعة`);
    else toast.info('جميع الكلمات مضافة بالفعل');
  }, [pageWords, addWordsAsCards]);

  const handleAutoGenerate = useCallback((pages: number[]) => {
    const pageSet = new Set(pages);
    const words = allWords.filter(w => pageSet.has(w.pageNumber));
    return addWordsAsCards(words);
  }, [allWords, addWordsAsCards]);

  const handleStartSession = useCallback((cards: SRSCard[], sid: string, name: string) => {
    setSessionCards(cards);
    setSessionId(sid);
    setSessionName(name);
    setSessionMode('review');
  }, []);

  const resolveHighlightKey = useCallback((card: SRSCard) => {
    if (allWords.some((word) => word.uniqueKey === card.contentKey)) return card.contentKey;

    const surahNumber = Number(card.meta?.surahNumber || 0);
    const verseNumber = Number(card.meta?.verseNumber || 0);
    const cardWord = canonicalize(String(card.meta?.wordText || ''));
    const candidate = allWords.find((word) => {
      if (word.pageNumber !== card.page) return false;
      if (surahNumber && word.surahNumber !== surahNumber) return false;
      if (verseNumber && word.verseNumber !== verseNumber) return false;
      return canonicalize(word.wordText) === cardWord;
    });

    return candidate?.uniqueKey ?? card.contentKey;
  }, [allWords]);

  const handleExport = useCallback(() => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `srs-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم التصدير');
  }, [exportData]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (importData(text)) toast.success('تم الاستيراد بنجاح');
      else toast.error('فشل الاستيراد');
    };
    input.click();
  }, [importData]);

  if (sessionMode === 'review') {
    return (
      <SRSReviewSession
        cards={sessionCards}
        sessionId={sessionId}
        sessionName={sessionName}
        onFinish={() => setSessionMode('setup')}
        onNavigateToPage={onNavigateToPage}
        portalName="الغريب"
        defaultAnswerMode="tooltip"
        answerModeOptions={['tooltip', 'inline']}
        focusMode
        renderCard={(card, answerRevealed, answerDisplayMode) => (
          <GhareebReviewCardContent
            card={card}
            answerRevealed={answerRevealed}
            answerDisplayMode={answerDisplayMode}
            highlightStyle={highlightStyle}
            activeContentKey={resolveHighlightKey(card)}
            renderPageWithHighlight={renderPageWithHighlight}
          />
        )}
      />
    );
  }

  return (
    <ReviewSessionSetup
      portal="ghareeb"
      currentPage={currentPage}
      onStartSession={handleStartSession}
      cardTypeFilter="ghareeb"
      onAutoGenerateCards={handleAutoGenerate}
      headerContent={
        <div className="space-y-2">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{totalCards}</p>
              <p className="text-xs text-muted-foreground">إجمالي البطاقات</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{pageWords.length}</p>
              <p className="text-xs text-muted-foreground">كلمات الصفحة</p>
            </div>
          </div>

          <Button onClick={addPageWords} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" />
            إضافة كلمات الصفحة الحالية ({pageWords.length} كلمة)
          </Button>

          {/* Import/Export */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleExport}>
              <Download className="w-3 h-3" /> تصدير
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleImport}>
              <Upload className="w-3 h-3" /> استيراد
            </Button>
            {totalCards > 0 && (
              <Button variant="outline" size="sm" className="gap-1 font-arabic text-xs text-destructive" onClick={() => {
                if (confirm('هل تريد حذف جميع البطاقات؟')) { clearAll(); toast.success('تم الحذف'); }
              }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}

// ── Review card content with auto-scroll ─────────────────────────────────────

function GhareebReviewCardContent({
  card,
  answerRevealed,
  answerDisplayMode,
  highlightStyle,
  activeContentKey,
  renderPageWithHighlight,
}: {
  card: SRSCard;
  answerRevealed: boolean;
  answerDisplayMode: string;
  highlightStyle: 'color' | 'bg' | 'border';
  activeContentKey: string;
  renderPageWithHighlight: (page: number, wordKey: string | null, style: 'color' | 'bg' | 'border') => React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Unified auto-scroll: only when word/meaning hidden behind bottom bar
  const doScrollCheck = useCallback(() => {
    if (!rootRef.current) return;
    const wordEl = rootRef.current.querySelector<HTMLElement>(`[data-ghareeb-key="${activeContentKey}"]`);
    const meaningEl = rootRef.current.querySelector<HTMLElement>(
      '[data-ghareeb-tooltip="true"], .ghareeb-inline-answer, .ghareeb-popover'
    );
    ensureGhareebMeaningVisibleAboveBottomBar(wordEl, meaningEl, activeContentKey);
  }, [activeContentKey]);

  // Auto-scroll to highlighted word on card change
  useEffect(() => {
    const timer = setTimeout(() => requestAnimationFrame(doScrollCheck), 250);
    return () => clearTimeout(timer);
  }, [activeContentKey, card.id, doScrollCheck]);

  // Auto-scroll when answer is revealed
  useEffect(() => {
    if (!answerRevealed) return;
    const t1 = setTimeout(() => requestAnimationFrame(doScrollCheck), 200);
    const t2 = setTimeout(() => requestAnimationFrame(doScrollCheck), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [answerRevealed, doScrollCheck]);

  // Re-check on resize/orientation change
  useEffect(() => {
    const handler = () => requestAnimationFrame(doScrollCheck);
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [doScrollCheck]);

  return (
    <div ref={rootRef} className="p-2 pb-32 relative" data-ghareeb-review-root="true">
      {renderPageWithHighlight(card.page, activeContentKey, highlightStyle)}
      {/* Tooltip answer anchored near the word */}
      {answerRevealed && answerDisplayMode === 'tooltip' && (
        <AnchoredGhareebTooltip
          visible
          contentKey={activeContentKey}
          wordText={String(card.meta.wordText || '')}
          meaning={String(card.meta.meaning || '')}
          surahName={String(card.meta.surahName || '')}
          verseNumber={Number(card.meta.verseNumber || 0)}
          rootRef={rootRef}
        />
      )}
      {/* Inline answer */}
      {answerRevealed && answerDisplayMode === 'inline' && (
        <InlineGhareebAnswer card={card} />
      )}
    </div>
  );
}

function InlineGhareebAnswer({ card }: { card: SRSCard }) {
  const { settings } = useSettingsStore();
  const popover = settings.popover || { padding: 12, borderRadius: 12, opacity: 100, shadow: 'medium' };
  const colors = settings.colors;
  const mb = settings.meaningBox || { wordFontSize: 1.4, meaningFontSize: 1.1 };
  const wordColor = colors.popoverWordColor || '25 30% 18%';
  const meaningColor = colors.popoverMeaningColor || '25 20% 35%';
  const shadowMap: Record<string, string> = { none: 'none', soft: '0 2px 8px rgba(0,0,0,0.08)', medium: '0 4px 16px rgba(0,0,0,0.12)', strong: '0 8px 30px rgba(0,0,0,0.18)' };

  return (
    <div
      className="mt-2 mx-auto max-w-md text-center animate-fade-in"
      dir="rtl"
      style={{
        padding: popover.padding,
        borderRadius: popover.borderRadius,
        opacity: (popover.opacity ?? 100) / 100,
        background: `hsl(${colors.popoverBackground || '38 50% 97%'})`,
        borderColor: `hsl(${colors.popoverBorder || '35 25% 88%'})`,
        borderWidth: '1px',
        borderStyle: 'solid',
        boxShadow: shadowMap[popover.shadow] || shadowMap.medium,
      }}
    >
      <p className="font-arabic font-bold" style={{ color: `hsl(${wordColor})`, fontSize: `${mb.wordFontSize}rem` }}>{card.meta.wordText as string}</p>
      <p className="font-arabic mt-1" style={{ color: `hsl(${meaningColor})`, fontSize: `${mb.meaningFontSize}rem` }}>{card.meta.meaning as string}</p>
    </div>
  );
}

// ── Tooltip anchored near the word ─────────────

function AnchoredGhareebTooltip({
  visible,
  contentKey,
  wordText,
  meaning,
  surahName,
  verseNumber,
  rootRef,
}: {
  visible: boolean;
  contentKey: string;
  wordText: string;
  meaning: string;
  surahName: string;
  verseNumber: number;
  rootRef: React.RefObject<HTMLDivElement>;
}) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const { settings } = useSettingsStore();
  const popover = settings.popover || { width: 240, padding: 16, borderRadius: 12, shadow: 'medium', opacity: 100 };
  const colors = settings.colors;
  const mb = settings.meaningBox || { wordFontSize: 1.4, meaningFontSize: 1.1 };
  const wordColor = colors.popoverWordColor || '25 30% 18%';
  const meaningColor = colors.popoverMeaningColor || '25 20% 35%';
  const tooltipWidth = popover.width || 240;

  useLayoutEffect(() => {
    if (!visible) { setStyle(null); return; }

    const updatePosition = () => {
      const root = rootRef.current;
      if (!root) return;
      const wordEl = root.querySelector<HTMLElement>(`[data-ghareeb-key="${contentKey}"]`);
      if (!wordEl) {
        setStyle({ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 50 });
        return;
      }

      const rootRect = root.getBoundingClientRect();
      const wordRect = wordEl.getBoundingClientRect();
      let top = wordRect.bottom - rootRect.top + 8;
      let left = wordRect.left - rootRect.left + wordRect.width / 2 - tooltipWidth / 2;
      left = Math.max(8, Math.min(left, rootRect.width - tooltipWidth - 8));
      if (top + 100 > rootRect.height) {
        top = wordRect.top - rootRect.top - 100;
      }

      setStyle({ position: 'absolute', top, left, zIndex: 50 });

      // Auto-scroll tooltip into view, accounting for bottom bar
      const scrollContainer = root.closest<HTMLElement>('[data-review-scroll-container="true"]');
      if (scrollContainer) {
        const scRect = scrollContainer.getBoundingClientRect();
        // Find bottom bar height
        const parent = scrollContainer.parentElement;
        let bottomBarH = 120;
        if (parent) {
          const children = parent.children;
          let h = 0;
          for (let i = children.length - 1; i >= 0; i--) {
            if (children[i] === scrollContainer) break;
            h += (children[i] as HTMLElement).getBoundingClientRect().height;
          }
          bottomBarH = Math.max(h, 80);
        }
        const visibleBottom = scRect.bottom - bottomBarH;
        const tooltipBottom = wordRect.bottom + 120; // estimate tooltip height
        if (tooltipBottom > visibleBottom || wordRect.top < scRect.top + 20) {
          const idealCenter = scRect.height * 0.35;
          const nextTop = scrollContainer.scrollTop + (wordRect.top - scRect.top) - idealCenter;
          scrollContainer.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        }
      }
    };

    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [visible, contentKey, rootRef, tooltipWidth]);

  if (!visible || !style) return null;

  const shadowMap: Record<string, string> = {
    none: 'none', soft: '0 2px 8px rgba(0,0,0,0.08)',
    medium: '0 4px 16px rgba(0,0,0,0.12)', strong: '0 8px 30px rgba(0,0,0,0.18)',
  };

  return (
    <div
      style={{
        ...style,
        width: tooltipWidth,
        padding: popover.padding,
        borderRadius: popover.borderRadius,
        opacity: (popover.opacity ?? 100) / 100,
        background: `hsl(${colors.popoverBackground || '38 50% 97%'})`,
        borderColor: `hsl(${colors.popoverBorder || '35 25% 88%'})`,
        borderWidth: '2px',
        borderStyle: 'solid',
        boxShadow: shadowMap[popover.shadow] || shadowMap.medium,
      }}
      className="text-center animate-fade-in"
      dir="rtl"
      data-ghareeb-tooltip="true"
    >
      <p className="font-arabic font-bold" style={{ color: `hsl(${wordColor})`, fontSize: `${mb.wordFontSize}rem` }}>{wordText}</p>
      <p className="font-arabic mt-1" style={{ color: `hsl(${meaningColor})`, fontSize: `${mb.meaningFontSize}rem` }}>{meaning}</p>
      <p className="text-xs text-muted-foreground mt-1 font-arabic">{surahName} — آية {verseNumber}</p>
    </div>
  );
}
