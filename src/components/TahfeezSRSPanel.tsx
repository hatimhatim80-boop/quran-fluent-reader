import React, { useState, useCallback, useMemo } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { TahfeezSessionReviewSettings } from './TahfeezSessionReviewSettings';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, RotateCcw, Download, Upload, Trash2, BookOpen, Type, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';

// ── Shared tokenization (mirrors TahfeezQuizView logic) ──────────────────────

const CLEAN_RE = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

interface WordToken {
  text: string;
  lineIdx: number;
  tokenIdx: number;
  key: string; // `${lineIdx}_${tokenIdx}`
}

function extractPageWords(text: string, pageNumber: number): WordToken[] {
  const lines = text.split('\n');
  const tokens: WordToken[] = [];
  const isFatiha = pageNumber === 1;

  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    if (l.startsWith('سُورَةُ') || l.startsWith('سورة ')) continue;
    if (!isFatiha) {
      const n = normalizeArabic(l);
      if (n.includes('بسم الله الرحمن الرحيم') || n.includes('بسم الله')) continue;
    }
    const parts = l.split(/(\s+)/);
    for (let ti = 0; ti < parts.length; ti++) {
      const t = parts[ti];
      if (/^\s+$/.test(t)) continue;
      const c = t.replace(CLEAN_RE, '').trim();
      if (/^[٠-٩0-9۰-۹]+$/.test(c) || c.length === 0) continue;
      tokens.push({ text: t, lineIdx: li, tokenIdx: ti, key: `${li}_${ti}` });
    }
  }
  return tokens;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TahfeezSRSPanelProps {
  currentPage: number;
  totalPages: number;
  pageData: QuranPage | undefined;
  allPages: QuranPage[];
  onNavigateToPage: (page: number) => void;
  renderPageWithBlanks: (page: number, blankedKeys: string[], card: SRSCard) => React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TahfeezSRSPanel({
  currentPage,
  totalPages,
  pageData,
  allPages,
  onNavigateToPage,
  renderPageWithBlanks,
}: TahfeezSRSPanelProps) {
  const {
    addCard, hasCard, getDueCards, getCardsByPages, cards,
    exportData, importData, clearAll, getFlaggedCards,
  } = useSRSStore();

  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionSize, setSessionSize] = useState<'all' | '10' | '20' | '50'>('all');
  const [reviewLevel, setReviewLevel] = useState<'ayah' | 'word'>('ayah');
  const [reviewSource, setReviewSource] = useState<'due' | 'all'>('all');
  const [scope, setScope] = useState<SRSScope>({
    type: 'all-due',
    from: currentPage,
    to: currentPage,
  });

  // ── Computed ──

  const scopePages = useMemo(
    () => scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from }),
    [scope, currentPage],
  );

  const srsType = reviewLevel === 'ayah' ? ('tahfeez-ayah' as const) : ('tahfeez-word' as const);

  const dueCards = useMemo(
    () => getDueCards(srsType, undefined, scopePages || undefined),
    [getDueCards, srsType, scopePages, cards],
  );

  const scopedCards = useMemo(() => {
    if (scope.type === 'flagged') {
      const flagged = getFlaggedCards(srsType);
      if (!scopePages || scopePages.length === 0) return flagged;
      const ps = new Set(scopePages);
      return flagged.filter((c) => ps.has(c.page));
    }
    if (reviewSource === 'due' || scope.type === 'all-due') return dueCards;
    if (!scopePages || scopePages.length === 0) return cards.filter((c) => c.type === srsType);
    return getCardsByPages(scopePages, srsType);
  }, [scope.type, reviewSource, dueCards, getFlaggedCards, getCardsByPages, scopePages, cards, srsType]);

  const totalCards = cards.filter((c) => c.type === srsType).length;
  const sessionPoolCount = scopedCards.length;
  const dueCount = dueCards.length;

  // ── Card generation helpers ──

  const generateAyahCard = useCallback(
    (pg: number, pgData: QuranPage) => {
      const id = `tahfeez_ayah_${pg}`;
      if (hasCard(id)) return false;
      const tokens = extractPageWords(pgData.text, pg);
      addCard({
        id,
        type: 'tahfeez-ayah',
        page: pg,
        contentKey: `page_${pg}`,
        label: `ص${pg} — ${tokens.length} كلمة`,
        meta: { wordCount: tokens.length },
      });
      return true;
    },
    [addCard, hasCard],
  );

  const generateWordCards = useCallback(
    (pg: number, pgData: QuranPage) => {
      const tokens = extractPageWords(pgData.text, pg);
      let added = 0;
      tokens.forEach((tok) => {
        const id = `tahfeez_word_${pg}_${tok.key}`;
        if (!hasCard(id)) {
          addCard({
            id,
            type: 'tahfeez-word',
            page: pg,
            contentKey: tok.key,
            label: `${tok.text} — ص${pg}`,
            meta: { wordText: tok.text, lineIdx: tok.lineIdx, tokenIdx: tok.tokenIdx },
          });
          added++;
        }
      });
      return added;
    },
    [addCard, hasCard],
  );

  // ── Actions ──

  const addCurrentPage = useCallback(() => {
    if (!pageData) return;
    if (reviewLevel === 'ayah') {
      if (generateAyahCard(currentPage, pageData)) toast.success(`تمت إضافة صفحة ${currentPage}`);
      else toast.info('الصفحة مضافة بالفعل');
    } else {
      const added = generateWordCards(currentPage, pageData);
      if (added > 0) toast.success(`تمت إضافة ${added} كلمة`);
      else toast.info('جميع الكلمات مضافة بالفعل');
    }
  }, [pageData, currentPage, reviewLevel, generateAyahCard, generateWordCards]);

  const addScopeCards = useCallback(() => {
    if (!scopePages || scopePages.length === 0) {
      toast.info('اختر نطاقًا محددًا أولاً');
      return;
    }
    let added = 0;
    for (const pg of scopePages) {
      const pgData = allPages.find((p) => p.pageNumber === pg);
      if (!pgData) continue;
      if (reviewLevel === 'ayah') {
        if (generateAyahCard(pg, pgData)) added++;
      } else {
        added += generateWordCards(pg, pgData);
      }
    }
    if (added > 0) toast.success(`تمت إضافة ${added} ${reviewLevel === 'ayah' ? 'صفحة' : 'كلمة'}`);
    else toast.info('جميع العناصر مضافة بالفعل');
  }, [scopePages, allPages, reviewLevel, generateAyahCard, generateWordCards]);

  const startReview = useCallback(() => {
    let pool = scopedCards;

    // Auto-generate cards if pool is empty and scope is set
    if (pool.length === 0 && reviewSource === 'all' && scope.type !== 'flagged' && scopePages && scopePages.length > 0) {
      let autoAdded = 0;
      for (const pg of scopePages) {
        const pgData = allPages.find((p) => p.pageNumber === pg);
        if (!pgData) continue;
        if (reviewLevel === 'ayah') {
          if (generateAyahCard(pg, pgData)) autoAdded++;
        } else {
          autoAdded += generateWordCards(pg, pgData);
        }
      }
      if (autoAdded > 0) {
        toast.success(`تم تجهيز ${autoAdded} بطاقة`);
        const state = useSRSStore.getState();
        pool = scopePages.length > 0
          ? state.getCardsByPages(scopePages, srsType)
          : state.cards.filter((c) => c.type === srsType);
      }
    }

    if (pool.length === 0) {
      toast.info(
        reviewSource === 'due'
          ? 'لا توجد بطاقات مستحقة الآن. جرّب "كل بطاقات النطاق"'
          : 'لا توجد بطاقات متاحة في هذا النطاق',
      );
      return;
    }

    const maxCount = sessionSize === 'all' ? undefined : parseInt(sessionSize);
    const selected = maxCount ? pool.slice(0, maxCount) : pool;
    setSessionCards(selected);
    setSessionMode('review');
  }, [scopedCards, reviewSource, scope.type, scopePages, allPages, reviewLevel, generateAyahCard, generateWordCards, srsType, sessionSize]);

  const canStart =
    sessionPoolCount > 0 || (reviewSource === 'all' && scopePages && scopePages.length > 0);

  // ── Export / Import ──

  const handleExport = useCallback(() => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tahfeez-srs-${new Date().toISOString().slice(0, 10)}.json`;
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

  // ── Review session ──

  if (sessionMode === 'review') {
    return (
      <div className="space-y-2">
        <TahfeezSessionReviewSettings showDebugBadge />
        <SRSReviewSession
          cards={sessionCards}
          onFinish={() => setSessionMode('setup')}
          onNavigateToPage={onNavigateToPage}
          portalName="التحفيظ"
          renderCard={(card, answerRevealed) => {
            if (card.type === 'tahfeez-word') {
              // Word-level: blank only this specific word
              return (
                <div className="p-2">
                  {renderPageWithBlanks(card.page, answerRevealed ? [] : [card.contentKey], card)}
                </div>
              );
            }
            // Ayah-level: blank everything or reveal
            return (
              <div className="p-2">
                {renderPageWithBlanks(card.page, answerRevealed ? [] : ['__ALL_BLANKED__'], card)}
              </div>
            );
          }}
        />
      </div>
    );
  }

  // ── Setup UI ──

  return (
    <div className="p-4 space-y-4 font-arabic" dir="rtl">
      {/* Review level selector */}
      <div className="flex gap-2">
        <Button
          variant={reviewLevel === 'ayah' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1 font-arabic text-xs"
          onClick={() => setReviewLevel('ayah')}
        >
          <BookOpen className="w-3 h-3" /> آيات (صفحات)
        </Button>
        <Button
          variant={reviewLevel === 'word' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1 font-arabic text-xs"
          onClick={() => setReviewLevel('word')}
        >
          <Type className="w-3 h-3" /> كلمات
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalCards}</p>
          <p className="text-xs text-muted-foreground">إجمالي</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{dueCount}</p>
          <p className="text-xs text-muted-foreground">مستحقة</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{sessionPoolCount}</p>
          <p className="text-xs text-muted-foreground">جاهزة</p>
        </div>
      </div>

      {/* Add cards buttons */}
      <div className="space-y-2">
        <Button onClick={addCurrentPage} variant="outline" className="w-full gap-2 font-arabic">
          <Plus className="w-4 h-4" />
          إضافة {reviewLevel === 'ayah' ? 'صفحة' : 'كلمات'} الصفحة الحالية
        </Button>
        {scopePages && scopePages.length > 0 && scope.type !== 'all-due' && scope.type !== 'flagged' && (
          <Button onClick={addScopeCards} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" />
            إضافة {reviewLevel === 'ayah' ? 'صفحات' : 'كلمات'} النطاق ({scopePages.length} صفحة)
          </Button>
        )}
      </div>

      {/* Scope selector */}
      <div className="bg-card border border-border rounded-lg p-3">
        <SRSScopeSelector scope={scope} onChange={setScope} currentPage={currentPage} showFlagged />
      </div>

      {/* Review source */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">مصدر البطاقات</span>
          <Select value={reviewSource} onValueChange={(v) => setReviewSource(v as typeof reviewSource)}>
            <SelectTrigger className="w-36 h-8 text-xs font-arabic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due">المستحقة فقط</SelectItem>
              <SelectItem value="all">كل بطاقات النطاق</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Session settings */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm">إعدادات الجلسة</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">عدد البطاقات</span>
          <Select value={sessionSize} onValueChange={(v) => setSessionSize(v as typeof sessionSize)}>
            <SelectTrigger className="w-28 h-8 text-xs font-arabic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({sessionPoolCount})</SelectItem>
              <SelectItem value="10">١٠</SelectItem>
              <SelectItem value="20">٢٠</SelectItem>
              <SelectItem value="50">٥٠</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={startReview}
          disabled={!canStart}
          className="w-full gap-2 font-arabic"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          بدء المراجعة ({sessionPoolCount > 0 ? sessionPoolCount : scopePages?.length || 0})
        </Button>
      </div>

      {/* Import / Export */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleExport}>
          <Download className="w-3 h-3" /> تصدير
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleImport}>
          <Upload className="w-3 h-3" /> استيراد
        </Button>
        {totalCards > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 font-arabic text-xs text-destructive"
            onClick={() => {
              if (confirm('هل تريد حذف جميع البطاقات؟')) {
                clearAll();
                toast.success('تم الحذف');
              }
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
