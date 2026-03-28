import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X, Eye, Settings2, Flag, List } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

export type AnswerDisplayMode = 'bottom' | 'tooltip' | 'inline';

interface SRSReviewSessionProps {
  cards: SRSCard[];
  onFinish: () => void;
  onNavigateToPage: (page: number) => void;
  /** Render the card content. answerRevealed is ALWAYS false until user presses "show answer" */
  renderCard: (card: SRSCard, answerRevealed: boolean, answerDisplayMode: AnswerDisplayMode) => React.ReactNode;
  portalName: string;
  /** Optional: render answer in bottom panel (used when answerDisplayMode === 'bottom') */
  renderAnswer?: (card: SRSCard) => React.ReactNode;
}

export function SRSReviewSession({
  cards,
  onFinish,
  onNavigateToPage,
  renderCard,
  portalName,
  renderAnswer,
}: SRSReviewSessionProps) {
  const rateCard = useSRSStore(s => s.rateCard);
  const toggleFlag = useSRSStore(s => s.toggleFlag);
  const [currentIdx, setCurrentIdx] = useState(0);
  // ⚠️ FIX: answer is ALWAYS hidden initially. Never auto-reveal.
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [manualDays, setManualDays] = useState('3');
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [ratings, setRatings] = useState<Map<number, SRSRating>>(new Map());
  const [showIndex, setShowIndex] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerDisplayMode>('bottom');
  const isMobile = useIsMobile();

  const card = cards[currentIdx];
  const total = cards.length;
  const doneCount = reviewed.size;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  // Navigate to card's page when card changes
  useEffect(() => {
    if (card) onNavigateToPage(card.page);
  }, [card, onNavigateToPage]);

  // ⚠️ CRITICAL: Reset answer state on EVERY card change
  useEffect(() => {
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [currentIdx]);

  const intervals = useMemo(() => {
    if (!card) return [];
    return previewIntervals(card);
  }, [card]);

  const handleRevealAnswer = useCallback(() => {
    setAnswerRevealed(true);
  }, []);

  const handleRate = useCallback((rating: SRSRating, customInterval?: number) => {
    if (!card) return;
    rateCard(card.id, rating, customInterval);
    setReviewed(prev => new Set(prev).add(currentIdx));
    setRatings(prev => new Map(prev).set(currentIdx, rating));

    // Move to next unreviewed card
    const nextUnreviewed = cards.findIndex((_, i) => i > currentIdx && !reviewed.has(i) && i !== currentIdx);
    if (nextUnreviewed >= 0) {
      setCurrentIdx(nextUnreviewed);
    } else {
      const prevUnreviewed = cards.findIndex((_, i) => i < currentIdx && !reviewed.has(i));
      if (prevUnreviewed >= 0) {
        setCurrentIdx(prevUnreviewed);
      } else {
        onFinish();
      }
    }
  }, [card, currentIdx, cards, reviewed, rateCard, onFinish]);

  const goToCard = useCallback((idx: number) => {
    if (idx >= 0 && idx < total) setCurrentIdx(idx);
  }, [total]);

  if (!card) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground">
        <p>لا توجد بطاقات للمراجعة</p>
        <Button variant="outline" onClick={onFinish} className="mt-4 font-arabic">إغلاق</Button>
      </div>
    );
  }

  // Index content (shared between drawer/sidebar)
  const indexContent = (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1 font-arabic" dir="rtl">
        <p className="text-xs text-muted-foreground mb-2">{doneCount}/{total} تمت مراجعتها</p>
        {cards.map((c, i) => (
          <button
            key={i}
            onClick={() => { goToCard(i); setShowIndex(false); }}
            className={`w-full text-right px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
              i === currentIdx ? 'bg-primary/10 text-primary font-bold' :
              reviewed.has(i) ? (ratings.get(i)! >= 3 ? 'text-green-600 bg-green-50 dark:bg-green-950/20' : 'text-red-500 bg-red-50 dark:bg-red-950/20') :
              'hover:bg-accent text-foreground'
            }`}
          >
            <span className="w-5 text-center text-[10px] text-muted-foreground">{i + 1}</span>
            <span className="truncate flex-1">
              {portalName === 'الغريب'
                ? (c.meta.wordText as string || c.label)
                : `${c.meta.surahName || ''} ص${c.page}`
              }
            </span>
            {c.flagged && <Flag className="w-3 h-3 text-orange-500 shrink-0" />}
            {reviewed.has(i) && <span className="text-[10px]">{ratings.get(i)! >= 3 ? '✓' : '✗'}</span>}
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex h-full" dir="rtl">
      {/* Desktop sidebar index */}
      {showIndex && !isMobile && (
        <div className="w-56 shrink-0 border-l border-border bg-card h-full overflow-hidden">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-arabic font-bold text-muted-foreground">الفهرس</span>
            <button onClick={() => setShowIndex(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          {indexContent}
        </div>
      )}

      {/* Mobile drawer index */}
      {isMobile && (
        <Drawer open={showIndex} onOpenChange={setShowIndex}>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader>
              <DrawerTitle className="font-arabic text-sm">فهرس الجلسة</DrawerTitle>
            </DrawerHeader>
            {indexContent}
          </DrawerContent>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-arabic text-sm font-bold text-primary">{portalName} — مراجعة</span>
            <span className="text-xs text-muted-foreground font-arabic">{doneCount}/{total}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowIndex(!showIndex)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => toggleFlag(card.id)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${card.flagged ? 'text-orange-500' : 'hover:bg-accent text-muted-foreground'}`}>
              <Flag className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => goToCard(currentIdx - 1)} disabled={currentIdx <= 0} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-arabic text-muted-foreground min-w-[3rem] text-center">{currentIdx + 1} / {total}</span>
            <button onClick={() => goToCard(currentIdx + 1)} disabled={currentIdx >= total - 1} className="nav-button w-7 h-7 rounded-full disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onFinish} className="nav-button w-7 h-7 rounded-full mr-2"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <Progress value={progress} className="h-1 rounded-none shrink-0" />

        {/* Card content — answer is NEVER rendered until answerRevealed is true */}
        <div className="flex-1 overflow-auto">
          {renderCard(card, answerRevealed, answerMode)}
        </div>

        {/* Answer panel (bottom mode) — only when revealed */}
        {answerRevealed && answerMode === 'bottom' && renderAnswer && (
          <div className="border-t border-border bg-accent/30 px-3 py-3 animate-fade-in shrink-0">
            {renderAnswer(card)}
          </div>
        )}

        {/* Card info */}
        <div className="px-3 py-1 text-center shrink-0">
          <p className="font-arabic text-sm text-muted-foreground">{card.label}</p>
          {card.lastReview > 0 && (
            <p className="text-[10px] text-muted-foreground/60 font-arabic">
              آخر مراجعة: {new Date(card.lastReview).toLocaleDateString('ar-SA')} · الفاصل: {formatInterval(card.interval)}
              {card.successCount != null && ` · ✓${card.successCount} ✗${card.failCount || 0}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-3 space-y-2 shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          {!answerRevealed ? (
            <div className="space-y-2">
              <Button onClick={handleRevealAnswer} className="w-full font-arabic text-base gap-2" size="lg">
                <Eye className="w-5 h-5" />
                إظهار الإجابة
              </Button>
              {/* Settings row */}
              <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground font-arabic">
                <button onClick={() => setAnswerMode(answerMode === 'bottom' ? 'tooltip' : answerMode === 'tooltip' ? 'inline' : 'bottom')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Settings2 className="w-3 h-3" />
                  عرض: {answerMode === 'bottom' ? 'أسفل' : answerMode === 'tooltip' ? 'عند الكلمة' : 'في السطر'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {RATING_OPTIONS.map(({ rating, label, icon }) => {
                  const intervalInfo = intervals.find(i => i.rating === rating);
                  return (
                    <button
                      key={rating}
                      onClick={() => handleRate(rating)}
                      className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <span className="text-lg">{icon}</span>
                      <span className="font-arabic text-xs font-bold">{label}</span>
                      {intervalInfo && (
                        <span className="text-[9px] text-muted-foreground font-arabic">{formatInterval(intervalInfo.interval)}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setShowManualInterval(!showManualInterval)} className="text-xs text-muted-foreground font-arabic flex items-center gap-1 hover:text-foreground transition-colors">
                  <Settings2 className="w-3 h-3" />
                  تعديل المدة يدوياً
                </button>
              </div>

              {showManualInterval && (
                <div className="flex items-center justify-center gap-2 animate-fade-in">
                  <Select value={manualDays} onValueChange={setManualDays}>
                    <SelectTrigger className="w-32 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.007">١٠ دقائق</SelectItem>
                      <SelectItem value="0.04">ساعة</SelectItem>
                      <SelectItem value="1">يوم</SelectItem>
                      <SelectItem value="3">٣ أيام</SelectItem>
                      <SelectItem value="7">أسبوع</SelectItem>
                      <SelectItem value="14">أسبوعان</SelectItem>
                      <SelectItem value="30">شهر</SelectItem>
                      <SelectItem value="90">٣ أشهر</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="font-arabic text-xs h-8" onClick={() => handleRate(3, parseFloat(manualDays))}>
                    تطبيق
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Quick index dots */}
          {total <= 50 && (
            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToCard(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentIdx ? 'bg-primary scale-125' :
                    reviewed.has(i) ? (ratings.get(i)! >= 3 ? 'bg-green-400' : 'bg-red-400') :
                    'bg-muted-foreground/20'
                  }`}
                  title={`بطاقة ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
