import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X, Eye, Settings2, Flag, List } from 'lucide-react';
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
  defaultAnswerMode?: AnswerDisplayMode;
  answerModeOptions?: AnswerDisplayMode[];
  headerExtra?: React.ReactNode;
}

const ANSWER_MODE_LABEL: Record<AnswerDisplayMode, string> = {
  bottom: 'أسفل',
  tooltip: 'عند الكلمة',
  inline: 'في السطر',
};

export function SRSReviewSession({
  cards,
  onFinish,
  onNavigateToPage,
  renderCard,
  portalName,
  renderAnswer,
  defaultAnswerMode = 'bottom',
  answerModeOptions = ['bottom', 'tooltip', 'inline'],
  headerExtra,
}: SRSReviewSessionProps) {
  const rateCard = useSRSStore(s => s.rateCard);
  const toggleFlag = useSRSStore(s => s.toggleFlag);
  const storeCards = useSRSStore(s => s.cards);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [ratings, setRatings] = useState<Map<number, SRSRating>>(new Map());
  const [showIndex, setShowIndex] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerDisplayMode>(defaultAnswerMode);
  const isMobile = useIsMobile();

  // Live session cards — starts with initial cards, grows as re-due cards come back
  const [liveCards, setLiveCards] = useState<SRSCard[]>(cards);
  const reviewedIdsRef = useRef<Map<string, number>>(new Map()); // cardId -> nextReview timestamp
  const [nextDueCountdown, setNextDueCountdown] = useState<string | null>(null);

  // Reset live cards when session cards change (new session)
  useEffect(() => {
    setLiveCards(cards);
    reviewedIdsRef.current = new Map();
    setNextDueCountdown(null);
  }, [cards]);

  // Poll every 5 seconds to check if any reviewed cards have become due again
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const reDueIds: string[] = [];
      let nearestFuture = Infinity;

      reviewedIdsRef.current.forEach((nextReview, cardId) => {
        if (nextReview <= now) {
          reDueIds.push(cardId);
        } else {
          nearestFuture = Math.min(nearestFuture, nextReview);
        }
      });

      // Update countdown display
      if (nearestFuture < Infinity) {
        const remainMs = nearestFuture - now;
        const remainSec = Math.ceil(remainMs / 1000);
        if (remainSec <= 0) {
          setNextDueCountdown(null);
        } else if (remainSec < 60) {
          setNextDueCountdown(`${remainSec} ث`);
        } else {
          const mins = Math.ceil(remainSec / 60);
          setNextDueCountdown(`${mins} د`);
        }
      } else if (reDueIds.length === 0) {
        setNextDueCountdown(null);
      }

      if (reDueIds.length === 0) return;

      // Re-inject due cards at the end of the session
      setLiveCards(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const freshCards = storeCards.filter(c => reDueIds.includes(c.id) && !existingIds.has(c.id));
        // Also update existing cards in case they were already in the list
        const updated = prev.map(c => {
          const fresh = storeCards.find(sc => sc.id === c.id);
          return fresh || c;
        });
        return [...updated, ...freshCards];
      });

      // Remove from tracking
      reDueIds.forEach(id => reviewedIdsRef.current.delete(id));
    }, 5000);

    return () => clearInterval(interval);
  }, [storeCards]);

  const availableAnswerModes = useMemo(() => {
    if (!answerModeOptions.length) return ['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[];
    const uniq = Array.from(new Set(answerModeOptions));
    return uniq.length > 0 ? uniq : (['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[]);
  }, [answerModeOptions]);

  const card = liveCards[currentIdx];
  const total = liveCards.length;
  const doneCount = reviewed.size;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;
  const cardInfoLabel = useMemo(() => {
    if (!card) return '';
    if (portalName === 'الغريب' && !answerRevealed) {
      return (card.meta.wordText as string) || 'كلمة غريب';
    }
    return card.label;
  }, [card, portalName, answerRevealed]);

  // Navigate to card's page when card changes
  useEffect(() => {
    if (card) onNavigateToPage(card.page);
  }, [card, onNavigateToPage]);

  // Reset answer state on EVERY card change
  useEffect(() => {
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [currentIdx]);

  useEffect(() => {
    if (!availableAnswerModes.includes(answerMode)) {
      setAnswerMode(availableAnswerModes[0]);
    }
  }, [availableAnswerModes, answerMode]);

  useEffect(() => {
    setCurrentIdx(0);
    setAnswerRevealed(false);
    setShowManualInterval(false);
    setReviewed(new Set());
    setRatings(new Map());
    setAnswerMode(defaultAnswerMode);
  }, [cards, defaultAnswerMode]);

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

    // Track this card for re-due detection
    const updatedCard = useSRSStore.getState().cards.find(c => c.id === card.id);
    if (updatedCard && updatedCard.nextReview > Date.now()) {
      reviewedIdsRef.current.set(card.id, updatedCard.nextReview);
    }

    const nextReviewed = new Set(reviewed);
    nextReviewed.add(currentIdx);
    const nextRatings = new Map(ratings);
    nextRatings.set(currentIdx, rating);

    setReviewed(nextReviewed);
    setRatings(nextRatings);
    setAnswerRevealed(false);
    setShowManualInterval(false);

    let nextUnreviewed = liveCards.findIndex((_, i) => i > currentIdx && !nextReviewed.has(i));
    if (nextUnreviewed < 0) {
      nextUnreviewed = liveCards.findIndex((_, i) => i < currentIdx && !nextReviewed.has(i));
    }

    if (nextUnreviewed >= 0) {
      setCurrentIdx(nextUnreviewed);
      return;
    }

    // Check if there are pending re-due cards coming soon
    if (reviewedIdsRef.current.size > 0) {
      // Don't finish — wait for re-due cards
      return;
    }

    onFinish();
  }, [card, currentIdx, liveCards, reviewed, ratings, rateCard, onFinish]);

  const goToCard = useCallback((idx: number) => {
    if (idx >= 0 && idx < total) {
      setAnswerRevealed(false);
      setShowManualInterval(false);
      setCurrentIdx(idx);
    }
  }, [total]);

  const switchAnswerMode = useCallback(() => {
    const currentIndex = availableAnswerModes.indexOf(answerMode);
    const nextIndex = (currentIndex + 1) % availableAnswerModes.length;
    setAnswerMode(availableAnswerModes[nextIndex]);
  }, [answerMode, availableAnswerModes]);

  if (!card) {
    // If there are pending re-due cards, show waiting state
    if (reviewedIdsRef.current.size > 0) {
      return (
        <div className="text-center py-8 font-arabic text-muted-foreground space-y-3">
          <p className="text-lg">⏳ في انتظار البطاقات المعلقة...</p>
          {nextDueCountdown && (
            <p className="text-2xl font-bold text-primary animate-pulse">{nextDueCountdown}</p>
          )}
          <p className="text-sm">ستعود البطاقات تلقائياً عند حلول موعد مراجعتها</p>
          <Button variant="outline" onClick={onFinish} className="mt-4 font-arabic">إنهاء الجلسة</Button>
        </div>
      );
    }
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
        {liveCards.map((c, i) => (
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
            {headerExtra}
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
          <p className="font-arabic text-sm text-muted-foreground">{cardInfoLabel}</p>
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
              {availableAnswerModes.length > 1 && (
                <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground font-arabic">
                  <button onClick={switchAnswerMode} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Settings2 className="w-3 h-3" />
                    عرض: {ANSWER_MODE_LABEL[answerMode]}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Smart Timing Buttons — PRIMARY */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-arabic text-center font-bold">⏱ مدة الإعادة الذكية</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '١ دقيقة', days: 1 / 1440 },
                    { label: '٥ دقائق', days: 5 / 1440 },
                    { label: '١٠ دقائق', days: 10 / 1440 },
                    { label: 'ساعة', days: 1 / 24 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      onClick={() => handleRate(3, days)}
                      className="py-2.5 px-2 rounded-lg border-2 border-primary/30 bg-primary/5 text-sm font-arabic font-bold hover:bg-primary/15 hover:border-primary/50 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {showManualInterval ? (
                  <div className="grid grid-cols-5 gap-1.5 animate-fade-in">
                    {[
                      { label: 'يوم', days: 1 },
                      { label: '٣ أيام', days: 3 },
                      { label: 'أسبوع', days: 7 },
                      { label: 'أسبوعان', days: 14 },
                      { label: 'شهر', days: 30 },
                    ].map(({ label, days }) => (
                      <button
                        key={days}
                        onClick={() => handleRate(3, days)}
                        className="py-2 px-1 rounded-md border border-border text-[11px] font-arabic hover:bg-accent transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button onClick={() => setShowManualInterval(true)} className="text-xs text-primary font-arabic hover:underline">
                      المزيد من المدد ←
                    </button>
                  </div>
                )}
              </div>

              {/* Difficulty / General Rating — SECONDARY (collapsed) */}
              <details className="group">
                <summary className="text-[10px] text-muted-foreground font-arabic text-center cursor-pointer hover:text-foreground transition-colors list-none flex items-center justify-center gap-1">
                  <span>تقييم إضافي (اختياري)</span>
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {RATING_OPTIONS.map(({ rating, label, icon }) => {
                      const intervalInfo = intervals.find(i => i.rating === rating);
                      return (
                        <button
                          key={rating}
                          onClick={() => handleRate(rating)}
                          className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <span className="text-base">{icon}</span>
                          <span className="font-arabic text-[10px]">{label}</span>
                          {intervalInfo && (
                            <span className="text-[8px] text-muted-foreground font-arabic">{formatInterval(intervalInfo.interval)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      { label: 'مهمة', rating: 3 as SRSRating, action: 'flag', icon: '⭐' },
                      { label: 'ضعيفة', rating: 1 as SRSRating, days: 10 / 1440, icon: '😓' },
                      { label: 'كررها', rating: 0 as SRSRating, days: 1 / 1440, icon: '🔄' },
                      { label: 'تثبيت', rating: 5 as SRSRating, days: 90, icon: '📌' },
                    ].map(({ label, rating, days, action, icon }) => (
                      <button
                        key={label}
                        onClick={() => {
                          if (action === 'flag' && card) {
                            toggleFlag(card.id);
                          }
                          handleRate(rating, days);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-arabic hover:bg-accent transition-colors"
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </details>
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
