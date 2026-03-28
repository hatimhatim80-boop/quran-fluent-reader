import React, { useState, useCallback, useMemo } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, RotateCcw, Download, Upload, Trash2, BookOpen, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { QuranPage } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';

interface TahfeezSRSPanelProps {
  currentPage: number;
  totalPages: number;
  pageData: QuranPage | undefined;
  onNavigateToPage: (page: number) => void;
  /** Render page with specific blanked keys (for ayah cards) or stored words (for word cards) */
  renderPageWithBlanks: (page: number, blankedKeys: string[], card: SRSCard) => React.ReactNode;
}

/** Build a card ID for an ayah */
function ayahCardId(page: number, surah: number, ayah: number) {
  return `tahfeez_ayah_${page}_${surah}_${ayah}`;
}

/** Build a card ID for stored words on a page */
function storedWordsCardId(page: number) {
  return `tahfeez_words_${page}`;
}

export function TahfeezSRSPanel({
  currentPage,
  totalPages,
  pageData,
  onNavigateToPage,
  renderPageWithBlanks,
}: TahfeezSRSPanelProps) {
  const { addCard, hasCard, getDueCards, getDueCount, cards, exportData, importData, clearAll } = useSRSStore();
  const storedItems = useTahfeezStore(s => s.storedItems);
  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionSize, setSessionSize] = useState<'all' | '10' | '20' | '50'>('all');
  const [cardType, setCardType] = useState<'ayah' | 'words'>('ayah');

  const dueCount = getDueCount(cardType === 'ayah' ? 'tahfeez-ayah' : 'tahfeez-words');
  const totalCards = cards.filter(c => c.type === (cardType === 'ayah' ? 'tahfeez-ayah' : 'tahfeez-words')).length;

  // Parse ayahs from current page
  const pageAyahs = useMemo(() => {
    if (!pageData) return [];
    const lines = pageData.text.split('\n');
    const ayahs: { surah: number; ayah: number; text: string }[] = [];
    let currentSurah = 1;

    for (const line of lines) {
      if (line.startsWith('سُورَةُ') || line.startsWith('سورة ')) continue;
      const normalized = normalizeArabic(line);
      if (normalized.includes('بسم الله الرحمن الرحيم') || normalized.includes('بسم الله')) continue;

      // Extract verse numbers from line
      const verseMatches = line.match(/[\u06F0-\u06F9\u0660-\u0669\d]+/g);
      if (verseMatches) {
        // Simple: add one entry per verse boundary found
        for (const vm of verseMatches) {
          const num = parseInt(vm.replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
            .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)));
          if (!isNaN(num) && num > 0 && num < 300) {
            ayahs.push({ surah: currentSurah, ayah: num, text: line.slice(0, 50) + '…' });
          }
        }
      }
    }
    return ayahs;
  }, [pageData]);

  // Add ayahs from current page
  const addPageAyahs = useCallback(() => {
    let added = 0;
    pageAyahs.forEach(a => {
      const id = ayahCardId(currentPage, a.surah, a.ayah);
      if (!hasCard(id)) {
        addCard({
          id,
          type: 'tahfeez-ayah',
          page: currentPage,
          contentKey: `${a.surah}_${a.ayah}`,
          label: `آية ${a.ayah} — ص${currentPage}`,
          meta: { surah: a.surah, ayah: a.ayah, preview: a.text },
        });
        added++;
      }
    });
    if (added > 0) toast.success(`تمت إضافة ${added} آية للمراجعة`);
    else toast.info('جميع الآيات مضافة بالفعل');
  }, [pageAyahs, currentPage, addCard, hasCard]);

  // Add stored words for current page
  const addStoredWords = useCallback(() => {
    const pageItems = storedItems.filter(i => i.data.page === currentPage);
    if (pageItems.length === 0) {
      toast.info('لا توجد كلمات مخزنة في هذه الصفحة');
      return;
    }
    const id = storedWordsCardId(currentPage);
    if (hasCard(id)) {
      toast.info('الصفحة مضافة بالفعل');
      return;
    }
    addCard({
      id,
      type: 'tahfeez-words',
      page: currentPage,
      contentKey: `page_${currentPage}`,
      label: `كلمات محفوظة — ص${currentPage} (${pageItems.length})`,
      meta: { itemCount: pageItems.length },
    });
    toast.success(`تمت إضافة صفحة ${currentPage} (${pageItems.length} كلمة)`);
  }, [storedItems, currentPage, addCard, hasCard]);

  const startReview = useCallback(() => {
    const type = cardType === 'ayah' ? 'tahfeez-ayah' : 'tahfeez-words';
    const maxCount = sessionSize === 'all' ? undefined : parseInt(sessionSize);
    const due = getDueCards(type as SRSCard['type'], maxCount);
    if (due.length === 0) {
      toast.info('لا توجد بطاقات مستحقة للمراجعة الآن');
      return;
    }
    setSessionCards(due);
    setSessionMode('review');
  }, [cardType, sessionSize, getDueCards]);

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
      if (importData(text)) {
        toast.success('تم الاستيراد بنجاح');
      } else {
        toast.error('فشل الاستيراد');
      }
    };
    input.click();
  }, [importData]);

  if (sessionMode === 'review') {
    return (
      <SRSReviewSession
        cards={sessionCards}
        onFinish={() => setSessionMode('setup')}
        onNavigateToPage={onNavigateToPage}
        portalName="التحفيظ"
        renderCard={(card, revealed) => (
          <div className="p-2">
            {renderPageWithBlanks(card.page, [], card)}
          </div>
        )}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 font-arabic" dir="rtl">
      {/* Card type selector */}
      <div className="flex gap-2">
        <Button
          variant={cardType === 'ayah' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1 font-arabic text-xs"
          onClick={() => setCardType('ayah')}
        >
          <BookOpen className="w-3 h-3" />
          آيات
        </Button>
        <Button
          variant={cardType === 'words' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1 font-arabic text-xs"
          onClick={() => setCardType('words')}
        >
          <Layers className="w-3 h-3" />
          كلمات مخزنة
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
          <p className="text-2xl font-bold text-green-500">{totalCards - dueCount}</p>
          <p className="text-xs text-muted-foreground">مراجَعة</p>
        </div>
      </div>

      {/* Add cards */}
      <div className="space-y-2">
        {cardType === 'ayah' ? (
          <Button onClick={addPageAyahs} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" />
            إضافة آيات الصفحة الحالية ({pageAyahs.length})
          </Button>
        ) : (
          <Button onClick={addStoredWords} variant="outline" className="w-full gap-2 font-arabic">
            <Plus className="w-4 h-4" />
            إضافة كلمات الصفحة المخزنة
          </Button>
        )}
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
              <SelectItem value="all">الكل ({dueCount})</SelectItem>
              <SelectItem value="10">١٠</SelectItem>
              <SelectItem value="20">٢٠</SelectItem>
              <SelectItem value="50">٥٠</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={startReview} disabled={dueCount === 0} className="w-full gap-2 font-arabic" size="lg">
          <RotateCcw className="w-4 h-4" />
          بدء المراجعة ({dueCount})
        </Button>
      </div>

      {/* Import/Export */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleExport}>
          <Download className="w-3 h-3" />
          تصدير
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1 font-arabic text-xs" onClick={handleImport}>
          <Upload className="w-3 h-3" />
          استيراد
        </Button>
        {totalCards > 0 && (
          <Button variant="outline" size="sm" className="gap-1 font-arabic text-xs text-destructive" onClick={() => {
            if (confirm('هل تريد حذف جميع البطاقات؟')) {
              clearAll();
              toast.success('تم الحذف');
            }
          }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
