import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GhareebWord } from '@/types/quran';
import { Plus, RotateCcw, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const [sessionSize, setSessionSize] = useState<'all' | '5' | '10' | '20' | '30' | '50' | '100'>('all');
  const [scope, setScope] = useState<SRSScope>({ type: 'all-due', from: currentPage, to: currentPage });
  const [highlightStyle, setHighlightStyle] = useState<'color' | 'bg' | 'border'>('bg');
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
        renderCard={(card, answerRevealed, answerDisplayMode) => (
          <div className="p-2" data-ghareeb-review-root="true">
            {renderPageWithHighlight(card.page, card.contentKey, highlightStyle)}
            <AnchoredGhareebTooltip
              visible={answerRevealed && answerDisplayMode === 'tooltip'}
              contentKey={card.contentKey}
              wordText={String(card.meta.wordText || '')}
              meaning={String(card.meta.meaning || '')}
              surahName={String(card.meta.surahName || '')}
              verseNumber={Number(card.meta.verseNumber || 0)}
            />
            {/* Inline answer (embedded in page area) */}
            {answerRevealed && answerDisplayMode === 'inline' && (
              <div className="mt-2 mx-auto max-w-md bg-accent/50 border border-border rounded-xl p-3 text-center animate-fade-in" dir="rtl">
                <p className="font-arabic text-lg font-bold text-primary">{card.meta.wordText as string}</p>
                <p className="font-arabic text-base text-foreground mt-1">{card.meta.meaning as string}</p>
              </div>
            )}
          </div>
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

      {/* Highlight style */}
      <div className="flex items-center justify-between">
        <span className="text-sm">نوع التمييز</span>
        <Select value={highlightStyle} onValueChange={v => setHighlightStyle(v as typeof highlightStyle)}>
          <SelectTrigger className="w-28 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="color">لون</SelectItem>
            <SelectItem value="bg">خلفية</SelectItem>
            <SelectItem value="border">إطار</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
        <div className="flex items-center justify-between">
          <span className="text-sm">عدد الكلمات</span>
          <Select value={sessionSize} onValueChange={(v) => setSessionSize(v as typeof sessionSize)}>
            <SelectTrigger className="w-28 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({sessionPoolCount})</SelectItem>
              <SelectItem value="5">٥</SelectItem>
              <SelectItem value="10">١٠</SelectItem>
              <SelectItem value="20">٢٠</SelectItem>
              <SelectItem value="30">٣٠</SelectItem>
              <SelectItem value="50">٥٠</SelectItem>
              <SelectItem value="100">١٠٠</SelectItem>
            </SelectContent>
          </Select>
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

function AnchoredGhareebTooltip({
  visible,
  contentKey,
  wordText,
  meaning,
  surahName,
  verseNumber,
}: {
  visible: boolean;
  contentKey: string;
  wordText: string;
  meaning: string;
  surahName: string;
  verseNumber: number;
}) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!visible) {
      setStyle(null);
      return;
    }

    const updatePosition = () => {
      const reviewRoot = document.querySelector<HTMLElement>('[data-ghareeb-review-root="true"]');
      const wordEl = reviewRoot?.querySelector<HTMLElement>(`[data-ghareeb-key="${contentKey}"]`) || document.querySelector<HTMLElement>(`[data-ghareeb-key="${contentKey}"]`);
      const rect = wordEl?.getBoundingClientRect();
      if (!rect) {
        setStyle({ position: 'fixed', top: '33%', left: '50%', transform: 'translateX(-50%)', zIndex: 50 });
        return;
      }

      const panelRect = reviewRoot?.getBoundingClientRect();
      const maxLeft = panelRect ? panelRect.right - 260 : window.innerWidth - 260;
      const minLeft = panelRect ? panelRect.left + 16 : 16;
      const maxTop = panelRect ? panelRect.bottom - 160 : window.innerHeight - 160;

      setStyle({
        position: 'fixed',
        top: Math.min(rect.bottom + 8, maxTop),
        left: Math.max(minLeft, Math.min(rect.left + rect.width / 2 - 120, maxLeft)),
        zIndex: 50,
      });
    };

    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [visible, contentKey]);

  if (!visible) return null;

  return (
    <div style={style || { position: 'fixed', top: '33%', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }} className="bg-card border-2 border-primary rounded-xl shadow-2xl p-4 text-center animate-fade-in max-w-[240px] w-[240px]" dir="rtl">
      <p className="font-arabic text-lg font-bold text-primary">{wordText}</p>
      <p className="font-arabic text-base text-foreground mt-1">{meaning}</p>
      <p className="text-xs text-muted-foreground mt-1 font-arabic">{surahName} — آية {verseNumber}</p>
    </div>
  );
}
