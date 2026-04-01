import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X, Eye, Settings2, Flag, List } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReviewQueueEntry, partitionSessionCards, promoteDueQueue, insertQueueEntries, getNextDueCountdownLabel } from '@/utils/reviewQueue';

export type AnswerDisplayMode = 'bottom' | 'tooltip' | 'inline';

interface SRSReviewSessionProps {
  cards: SRSCard[];
  onFinish: () => void;
  onNavigateToPage: (page: number) => void;
  renderCard: (card: SRSCard, answerRevealed: boolean, answerDisplayMode: AnswerDisplayMode) => React.ReactNode;
  portalName: string;
  renderAnswer?: (card: SRSCard) => React.ReactNode;
  defaultAnswerMode?: AnswerDisplayMode;
  answerModeOptions?: AnswerDisplayMode[];
  headerExtra?: React.ReactNode;
  /** When true, hide header/settings and show only content + bottom actions */
  focusMode?: boolean;
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
  focusMode = false,
}: SRSReviewSessionProps) {
  const rateCard = useSRSStore(s => s.rateCard);
  const toggleFlag = useSRSStore(s => s.toggleFlag);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerDisplayMode>(defaultAnswerMode);
  const isMobile = useIsMobile();

  // ── Dual-queue system ──
  // activeQueue: cards ready to show NOW, sorted by dueAt (oldest first)
  // delayedQueue: cards waiting for their dueAt to arrive
  const [activeQueue, setActiveQueue] = useState<ReviewQueueEntry[]>(() => partitionSessionCards(cards).activeQueue);
  const [delayedQueue, setDelayedQueue] = useState<ReviewQueueEntry[]>(() => partitionSessionCards(cards).delayedQueue);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalSeen, setTotalSeen] = useState(cards.length);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [ratingsMap, setRatingsMap] = useState<Map<string, SRSRating>>(new Map());
  const [nextDueCountdown, setNextDueCountdown] = useState<string | null>(null);
  const currentIdxRef = useRef(0);
  const nextOrderRef = useRef(cards.length);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  // Reset on new session
  useEffect(() => {
    const queues = partitionSessionCards(cards);
    setActiveQueue(queues.activeQueue);
    setDelayedQueue(queues.delayedQueue);
    nextOrderRef.current = queues.nextOrder;
    setCurrentIdx(0);
    setReviewedCount(0);
    setTotalSeen(cards.length);
    setReviewedIds(new Set());
    setRatingsMap(new Map());
    setNextDueCountdown(getNextDueCountdownLabel(queues.delayedQueue));
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [cards]);

  // ── Timer: promote delayed → active every 1s ──
  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      setDelayedQueue(prev => {
        if (prev.length === 0) {
          setNextDueCountdown(null);
          return prev;
        }

        const { readyQueue, delayedQueue: nextDelayedQueue } = promoteDueQueue(prev, now);
        setNextDueCountdown(getNextDueCountdownLabel(nextDelayedQueue, now));

        if (readyQueue.length > 0) {
          setActiveQueue(prevActive => {
            if (prevActive.length === 0) {
              setTotalSeen(s => s + readyQueue.length);
              return insertQueueEntries([], readyQueue);
            }

            const pinnedIdx = Math.min(currentIdxRef.current, prevActive.length - 1);
            const head = prevActive.slice(0, pinnedIdx + 1);
            const tail = prevActive.slice(pinnedIdx + 1);
            setTotalSeen(s => s + readyQueue.length);
            return [...head, ...insertQueueEntries(tail, readyQueue)];
          });
        }

        return readyQueue.length > 0 ? nextDelayedQueue : prev;
      });
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentEntry = activeQueue[currentIdx];
  const card = currentEntry?.card;

  const availableAnswerModes = useMemo(() => {
    if (!answerModeOptions.length) return ['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[];
    const uniq = Array.from(new Set(answerModeOptions));
    return uniq.length > 0 ? uniq : (['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[]);
  }, [answerModeOptions]);

  const cardInfoLabel = useMemo(() => {
    if (!card) return '';
    if (portalName === 'الغريب' && !answerRevealed) {
      return (card.meta.wordText as string) || 'كلمة غريب';
    }
    return card.label;
  }, [card, portalName, answerRevealed]);

  // Navigate to card's page
  useEffect(() => {
    if (card) onNavigateToPage(card.page);
  }, [card, onNavigateToPage]);

  // Reset answer state on card change
  useEffect(() => {
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [currentIdx, card?.id]);

  useEffect(() => {
    if (!availableAnswerModes.includes(answerMode)) setAnswerMode(availableAnswerModes[0]);
  }, [availableAnswerModes, answerMode]);

  useEffect(() => { setAnswerMode(defaultAnswerMode); }, [defaultAnswerMode]);

  const intervals = useMemo(() => card ? previewIntervals(card) : [], [card]);

  const handleRevealAnswer = useCallback(() => setAnswerRevealed(true), []);

  const handleRate = useCallback((rating: SRSRating, customInterval?: number) => {
    if (!card || !currentEntry) return;

    rateCard(card.id, rating, customInterval);

    const freshCard = useSRSStore.getState().cards.find(c => c.id === card.id);
    const nextReview = freshCard?.nextReview ?? 0;
    const now = Date.now();

    const baseActiveQueue = activeQueue.filter((_, i) => i !== currentIdx);
    const { readyQueue, delayedQueue: nextDelayedBase } = promoteDueQueue(delayedQueue, now);
    let nextActiveQueue = insertQueueEntries(baseActiveQueue, readyQueue);
    let nextDelayedQueue = nextDelayedBase;

    if (freshCard) {
      const updatedEntry: ReviewQueueEntry = {
        card: freshCard,
        dueAt: nextReview,
        order: nextOrderRef.current++,
      };

      if (nextReview > now) nextDelayedQueue = insertQueueEntries(nextDelayedQueue, [updatedEntry]);
      else nextActiveQueue = insertQueueEntries(nextActiveQueue, [updatedEntry]);
    }

    setActiveQueue(nextActiveQueue);
    setDelayedQueue(nextDelayedQueue);
    setNextDueCountdown(getNextDueCountdownLabel(nextDelayedQueue, now));
    setCurrentIdx(0);

    if (nextActiveQueue.length === 0 && nextDelayedQueue.length === 0) {
      setTimeout(() => onFinish(), 100);
    }

    setReviewedCount(c => c + 1);
    setReviewedIds(prev => new Set(prev).add(card.id));
    setRatingsMap(prev => {
      const m = new Map(prev);
      m.set(card.id, rating);
      return m;
    });
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [card, currentEntry, activeQueue, currentIdx, delayedQueue, rateCard, onFinish]);

  const goToCard = useCallback((idx: number) => {
    setActiveQueue(prev => {
      if (idx >= 0 && idx < prev.length) {
        setAnswerRevealed(false);
        setShowManualInterval(false);
        setCurrentIdx(idx);
      }
      return prev;
    });
  }, []);

  const switchAnswerMode = useCallback(() => {
    const ci = availableAnswerModes.indexOf(answerMode);
    setAnswerMode(availableAnswerModes[(ci + 1) % availableAnswerModes.length]);
  }, [answerMode, availableAnswerModes]);

  // ── Waiting state: no active cards but delayed cards exist ──
  if (!card && delayedQueue.length > 0) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground space-y-3" dir="rtl">
        <p className="text-lg">⏳ في انتظار البطاقات المعلقة...</p>
        {nextDueCountdown && (
          <p className="text-2xl font-bold text-primary animate-pulse">{nextDueCountdown}</p>
        )}
        <p className="text-sm">ستعود البطاقات تلقائياً عند حلول موعد مراجعتها</p>
        <p className="text-xs text-muted-foreground/60">تمت مراجعة {reviewedCount} بطاقة</p>
        <Button variant="outline" onClick={onFinish} className="mt-4 font-arabic">إنهاء الجلسة</Button>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground" dir="rtl">
        <p>لا توجد بطاقات للمراجعة</p>
        <Button variant="outline" onClick={onFinish} className="mt-4 font-arabic">إغلاق</Button>
      </div>
    );
  }

  const total = activeQueue.length;
  const progress = totalSeen > 0 ? (reviewedCount / totalSeen) * 100 : 0;

  // Index content
  const indexContent = (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1 font-arabic" dir="rtl">
        <p className="text-xs text-muted-foreground mb-2">{reviewedCount} تمت مراجعتها · {delayedQueue.length} معلقة</p>
        {activeQueue.map((entry, i) => {
          const queuedCard = entry.card;
          return (
          <button
            key={`${queuedCard.id}_${i}`}
            onClick={() => { goToCard(i); setShowIndex(false); }}
            className={`w-full text-right px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
              i === currentIdx ? 'bg-primary/10 text-primary font-bold' :
              reviewedIds.has(queuedCard.id) ? (ratingsMap.get(queuedCard.id)! >= 3 ? 'text-green-600 bg-green-50 dark:bg-green-950/20' : 'text-red-500 bg-red-50 dark:bg-red-950/20') :
              'hover:bg-accent text-foreground'
            }`}
          >
            <span className="w-5 text-center text-[10px] text-muted-foreground">{i + 1}</span>
            <span className="truncate flex-1">
              {portalName === 'الغريب'
                ? (queuedCard.meta.wordText as string || queuedCard.label)
                : `${queuedCard.meta.surahName || ''} ص${queuedCard.page}`}
            </span>
            {queuedCard.flagged && <Flag className="w-3 h-3 text-orange-500 shrink-0" />}
          </button>
        )})}
        {delayedQueue.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground mt-3 mb-1">⏳ معلقة ({delayedQueue.length})</p>
            {delayedQueue.map((entry, i) => {
              const remainSec = Math.max(0, Math.ceil((entry.dueAt - Date.now()) / 1000));
              const label = remainSec < 60 ? `${remainSec} ث` : `${Math.ceil(remainSec / 60)} د`;
              return (
                <div key={`delayed_${entry.card.id}_${i}`} className="w-full text-right px-3 py-1.5 text-[10px] text-muted-foreground/60 flex items-center gap-2">
                  <span className="truncate flex-1">
                    {portalName === 'الغريب'
                      ? (entry.card.meta.wordText as string || entry.card.label)
                      : `ص${entry.card.page}`}
                  </span>
                  <span className="text-primary/60">{label}</span>
                </div>
              );
            })}
          </>
        )}
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
        {/* Header — hidden in focus mode */}
        {!focusMode && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-arabic text-sm font-bold text-primary">{portalName} — مراجعة</span>
              <span className="text-xs text-muted-foreground font-arabic">
                {reviewedCount}/{totalSeen}
                {delayedQueue.length > 0 ? ` · ⏳${delayedQueue.length}` : ''}
                {nextDueCountdown ? ` · ⏱${nextDueCountdown}` : ''}
              </span>
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
        )}

        <Progress value={progress} className="h-1 rounded-none shrink-0" />

        {/* Card content */}
        <div className="flex-1 overflow-auto">
          {renderCard(card, answerRevealed, answerMode)}
        </div>

        {/* Answer panel (bottom mode) */}
        {answerRevealed && answerMode === 'bottom' && renderAnswer && (
          <div className="border-t border-border bg-accent/30 px-3 py-3 animate-fade-in shrink-0">
            {renderAnswer(card)}
          </div>
        )}

        {/* Card info — compact in focus mode */}
        {!focusMode && (
          <div className="px-3 py-1 text-center shrink-0">
            <p className="font-arabic text-sm text-muted-foreground">{cardInfoLabel}</p>
            {card.lastReview > 0 && (
              <p className="text-[10px] text-muted-foreground/60 font-arabic">
                آخر مراجعة: {new Date(card.lastReview).toLocaleDateString('ar-SA')} · الفاصل: {formatInterval(card.interval)}
                {card.successCount != null && ` · ✓${card.successCount} ✗${card.failCount || 0}`}
              </p>
            )}
          </div>
        )}

        {/* Actions — always visible */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-3 space-y-2 shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          {/* Focus mode: minimal top bar with exit + counter */}
          {focusMode && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-arabic">
                {currentIdx + 1}/{total}
                {delayedQueue.length > 0 && ` · ⏳${delayedQueue.length}`}
                {nextDueCountdown && ` · ⏱${nextDueCountdown}`}
              </span>
              <button onClick={onFinish} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!answerRevealed ? (
            <div className="space-y-2">
              <Button onClick={handleRevealAnswer} className="w-full font-arabic text-base gap-2" size="lg">
                <Eye className="w-5 h-5" />
                إظهار الإجابة
              </Button>
              {!focusMode && availableAnswerModes.length > 1 && (
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
              {/* Smart Timing Buttons */}
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

              {/* Difficulty Rating — collapsed */}
              {!focusMode && (
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
                            if (action === 'flag' && card) toggleFlag(card.id);
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
              )}
            </>
          )}

          {/* Quick index dots — only outside focus mode */}
          {!focusMode && total <= 50 && (
            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {activeQueue.map((entry, i) => (
                <button
                  key={`dot_${i}`}
                  onClick={() => goToCard(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentIdx ? 'bg-primary scale-125' :
                    reviewedIds.has(entry.card.id) ? (ratingsMap.get(entry.card.id)! >= 3 ? 'bg-green-400' : 'bg-red-400') :
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
