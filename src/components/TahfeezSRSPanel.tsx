import React, { useState, useCallback, useMemo } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { TahfeezSessionReviewSettings } from './TahfeezSessionReviewSettings';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
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

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  const normalized = normalizeArabic(line);
  return normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله');
}

function formatArabicNumber(value: number): string {
  return new Intl.NumberFormat('ar-SA').format(value);
}

function buildAyahStableId(pageNumber: number, ayahIndex: number): string {
  return `ayah_${pageNumber}_${ayahIndex}`;
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

function extractPageAyahGroups(text: string, pageNumber: number): WordToken[][] {
  const lines = text.split('\n');
  const ayahGroups: WordToken[][] = [];
  const isFatiha = pageNumber === 1;

  if (isFatiha) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (isSurahHeader(line)) continue;
      const parts = line.split(/(\s+)/);
      const group: WordToken[] = [];
      for (let ti = 0; ti < parts.length; ti++) {
        const t = parts[ti];
        if (/^\s+$/.test(t)) continue;
        const c = t.replace(CLEAN_RE, '').trim();
        if (/^[٠-٩0-9۰-۹]+$/.test(c) || c.length === 0) continue;
        group.push({ text: t, lineIdx: li, tokenIdx: ti, key: `${li}_${ti}` });
      }
      if (group.length > 0) ayahGroups.push(group);
    }
    return ayahGroups;
  }

  let currentGroup: WordToken[] = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (isSurahHeader(line) || isBismillah(line)) continue;
    const parts = line.split(/(\s+)/);
    for (let ti = 0; ti < parts.length; ti++) {
      const t = parts[ti];
      if (/^\s+$/.test(t)) continue;
      const c = t.replace(CLEAN_RE, '').trim();
      const isVerseNumber = /^[٠-٩0-9۰-۹]+$/.test(c);
      if (isVerseNumber) {
        if (currentGroup.length > 0) {
          ayahGroups.push(currentGroup);
          currentGroup = [];
        }
        continue;
      }
      if (c.length === 0) continue;
      currentGroup.push({ text: t, lineIdx: li, tokenIdx: ti, key: `${li}_${ti}` });
    }
  }

  if (currentGroup.length > 0) ayahGroups.push(currentGroup);
  return ayahGroups;
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
  const showHiddenWordsPreview = useTahfeezStore((s) => s.showHiddenWordsPreview);
  const {
    addCard, hasCard, getDueCards, getCardsByPages, cards,
    exportData, importData, clearAll, getFlaggedCards,
  } = useSRSStore();

  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionSize, setSessionSize] = useState<string>('all');
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

  const pageAyahCounts = useMemo(() => {
    const counts = new Map<number, number>();
    allPages.forEach((page) => {
      counts.set(page.pageNumber, extractPageAyahGroups(page.text, page.pageNumber).length);
    });
    return counts;
  }, [allPages]);

  const pageWordCounts = useMemo(() => {
    const counts = new Map<number, number>();
    allPages.forEach((page) => {
      counts.set(page.pageNumber, extractPageWords(page.text, page.pageNumber).length);
    });
    return counts;
  }, [allPages]);

  const rawScopeCount = useMemo(() => {
    if (!scopePages || scopePages.length === 0) return 0;
    return scopePages.reduce((sum, pageNumber) => {
      return sum + (reviewLevel === 'ayah'
        ? (pageAyahCounts.get(pageNumber) ?? 0)
        : (pageWordCounts.get(pageNumber) ?? 0));
    }, 0);
  }, [scopePages, reviewLevel, pageAyahCounts, pageWordCounts]);

  const usesRawScopeCount = reviewSource === 'all' && scope.type !== 'flagged' && scope.type !== 'all-due';
  const availableCount = usesRawScopeCount ? rawScopeCount : sessionPoolCount;
  const requestedCount = sessionSize === 'all' ? availableCount : Math.max(1, parseInt(sessionSize, 10) || 1);
  const plannedSessionCount = sessionSize === 'all' ? availableCount : Math.min(requestedCount, availableCount);
  const quickSessionSizes = Array.from(new Set([10, 20, 50, 100, 200, 300, availableCount].filter((n) => n > 0))).sort((a, b) => a - b);

  // (dead useMemo removed)

  React.useEffect(() => {
    const needsMigration = cards.some((card) => {
      if (card.type === 'tahfeez-ayah') {
        if (typeof card.meta?.ayahIndex !== 'number') return true;
        // Detect old-format stableId (ayah_page_idx_key_key) vs new (ayah_page_idx)
        const sid = card.meta?.ayahStableId;
        if (typeof sid !== 'string') return true;
        const parts = sid.split('_');
        // New format: ayah_{page}_{idx} = 3 parts; old had 5+
        if (parts.length > 3) return true;
        return false;
      }
      return false;
    });
    if (!needsMigration) return;

    useSRSStore.setState((state) => {
      const existingIds = new Set(state.cards.map((card) => card.id));
      const migrated: SRSCard[] = [];
      const nextCards: SRSCard[] = [];
      let changed = false;

      state.cards.forEach((card) => {
        const isLegacyAyahCard = card.type === 'tahfeez-ayah' && (typeof card.meta?.ayahIndex !== 'number' || typeof card.meta?.ayahStableId !== 'string');
        if (!isLegacyAyahCard) {
          nextCards.push(card);
          return;
        }

        const pageDataForCard = allPages.find((page) => page.pageNumber === card.page);
        const ayahGroups = pageDataForCard ? extractPageAyahGroups(pageDataForCard.text, card.page) : [];
        if (ayahGroups.length === 0) {
          nextCards.push(card);
          return;
        }

        changed = true;
        ayahGroups.forEach((group, ayahIndex) => {
          const id = `tahfeez_ayah_${card.page}_${ayahIndex}`;
          if (existingIds.has(id)) return;
          existingIds.add(id);
          migrated.push({
            ...card,
            id,
            contentKey: `ayah_${card.page}_${ayahIndex}`,
            label: `ص${card.page} — آية ${ayahIndex + 1}`,
            meta: { ...card.meta, ayahIndex, wordCount: group.length, ayahStableId: buildAyahStableId(card.page, ayahIndex) },
          });
        });
      });

      return changed ? { cards: [...nextCards, ...migrated] } : state;
    });
  }, [cards, allPages]);

  // ── Card generation helpers ──

  const generateAyahCards = useCallback(
    (pg: number, pgData: QuranPage) => {
      const ayahGroups = extractPageAyahGroups(pgData.text, pg);
      let added = 0;

      ayahGroups.forEach((group, ayahIndex) => {
        const id = `tahfeez_ayah_${pg}_${ayahIndex}`;
        if (hasCard(id)) return;
        addCard({
          id,
          type: 'tahfeez-ayah',
          page: pg,
          contentKey: `ayah_${pg}_${ayahIndex}`,
          label: `ص${pg} — آية ${ayahIndex + 1}`,
          meta: { ayahIndex, wordCount: group.length, ayahStableId: buildAyahStableId(pg, ayahIndex) },
        });
        added += 1;
      });

      return added;
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
            label: `ص${pg} — كلمة مراجعة`,
            meta: { wordText: tok.text, lineIdx: tok.lineIdx, tokenIdx: tok.tokenIdx, reviewItemId: `word_${pg}_${tok.key}` },
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
      const added = generateAyahCards(currentPage, pageData);
      if (added > 0) toast.success(`تمت إضافة ${formatArabicNumber(added)} آية من الصفحة ${formatArabicNumber(currentPage)}`);
      else toast.info('الصفحة مضافة بالفعل');
    } else {
      const added = generateWordCards(currentPage, pageData);
      if (added > 0) toast.success(`تمت إضافة ${formatArabicNumber(added)} كلمة`);
      else toast.info('جميع الكلمات مضافة بالفعل');
    }
  }, [pageData, currentPage, reviewLevel, generateAyahCards, generateWordCards]);

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
        added += generateAyahCards(pg, pgData);
      } else {
        added += generateWordCards(pg, pgData);
      }
    }
    if (added > 0) toast.success(`تمت إضافة ${formatArabicNumber(added)} ${reviewLevel === 'ayah' ? 'آية' : 'كلمة'}`);
    else toast.info('جميع العناصر مضافة بالفعل');
  }, [scopePages, allPages, reviewLevel, generateAyahCards, generateWordCards]);

  const startReview = useCallback(() => {
    let pool = scopedCards;

    // Auto-generate cards if pool is empty and scope is set
    if (pool.length === 0 && reviewSource === 'all' && scope.type !== 'flagged' && scopePages && scopePages.length > 0) {
      let autoAdded = 0;
      for (const pg of scopePages) {
        const pgData = allPages.find((p) => p.pageNumber === pg);
        if (!pgData) continue;
        if (reviewLevel === 'ayah') {
          autoAdded += generateAyahCards(pg, pgData);
        } else {
          autoAdded += generateWordCards(pg, pgData);
        }
      }
      if (autoAdded > 0) {
        toast.success(`تم تجهيز ${formatArabicNumber(autoAdded)} بطاقة`);
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

    const maxCount = sessionSize === 'all' ? pool.length : Math.max(1, parseInt(sessionSize, 10) || 1);
    const selected = pool.slice(0, maxCount);

    if (sessionSize !== 'all' && selected.length < maxCount) {
      toast.info(`تم اختيار ${formatArabicNumber(selected.length)} بطاقة فقط لأن المتاح في هذا النطاق هو ${formatArabicNumber(pool.length)}`);
    }

    setSessionCards(selected);
    setSessionMode('review');
  }, [scopedCards, reviewSource, scope.type, scopePages, allPages, reviewLevel, generateAyahCards, generateWordCards, srsType, sessionSize]);

  const canStart = availableCount > 0;

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
      <SRSReviewSession
        cards={sessionCards}
        onFinish={() => setSessionMode('setup')}
        onNavigateToPage={onNavigateToPage}
        portalName="التحفيظ"
        headerExtra={
          <Sheet>
            <SheetTrigger asChild>
              <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors" title="إعدادات المراجعة">
                <Settings className="w-3.5 h-3.5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto w-[340px] sm:max-w-[400px]" dir="rtl">
              <SheetHeader>
                <SheetTitle className="font-arabic text-right">إعدادات المراجعة</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <TahfeezSessionReviewSettings />
              </div>
            </SheetContent>
          </Sheet>
        }
        defaultAnswerMode={showHiddenWordsPreview ? 'bottom' : 'inline'}
        answerModeOptions={showHiddenWordsPreview ? ['inline', 'bottom'] : ['inline']}
        renderAnswer={showHiddenWordsPreview ? ((card) => card.type === 'tahfeez-word' ? (
          <div className="text-center font-arabic text-lg text-foreground">{String(card.meta.wordText || '')}</div>
        ) : null) : undefined}
        renderCard={(card, answerRevealed) => {
          return (
            <div className="p-2">
              {renderPageWithBlanks(card.page, answerRevealed ? [] : [card.contentKey], card)}
            </div>
          );
        }}
      />
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
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
            <p className="text-4xl font-bold text-primary leading-none">{formatArabicNumber(plannedSessionCount)}</p>
            <p className="text-xs text-muted-foreground mt-2">سيبدأ بهذا العدد</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
            <p className="text-4xl font-bold text-foreground leading-none">{formatArabicNumber(availableCount)}</p>
            <p className="text-xs text-muted-foreground mt-2">المتاح في النطاق</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">عدد البطاقات</span>
            <Button
              type="button"
              variant={sessionSize === 'all' ? 'default' : 'outline'}
              size="sm"
              className="font-arabic"
              onClick={() => setSessionSize('all')}
            >
              الكل
            </Button>
          </div>

          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={sessionSize === 'all' ? '' : sessionSize}
            onChange={(e) => setSessionSize(e.target.value === '' ? 'all' : e.target.value)}
            placeholder={availableCount > 0 ? `حتى ${formatArabicNumber(availableCount)}` : '0'}
            className="h-12 text-center text-2xl font-bold font-arabic"
            disabled={availableCount === 0}
          />

          <div className="flex flex-wrap gap-2">
            {quickSessionSizes.map((count) => (
              <Button
                key={count}
                type="button"
                variant={sessionSize !== 'all' && requestedCount === count ? 'default' : 'outline'}
                size="sm"
                className="font-arabic min-w-[4.5rem]"
                onClick={() => setSessionSize(String(count))}
              >
                {formatArabicNumber(count)}
              </Button>
            ))}
          </div>

          {sessionSize !== 'all' && requestedCount > availableCount && availableCount > 0 && (
            <p className="text-xs text-muted-foreground">
              المتاح الآن {formatArabicNumber(availableCount)} فقط، لذلك ستبدأ الجلسة بهذا العدد.
            </p>
          )}
        </div>

        <Button
          onClick={startReview}
          disabled={!canStart}
          className="w-full gap-2 font-arabic"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          بدء المراجعة ({formatArabicNumber(plannedSessionCount)})
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
