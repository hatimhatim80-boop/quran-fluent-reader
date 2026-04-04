import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { ReviewSessionSetup } from './ReviewSessionSetup';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { Button } from '@/components/ui/button';
import { Plus, Download, Upload, Trash2, BookOpen, Type } from 'lucide-react';
import { toast } from 'sonner';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';

const CLEAN_RE = /[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g;

interface WordToken { text: string; lineIdx: number; tokenIdx: number; key: string; }

function isSurahHeader(line: string): boolean { return line.startsWith('سُورَةُ') || line.startsWith('سورة '); }
function isBismillah(line: string): boolean { const n = normalizeArabic(line); return n.includes('بسم الله الرحمن الرحيم') || n.includes('بسم الله'); }
function formatArabicNumber(value: number): string { return new Intl.NumberFormat('ar-SA').format(value); }
function buildAyahStableId(pageNumber: number, ayahIndex: number): string { return `ayah_${pageNumber}_${ayahIndex}`; }

function extractPageWords(text: string, pageNumber: number): WordToken[] {
  const lines = text.split('\n'); const tokens: WordToken[] = []; const isFatiha = pageNumber === 1;
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    if (l.startsWith('سُورَةُ') || l.startsWith('سورة ')) continue;
    if (!isFatiha) { const n = normalizeArabic(l); if (n.includes('بسم الله الرحمن الرحيم') || n.includes('بسم الله')) continue; }
    const parts = l.split(/(\s+)/);
    for (let ti = 0; ti < parts.length; ti++) {
      const t = parts[ti]; if (/^\s+$/.test(t)) continue;
      const c = t.replace(CLEAN_RE, '').trim();
      if (/^[٠-٩0-9۰-۹]+$/.test(c) || c.length === 0) continue;
      tokens.push({ text: t, lineIdx: li, tokenIdx: ti, key: `${li}_${ti}` });
    }
  }
  return tokens;
}

function extractPageAyahGroups(text: string, pageNumber: number): WordToken[][] {
  const lines = text.split('\n'); const ayahGroups: WordToken[][] = []; const isFatiha = pageNumber === 1;
  if (isFatiha) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]; if (isSurahHeader(line)) continue;
      const parts = line.split(/(\s+)/); const group: WordToken[] = [];
      for (let ti = 0; ti < parts.length; ti++) {
        const t = parts[ti]; if (/^\s+$/.test(t)) continue;
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
    const line = lines[li]; if (isSurahHeader(line) || isBismillah(line)) continue;
    const parts = line.split(/(\s+)/);
    for (let ti = 0; ti < parts.length; ti++) {
      const t = parts[ti]; if (/^\s+$/.test(t)) continue;
      const c = t.replace(CLEAN_RE, '').trim();
      if (/^[٠-٩0-9۰-۹]+$/.test(c)) { if (currentGroup.length > 0) { ayahGroups.push(currentGroup); currentGroup = []; } continue; }
      if (c.length === 0) continue;
      currentGroup.push({ text: t, lineIdx: li, tokenIdx: ti, key: `${li}_${ti}` });
    }
  }
  if (currentGroup.length > 0) ayahGroups.push(currentGroup);
  return ayahGroups;
}

interface TahfeezSRSPanelProps {
  currentPage: number; totalPages: number; pageData: QuranPage | undefined;
  allPages: QuranPage[]; onNavigateToPage: (page: number) => void;
  renderPageWithBlanks: (page: number, blankedKeys: string[], card: SRSCard) => React.ReactNode;
}

