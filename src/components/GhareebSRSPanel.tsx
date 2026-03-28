import React, { useState, useMemo, useCallback } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { SRSReviewSession } from './SRSReviewSession';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GhareebWord } from '@/types/quran';
import { BookOpen, Plus, RotateCcw, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface GhareebSRSPanelProps {
  /** All ghareeb words on current page */
  pageWords: GhareebWord[];
  currentPage: number;
  /** Navigate to a page */
  onNavigateToPage: (page: number) => void;
  /** Render a page with a specific word highlighted */
  renderPageWithHighlight: (page: number, wordKey: string | null) => React.ReactNode;
}

export function GhareebSRSPanel({
  pageWords,
  currentPage,
  onNavigateToPage,
  renderPageWithHighlight,
}: GhareebSRSPanelProps) {
  const { addCard, hasCard, getDueCards, getDueCount, cards, exportData, importData, clearAll } = useSRSStore();
  const [sessionMode, setSessionMode] = useState<'setup' | 'review'>('setup');
  const [sessionCards, setSessionCards] = useState<SRSCard[]>([]);
  const [sessionSize, setSessionSize] = useState<'all' | '10' | '20' | '50'>('all');
  const [showMeaning, setShowMeaning] = useState(false);

  const dueCount = getDueCount('ghareeb');
  const totalCards = cards.filter(c => c.type === 'ghareeb').length;

  // Add all words on current page as cards
  const addPageWords = useCallback(() => {
    let added = 0;
    pageWords.forEach(w => {
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
        added++;
      }
    });
    if (added > 0) toast.success(`تمت إضافة ${added} كلمة للمراجعة`);
    else toast.info('جميع الكلمات مضافة بالفعل');
  }, [pageWords, addCard, hasCard]);

  const startReview = useCallback(() => {
    const maxCount = sessionSize === 'all' ? undefined : parseInt(sessionSize);
    const due = getDueCards('ghareeb', maxCount);
    if (due.length === 0) {
      toast.info('لا توجد بطاقات مستحقة للمراجعة الآن');
      return;
    }
    setSessionCards(due);
    setSessionMode('review');
  }, [sessionSize, getDueCards]);

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
        portalName="الغريب"
        renderCard={(card, revealed) => (
          <div className="p-2">
            {renderPageWithHighlight(card.page, card.contentKey)}
            {revealed && (
              <div className="mt-3 mx-auto max-w-md bg-accent/50 border border-border rounded-xl p-4 text-center animate-fade-in">
                <p className="font-arabic text-lg font-bold text-primary" dir="rtl">
                  {card.meta.wordText as string}
                </p>
                <p className="font-arabic text-base text-foreground mt-1" dir="rtl">
                  {card.meta.meaning as string}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-arabic">
                  {card.meta.surahName as string} — آية {card.meta.verseNumber as number}
                </p>
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
          <p className="text-2xl font-bold text-orange-500">{dueCount}</p>
          <p className="text-xs text-muted-foreground">مستحقة الآن</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{totalCards - dueCount}</p>
          <p className="text-xs text-muted-foreground">تمت مراجعتها</p>
        </div>
      </div>

      {/* Add words */}
      <div className="space-y-2">
        <Button onClick={addPageWords} variant="outline" className="w-full gap-2 font-arabic">
          <Plus className="w-4 h-4" />
          إضافة كلمات الصفحة الحالية ({pageWords.length} كلمة)
        </Button>
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
          بدء المراجعة ({dueCount} بطاقة)
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
