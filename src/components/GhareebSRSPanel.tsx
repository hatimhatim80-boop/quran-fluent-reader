import React, { useState, useMemo, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GhareebWord } from '@/types/quran';
import { Plus, RotateCcw, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { GhareebReviewSettingsPanel } from './GhareebReviewSettingsPanel';
import { useSettingsStore } from '@/stores/settingsStore';

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
  const { addCard, hasCard, getDueCards, getCardsByPages, cards, exportData, importData, clearAll, getFlaggedCards } = useSRSStore();
  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionSize, setSessionSize] = useState<string>('all');
  const [scope, setScope] = useState<SRSScope>({ type: 'all-due', from: currentPage, to: currentPage });
  const [highlightStyle, setHighlightStyle] = useState<'color' | 'bg' | 'border'>('color');
  const [reviewSource, setReviewSource] = useState<'due' | 'all'>('all');
  const [wordDistribution, setWordDistribution] = useState<'sequential' | 'by-ayah'>('sequential');

  const scopePages = useMemo(() => scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from }), [scope, currentPage]);
  const scopeWords = useMemo(() => {
    if (!scopePages || scopePages.length === 0) return [];
    const pageSet = new Set(scopePages);
    return allWords.filter((w) => pageSet.has(w.pageNumber));
  }, [allWords, scopePages]);

  const dueCards = useMemo(
    () => getDueCards('ghareeb', undefined, scopePages || undefined),
    [getDueCards, scopePages, cards],
  );

  const scopedCards = useMemo(() => {
    if (scope.type === 'flagged') {
      const flagged = getFlaggedCards('ghareeb');
      if (!scopePages || scopePages.length === 0) return flagged;
      const pageSet = new Set(scopePages);
      return flagged.filter((card) => pageSet.has(card.page));
    }

    if (reviewSource === 'due' || scope.type === 'all-due') return dueCards;

    if (!scopePages || scopePages.length === 0) {
      return cards.filter((card) => card.type === 'ghareeb');
    }
    return getCardsByPages(scopePages, 'ghareeb');
  }, [scope.type, reviewSource, dueCards, getFlaggedCards, getCardsByPages, scopePages, cards]);

  const dueCount = dueCards.length;
  const sessionPoolCount = scopedCards.length;
  const totalCards = cards.filter(c => c.type === 'ghareeb').length;
  const canStartReview = reviewSource === 'all' ? (sessionPoolCount > 0 || scopeWords.length > 0) : sessionPoolCount > 0;

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

  const pickDistributedByAyah = useCallback((pool: SRSCard[], limit?: number) => {
    if (pool.length <= 1) return pool;
    const maxItems = limit && limit > 0 ? Math.min(limit, pool.length) : pool.length;

    const bucketsMap = new Map<string, SRSCard[]>();
    pool.forEach((card) => {
      const surah = Number(card.meta?.surahNumber || 0);
      const ayah = Number(card.meta?.verseNumber || 0);
      const key = surah > 0 && ayah > 0 ? `${surah}_${ayah}` : `page_${card.page}`;
      const bucket = bucketsMap.get(key);
      if (bucket) bucket.push(card);
      else bucketsMap.set(key, [card]);
    });

    const buckets = Array.from(bucketsMap.values());
    const picked: SRSCard[] = [];
    let round = 0;

    while (picked.length < maxItems) {
      let progressed = false;
      for (const bucket of buckets) {
        const next = bucket[round];
        if (!next) continue;
        picked.push(next);
        progressed = true;
        if (picked.length >= maxItems) break;
      }
      if (!progressed) break;
      round += 1;
    }

    return picked;
  }, []);

  const addPageWords = useCallback(() => {
    const added = addWordsAsCards(pageWords);
    if (added > 0) toast.success(`تمت إضافة ${added} كلمة للمراجعة`);
    else toast.info('جميع الكلمات مضافة بالفعل');
  }, [pageWords, addWordsAsCards]);

  const addScopeWords = useCallback(() => {
    if (!scopePages || scopePages.length === 0) {
      toast.info('اختر نطاقًا محددًا أولاً (سورة/جزء/حزب/صفحات)');
      return;
    }
    if (scopeWords.length === 0) {
      toast.info('لا توجد كلمات غريب في هذا النطاق');
      return;
    }
    const added = addWordsAsCards(scopeWords);
    if (added > 0) toast.success(`تمت إضافة ${added} كلمة من النطاق المحدد`);
    else toast.info('كل كلمات هذا النطاق مضافة بالفعل');
  }, [scopePages, scopeWords, addWordsAsCards]);

  const startReview = useCallback(() => {
    const maxCount = sessionSize === 'all' ? undefined : parseInt(sessionSize);
    let pool = scopedCards;

    if (pool.length === 0 && reviewSource === 'all' && scope.type !== 'flagged' && scopeWords.length > 0) {
      const added = addWordsAsCards(scopeWords);
      if (added > 0) {
        toast.success(`تم تجهيز ${added} بطاقة من النطاق المحدد`);
        const state = useSRSStore.getState();
        if (scope.type === 'all-due') {
          pool = state.cards.filter((c) => c.type === 'ghareeb');
        } else if (scopePages && scopePages.length > 0) {
          pool = state.getCardsByPages(scopePages, 'ghareeb');
        }
      }
    }

    if (pool.length === 0) {
      if (reviewSource === 'due') {
        toast.info('لا توجد بطاقات مستحقة الآن في هذا النطاق. جرّب اختيار "كل بطاقات النطاق"');
      } else {
        toast.info('لا توجد بطاقات متاحة للمراجعة في هذا النطاق');
      }
      return;
    }

    const preparedPool = wordDistribution === 'by-ayah'
      ? pickDistributedByAyah(pool, maxCount)
      : pool;
    const selected = maxCount ? preparedPool.slice(0, maxCount) : preparedPool;

    setSessionCards(selected);
    setSessionMode('review');
  }, [sessionSize, wordDistribution, pickDistributedByAyah, scopedCards, reviewSource, scope.type, scopeWords, addWordsAsCards, scopePages]);

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
            renderPageWithHighlight={renderPageWithHighlight}
          />
        )}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 font-arabic" dir="rtl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalCards}</p>
          <p className="text-xs text-muted-foreground">إجمالي البطاقات</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{sessionPoolCount}</p>
          <p className="text-xs text-muted-foreground">جاهزة للجلسة</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{dueCount}</p>
          <p className="text-xs text-muted-foreground">مستحقة الآن</p>
        </div>
      </div>

      {/* Add words */}
      <div className="space-y-2">
        <Button onClick={addPageWords} variant="outline" className="w-full gap-2 font-arabic">
          <Plus className="w-4 h-4" />
          إضافة كلمات الصفحة الحالية ({pageWords.length} كلمة)
        </Button>
        {scopeWords.length > 0 && (
          <Button onClick={addScopeWords} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" />
            إضافة كلمات النطاق المحدد ({scopeWords.length} كلمة)
          </Button>
        )}
      </div>

      {/* Scope selector */}
      <div className="bg-card border border-border rounded-lg p-3">
        <SRSScopeSelector scope={scope} onChange={setScope} currentPage={currentPage} showFlagged />
      </div>

      {/* Session source */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">مصدر البطاقات</span>
          <Select value={reviewSource} onValueChange={(v) => setReviewSource(v as typeof reviewSource)}>
            <SelectTrigger className="w-36 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due">المستحقة فقط</SelectItem>
              <SelectItem value="all">كل بطاقات النطاق</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {scope.type === 'all-due'
            ? 'وضع "كل المستحقة" يعتمد البطاقات المستحقة فقط تلقائياً.'
            : reviewSource === 'all'
              ? 'سيتم استخدام كل بطاقات الغريب ضمن السورة/الأجزاء/الأحزاب المحددة.'
              : 'سيتم إدخال البطاقات المستحقة حالياً ضمن النطاق المحدد فقط.'}
        </p>
      </div>

      {/* Highlight is always text-color-only */}

      {/* Session settings */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm">إعدادات الجلسة</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">توزيع الكلمات</span>
          <Select value={wordDistribution} onValueChange={(v) => setWordDistribution(v as typeof wordDistribution)}>
            <SelectTrigger className="w-32 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">متتابعة</SelectItem>
              <SelectItem value="by-ayah">من آيات متعددة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-arabic">عدد البطاقات</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant={sessionSize === 'all' ? 'default' : 'outline'} size="sm" className="font-arabic" onClick={() => setSessionSize('all')}>الكل</Button>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={sessionSize === 'all' ? '' : sessionSize}
              onChange={(e) => setSessionSize(e.target.value === '' ? 'all' : e.target.value)}
              placeholder={`حتى ${sessionPoolCount}`}
              className="h-10 text-center text-xl font-bold font-arabic flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[10, 20, 50, 100, 200, 300, sessionPoolCount].filter((n, i, a) => n > 0 && a.indexOf(n) === i).sort((a, b) => a - b).map((count) => (
              <Button key={count} type="button" variant={sessionSize !== 'all' && parseInt(sessionSize) === count ? 'default' : 'outline'} size="sm" className="font-arabic min-w-[3.5rem]" onClick={() => setSessionSize(String(count))}>
                {count}
              </Button>
            ))}
          </div>
        </div>
        <Button onClick={startReview} disabled={!canStartReview} className="w-full gap-2 font-arabic" size="lg">
          <RotateCcw className="w-4 h-4" />
          بدء المراجعة ({sessionPoolCount > 0 ? sessionPoolCount : scopeWords.length} كلمة)
        </Button>
      </div>

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
  );
}