export function TahfeezSRSPanel({ currentPage, totalPages, pageData, allPages, onNavigateToPage, renderPageWithBlanks }: TahfeezSRSPanelProps) {
  const showHiddenWordsPreview = useTahfeezStore((s) => s.showHiddenWordsPreview);
  const { addCard, hasCard, cards, exportData, importData, clearAll } = useSRSStore();

  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionName, setSessionName] = useState<string>('');
  const [reviewLevel, setReviewLevel] = useState<'ayah' | 'word'>('ayah');

  useEffect(() => {
    if (sessionMode !== 'review' || typeof document === 'undefined') return;
    const { body, documentElement } = document;
    const prev1 = body.style.overflow, prev2 = documentElement.style.overflow;
    body.style.overflow = 'hidden'; documentElement.style.overflow = 'hidden';
    return () => { body.style.overflow = prev1; documentElement.style.overflow = prev2; };
  }, [sessionMode]);

  const srsType = reviewLevel === 'ayah' ? 'tahfeez-ayah' as const : 'tahfeez-word' as const;
  const totalCards = cards.filter(c => c.type === srsType).length;

  // Migration effect
  React.useEffect(() => {
    const needsMigration = cards.some(card => {
      if (card.type === 'tahfeez-ayah') {
        if (typeof card.meta?.ayahIndex !== 'number') return true;
        const sid = card.meta?.ayahStableId;
        if (typeof sid !== 'string') return true;
        if (sid.split('_').length > 3) return true;
      }
      return false;
    });
    if (!needsMigration) return;
    useSRSStore.setState(state => {
      const existingIds = new Set(state.cards.map(c => c.id));
      const migrated: SRSCard[] = []; const nextCards: SRSCard[] = []; let changed = false;
      state.cards.forEach(card => {
        const sid = card.meta?.ayahStableId;
        const isLegacy = card.type === 'tahfeez-ayah' && (typeof card.meta?.ayahIndex !== 'number' || typeof sid !== 'string' || (typeof sid === 'string' && sid.split('_').length > 3));
        if (!isLegacy) { nextCards.push(card); return; }
        const pd = allPages.find(p => p.pageNumber === card.page);
        const groups = pd ? extractPageAyahGroups(pd.text, card.page) : [];
        if (groups.length === 0) { nextCards.push(card); return; }
        changed = true;
        groups.forEach((group, idx) => {
          const id = `tahfeez_ayah_${card.page}_${idx}`;
          if (existingIds.has(id)) return; existingIds.add(id);
          migrated.push({ ...card, id, contentKey: `ayah_${card.page}_${idx}`, label: `ص${card.page} — آية ${idx + 1}`, meta: { ...card.meta, ayahIndex: idx, wordCount: group.length, ayahStableId: buildAyahStableId(card.page, idx) } });
        });
      });
      return changed ? { cards: [...nextCards, ...migrated] } : state;
    });
  }, [cards, allPages]);

  const generateAyahCards = useCallback((pg: number, pgData: QuranPage) => {
    const groups = extractPageAyahGroups(pgData.text, pg); let added = 0;
    groups.forEach((group, idx) => {
      const id = `tahfeez_ayah_${pg}_${idx}`;
      if (hasCard(id)) return;
      addCard({ id, type: 'tahfeez-ayah', page: pg, contentKey: `ayah_${pg}_${idx}`, label: `ص${pg} — آية ${idx + 1}`, meta: { ayahIndex: idx, wordCount: group.length, ayahStableId: buildAyahStableId(pg, idx) } });
      added++;
    });
    return added;
  }, [addCard, hasCard]);

  const generateWordCards = useCallback((pg: number, pgData: QuranPage) => {
    const tokens = extractPageWords(pgData.text, pg); let added = 0;
    tokens.forEach(tok => {
      const id = `tahfeez_word_${pg}_${tok.key}`;
      if (!hasCard(id)) {
        addCard({ id, type: 'tahfeez-word', page: pg, contentKey: tok.key, label: `ص${pg} — كلمة مراجعة`, meta: { wordText: tok.text, lineIdx: tok.lineIdx, tokenIdx: tok.tokenIdx, reviewItemId: `word_${pg}_${tok.key}` } });
        added++;
      }
    });
    return added;
  }, [addCard, hasCard]);

  const addCurrentPage = useCallback(() => {
    if (!pageData) return;
    const added = reviewLevel === 'ayah' ? generateAyahCards(currentPage, pageData) : generateWordCards(currentPage, pageData);
    if (added > 0) toast.success(`تمت إضافة ${formatArabicNumber(added)} ${reviewLevel === 'ayah' ? 'آية' : 'كلمة'}`);
    else toast.info('مضافة بالفعل');
  }, [pageData, currentPage, reviewLevel, generateAyahCards, generateWordCards]);

  const handleAutoGenerate = useCallback((pages: number[]) => {
    let added = 0;
    for (const pg of pages) {
      const pd = allPages.find(p => p.pageNumber === pg); if (!pd) continue;
      added += reviewLevel === 'ayah' ? generateAyahCards(pg, pd) : generateWordCards(pg, pd);
    }
    return added;
  }, [allPages, reviewLevel, generateAyahCards, generateWordCards]);

  const handleStartSession = useCallback((cards: SRSCard[], sid: string, name: string) => {
    setSessionCards(cards); setSessionId(sid); setSessionName(name); setSessionMode('review');
  }, []);

  const handleExport = useCallback(() => {
    const json = exportData(); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tahfeez-srs-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success('تم التصدير');
  }, [exportData]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; const text = await file.text(); if (importData(text)) toast.success('تم الاستيراد'); else toast.error('فشل الاستيراد'); };
    input.click();
  }, [importData]);

  if (sessionMode === 'review') {
    const reviewOverlay = (
      <div className="fixed inset-0 z-40 overflow-hidden bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <SRSReviewSession
          cards={sessionCards}
          sessionId={sessionId}
          sessionName={sessionName}
          onFinish={() => setSessionMode('setup')}
          onNavigateToPage={onNavigateToPage}
          portalName="التحفيظ"
          focusMode
          defaultAnswerMode={showHiddenWordsPreview ? 'bottom' : 'inline'}
          answerModeOptions={showHiddenWordsPreview ? ['inline', 'bottom'] : ['inline']}
          renderAnswer={showHiddenWordsPreview ? ((card) => card.type === 'tahfeez-word' ? (
            <div className="text-center font-arabic text-lg text-foreground">{String(card.meta.wordText || '')}</div>
          ) : null) : undefined}
          renderCard={(card, answerRevealed) => (
            <TahfeezReviewCardContent card={card} answerRevealed={answerRevealed} renderPageWithBlanks={renderPageWithBlanks} />
          )}
        />
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(reviewOverlay, document.body) : reviewOverlay;
  }

  return (
    <ReviewSessionSetup
      portal="tahfeez"
      currentPage={currentPage}
      onStartSession={handleStartSession}
      cardTypeFilter={srsType}
      onAutoGenerateCards={handleAutoGenerate}
      headerContent={
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant={reviewLevel === 'ayah' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={() => setReviewLevel('ayah')}>
              <BookOpen className="w-3 h-3" /> آيات
            </Button>
            <Button variant={reviewLevel === 'word' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={() => setReviewLevel('word')}>
              <Type className="w-3 h-3" /> كلمات
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{totalCards}</p>
              <p className="text-xs text-muted-foreground">إجمالي</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{currentPage}</p>
              <p className="text-xs text-muted-foreground">الصفحة</p>
            </div>
          </div>
          <Button onClick={addCurrentPage} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" /> إضافة {reviewLevel === 'ayah' ? 'صفحة' : 'كلمات'} الحالية
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleExport}><Download className="w-3 h-3" /> تصدير</Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleImport}><Upload className="w-3 h-3" /> استيراد</Button>
            {totalCards > 0 && (
              <Button variant="outline" size="sm" className="gap-1 font-arabic text-xs text-destructive" onClick={() => { if (confirm('حذف جميع البطاقات؟')) { clearAll(); toast.success('تم'); } }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}

function TahfeezReviewCardContent({ card, answerRevealed, renderPageWithBlanks }: {
  card: SRSCard; answerRevealed: boolean;
  renderPageWithBlanks: (page: number, blankedKeys: string[], card: SRSCard) => React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    scrollContainerRef.current = rootRef.current.closest<HTMLElement>('[data-review-scroll-container="true"]');
  }, []);

  const scrollToCenter = useCallback((target: HTMLElement) => {
    const scrollParent = scrollContainerRef.current;
    if (!scrollParent) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const parentRect = scrollParent.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    // Account for bottom bar
    const parent = scrollParent.parentElement;
    let bottomBarH = 120;
    if (parent) {
      let h = 0;
      for (let i = parent.children.length - 1; i >= 0; i--) {
        if (parent.children[i] === scrollParent) break;
        h += (parent.children[i] as HTMLElement).getBoundingClientRect().height;
      }
      bottomBarH = Math.max(h, 80);
    }
    const usableHeight = parentRect.height - bottomBarH;
    const idealCenter = usableHeight * 0.4;
    const nextTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - idealCenter + (targetRect.height / 2);
    scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const doScroll = () => {
      if (!rootRef.current) return;
      const target = answerRevealed
        ? rootRef.current.querySelector<HTMLElement>('[data-revealed-ayah], [data-revealed-word], [data-blanked="true"]')
        : rootRef.current.querySelector<HTMLElement>('[data-blanked="true"], .tahfeez-blank, [style*="visibility: hidden"]');
      if (!target) return;
      scrollToCenter(target);
    };
    const t1 = setTimeout(doScroll, 150);
    const t2 = setTimeout(doScroll, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [card.contentKey, card.id, answerRevealed, scrollToCenter]);

  return (
    <div ref={rootRef} className="h-full min-h-full p-2 pb-4">
      {renderPageWithBlanks(card.page, answerRevealed ? [] : [card.contentKey], card)}
    </div>
  );
}