// ── Review card content with auto-scroll ─────────────────────────────────────

function GhareebReviewCardContent({
  card,
  answerRevealed,
  answerDisplayMode,
  highlightStyle,
  renderPageWithHighlight,
}: {
  card: SRSCard;
  answerRevealed: boolean;
  answerDisplayMode: string;
  highlightStyle: 'color' | 'bg' | 'border';
  renderPageWithHighlight: (page: number, wordKey: string | null, style: 'color' | 'bg' | 'border') => React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the highlighted word when card changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!rootRef.current) return;
      const wordEl = rootRef.current.querySelector<HTMLElement>(`[data-ghareeb-key="${card.contentKey}"]`);
      if (!wordEl) return;
      // Walk up to find the scrollable container
      let scrollParent: Element | null = rootRef.current.parentElement;
      while (scrollParent) {
        const style = getComputedStyle(scrollParent);
        if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') break;
        scrollParent = scrollParent.parentElement;
      }
      if (!scrollParent) {
        wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const parentRect = scrollParent.getBoundingClientRect();
      const wordRect = wordEl.getBoundingClientRect();
      if (wordRect.top < parentRect.top + 40 || wordRect.bottom > parentRect.bottom - 40) {
        const scrollTop = scrollParent.scrollTop + (wordRect.top - parentRect.top) - parentRect.height / 2 + wordRect.height / 2;
        scrollParent.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [card.contentKey, card.id]);

  // Auto-scroll when answer is revealed to keep meaning box visible
  useEffect(() => {
    if (!answerRevealed) return;
    const timer = setTimeout(() => {
      if (!rootRef.current) return;
      // Find the tooltip or inline answer element
      const answerEl = rootRef.current.querySelector<HTMLElement>('[data-ghareeb-tooltip], .ghareeb-inline-answer');
      const targetEl = answerEl || rootRef.current.querySelector<HTMLElement>(`[data-ghareeb-key="${card.contentKey}"]`);
      if (!targetEl) return;
      let scrollParent: Element | null = rootRef.current.parentElement;
      while (scrollParent) {
        const style = getComputedStyle(scrollParent);
        if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') break;
        scrollParent = scrollParent.parentElement;
      }
      if (!scrollParent) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = targetEl.getBoundingClientRect();
      // If the element is below the visible area, scroll smoothly
      if (elRect.bottom > parentRect.bottom - 20 || elRect.top < parentRect.top + 20) {
        const scrollTop = scrollParent.scrollTop + (elRect.top - parentRect.top) - parentRect.height * 0.4;
        scrollParent.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [answerRevealed, card.contentKey]);

  return (
    <div ref={rootRef} className="p-2 relative" data-ghareeb-review-root="true">
      {renderPageWithHighlight(card.page, card.contentKey, highlightStyle)}
      {/* Tooltip answer anchored near the word */}
      {answerRevealed && answerDisplayMode === 'tooltip' && (
        <AnchoredGhareebTooltip
          visible
          contentKey={card.contentKey}
          wordText={String(card.meta.wordText || '')}
          meaning={String(card.meta.meaning || '')}
          surahName={String(card.meta.surahName || '')}
          verseNumber={Number(card.meta.verseNumber || 0)}
          rootRef={rootRef}
        />
      )}
      {/* Inline answer — uses settings */}
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

// ── Tooltip anchored near the word (absolute within review root) ─────────────

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
    if (!visible) {
      setStyle(null);
      return;
    }

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

      setStyle({
        position: 'absolute',
        top,
        left,
        zIndex: 50,
      });

      const scrollParent = root.closest('.overflow-auto');
      if (scrollParent) {
        const spRect = scrollParent.getBoundingClientRect();
        if (wordRect.bottom + 100 > spRect.bottom || wordRect.top < spRect.top) {
          const scrollTop = scrollParent.scrollTop + (wordRect.top - spRect.top) - spRect.height / 2;
          scrollParent.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        }
      }
    };

    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [visible, contentKey, rootRef, tooltipWidth]);

  if (!visible || !style) return null;

  const shadowMap: Record<string, string> = {
    none: 'none',
    soft: '0 2px 8px rgba(0,0,0,0.08)',
    medium: '0 4px 16px rgba(0,0,0,0.12)',
    strong: '0 8px 30px rgba(0,0,0,0.18)',
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
    >
      <p className="font-arabic font-bold" style={{ color: `hsl(${wordColor})`, fontSize: `${mb.wordFontSize}rem` }}>{wordText}</p>
      <p className="font-arabic mt-1" style={{ color: `hsl(${meaningColor})`, fontSize: `${mb.meaningFontSize}rem` }}>{meaning}</p>
      <p className="text-xs text-muted-foreground mt-1 font-arabic">{surahName} — آية {verseNumber}</p>
    </div>
  );
}
