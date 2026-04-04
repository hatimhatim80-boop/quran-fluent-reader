import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { useReviewSessionStore } from '@/stores/reviewSessionStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ReviewCardIndex } from './ReviewCardIndex';
import { Ban, ChevronLeft, ChevronRight, X, Eye, Settings2, Flag, List, Archive, ArchiveRestore } from 'lucide-react';
import { ReviewQueueEntry, partitionSessionCards, promoteDueQueue, getNextDueCountdownLabel } from '@/utils/reviewQueue';

export type AnswerDisplayMode = 'bottom' | 'tooltip' | 'inline';

interface SRSReviewSessionProps {
  cards: SRSCard[];
  sessionId?: string;
  sessionName?: string;
  onFinish: () => void;
  onNavigateToPage: (page: number) => void;
  renderCard: (card: SRSCard, answerRevealed: boolean, answerDisplayMode: AnswerDisplayMode) => React.ReactNode;
  portalName: string;
  renderAnswer?: (card: SRSCard) => React.ReactNode;
  defaultAnswerMode?: AnswerDisplayMode;
  answerModeOptions?: AnswerDisplayMode[];
  headerExtra?: React.ReactNode;
  focusMode?: boolean;
}

const ANSWER_MODE_LABEL: Record<AnswerDisplayMode, string> = {
  bottom: 'أسفل',
  tooltip: 'عند الكلمة',
  inline: 'في السطر',
};

export function SRSReviewSession({
  cards,
  sessionId,
  sessionName,
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
  const archiveCard = useSRSStore(s => s.archiveCard);
  const unarchiveCard = useSRSStore(s => s.unarchiveCard);
  const updateSessionMeta = useReviewSessionStore(s => s.updateSession);

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerDisplayMode>(defaultAnswerMode);

  // Dual-queue system
  const [activeQueue, setActiveQueue] = useState<ReviewQueueEntry[]>(() => partitionSessionCards(cards).activeQueue);
  const [delayedQueue, setDelayedQueue] = useState<ReviewQueueEntry[]>(() => partitionSessionCards(cards).delayedQueue);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalSeen, setTotalSeen] = useState(cards.length);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [ratingsMap, setRatingsMap] = useState<Map<string, SRSRating>>(new Map());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());
  const [nextDueCountdown, setNextDueCountdown] = useState<string | null>(null);
  const currentIdxRef = useRef(0);
  const nextOrderRef = useRef(cards.length);
  const sessionCreatedAt = useRef(Date.now());

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

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
    setArchivedIds(new Set());
    setSuspendedIds(new Set());
    setNextDueCountdown(getNextDueCountdownLabel(queues.delayedQueue));
    setAnswerRevealed(false);
    setShowManualInterval(false);
    sessionCreatedAt.current = Date.now();
  }, [cards]);

  // Timer: promote delayed → active
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setDelayedQueue(prev => {
        if (prev.length === 0) { setNextDueCountdown(null); return prev; }
        const { readyQueue, delayedQueue: nextDelayed } = promoteDueQueue(prev, now);
        setNextDueCountdown(getNextDueCountdownLabel(nextDelayed, now));
        if (readyQueue.length > 0) {
          const readySorted = [...readyQueue].sort((a, b) => a.dueAt - b.dueAt);
          setActiveQueue(prevActive => {
            setTotalSeen(s => s + readySorted.length);
            if (prevActive.length === 0) return readySorted;
            const pinnedIdx = Math.min(currentIdxRef.current, prevActive.length - 1);
            return [...prevActive.slice(0, pinnedIdx + 1), ...readySorted, ...prevActive.slice(pinnedIdx + 1)];
          });
        }
        return readyQueue.length > 0 ? nextDelayed : prev;
      });
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist session state
  useEffect(() => {
    if (!sessionId) return;
    const debounce = setTimeout(() => {
      updateSessionMeta(sessionId, {
        reviewedIds: Array.from(reviewedIds),
        archivedInSession: Array.from(archivedIds),
        suspendedIds: Array.from(suspendedIds),
        currentIdx,
        ratingsMap: Object.fromEntries(ratingsMap),
      });
    }, 500);
    return () => clearTimeout(debounce);
  }, [sessionId, reviewedIds, archivedIds, suspendedIds, currentIdx, ratingsMap, updateSessionMeta]);

  const currentEntry = activeQueue[currentIdx];
  const card = currentEntry?.card;

  const availableAnswerModes = useMemo(() => {
    if (!answerModeOptions.length) return ['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[];
    const uniq = Array.from(new Set(answerModeOptions));
    return uniq.length > 0 ? uniq : (['bottom', 'tooltip', 'inline'] as AnswerDisplayMode[]);
  }, [answerModeOptions]);

  // Navigate to card's page
  useEffect(() => { if (card) onNavigateToPage(card.page); }, [card, onNavigateToPage]);

  // Reset answer state on card change
  useEffect(() => { setAnswerRevealed(false); setShowManualInterval(false); }, [currentIdx, card?.id]);

  useEffect(() => {
    if (!availableAnswerModes.includes(answerMode)) setAnswerMode(availableAnswerModes[0]);
  }, [availableAnswerModes, answerMode]);

  useEffect(() => { setAnswerMode(defaultAnswerMode); }, [defaultAnswerMode]);

  const intervals = useMemo(() => card ? previewIntervals(card) : [], [card]);
  const handleRevealAnswer = useCallback(() => setAnswerRevealed(true), []);

  // Suspend card
  const handleSuspendCard = useCallback(() => {
    if (!card) return;
    if (!card.flagged) toggleFlag(card.id);
    setSuspendedIds(prev => new Set(prev).add(card.id));
    const nextActive = activeQueue.filter((_, i) => i !== currentIdx);
    setActiveQueue(nextActive);
    if (currentIdx >= nextActive.length && nextActive.length > 0) {
      setCurrentIdx(nextActive.length - 1);
    } else if (nextActive.length === 0 && delayedQueue.length === 0) {
      setTimeout(() => onFinish(), 100);
    }
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [card, activeQueue, currentIdx, delayedQueue, toggleFlag, onFinish]);

  // Archive card
  const handleArchiveCard = useCallback((cardId: string) => {
    archiveCard(cardId);
    setArchivedIds(prev => new Set(prev).add(cardId));
    // Remove from active queue if it's there
    const idx = activeQueue.findIndex(e => e.card.id === cardId);
    if (idx >= 0) {
      const nextActive = activeQueue.filter((_, i) => i !== idx);
      setActiveQueue(nextActive);
      if (currentIdx >= nextActive.length && nextActive.length > 0) {
        setCurrentIdx(nextActive.length - 1);
      } else if (nextActive.length === 0 && delayedQueue.length === 0) {
        setTimeout(() => onFinish(), 100);
      }
    }
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [archiveCard, activeQueue, currentIdx, delayedQueue, onFinish]);

  // Unarchive card
  const handleUnarchiveCard = useCallback((cardId: string) => {
    unarchiveCard(cardId);
    setArchivedIds(prev => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }, [unarchiveCard]);

  const handleRate = useCallback((rating: SRSRating, customInterval?: number) => {
    if (!card || !currentEntry) return;
    rateCard(card.id, rating, customInterval);
    const freshCard = useSRSStore.getState().cards.find(c => c.id === card.id);
    const nextReview = freshCard?.nextReview ?? 0;
    const now = Date.now();

    const baseActiveQueue = activeQueue.filter((_, i) => i !== currentIdx);
    const { readyQueue, delayedQueue: nextDelayedBase } = promoteDueQueue(delayedQueue, now);
    let nextDelayedQueue = nextDelayedBase;
    const readySorted = [...readyQueue].sort((a, b) => a.dueAt - b.dueAt);
    let nextActiveQueue = [...readySorted, ...baseActiveQueue];

    if (freshCard) {
      const updatedEntry: ReviewQueueEntry = {
        card: freshCard,
        dueAt: nextReview,
        order: nextOrderRef.current++,
      };
      if (nextReview > now) {
        nextDelayedQueue = [...nextDelayedQueue, updatedEntry];
      } else {
        nextActiveQueue = [updatedEntry, ...nextActiveQueue];
      }
    }

    setActiveQueue(nextActiveQueue);
    setDelayedQueue(nextDelayedQueue);
    setNextDueCountdown(getNextDueCountdownLabel(nextDelayedQueue, now));
    setCurrentIdx(0);

    if (nextActiveQueue.length === 0 && nextDelayedQueue.length === 0) {
      if (sessionId) {
        useReviewSessionStore.getState().completeSession(sessionId);
      }
      setTimeout(() => onFinish(), 100);
    }

    setReviewedCount(c => c + 1);
    setReviewedIds(prev => new Set(prev).add(card.id));
    setRatingsMap(prev => { const m = new Map(prev); m.set(card.id, rating); return m; });
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [card, currentEntry, activeQueue, currentIdx, delayedQueue, rateCard, onFinish, sessionId]);

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

  // Waiting state
  if (!card && delayedQueue.length > 0) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground space-y-3" dir="rtl">
        <p className="text-lg">⏳ في انتظار البطاقات المعلقة...</p>
        {nextDueCountdown && <p className="text-2xl font-bold text-primary animate-pulse">{nextDueCountdown}</p>}
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

  return (
    <div className="flex h-full min-h-0 overflow-hidden" dir="rtl">
      {/* Card Index */}
      <ReviewCardIndex
        open={showIndex}
        onOpenChange={setShowIndex}
        activeQueue={activeQueue}
        delayedQueue={delayedQueue}
        currentIdx={currentIdx}
        reviewedIds={reviewedIds}
        ratingsMap={ratingsMap}
        archivedIds={archivedIds}
        suspendedIds={suspendedIds}
        portalName={portalName}
        sessionName={sessionName}
        sessionCreatedAt={sessionCreatedAt.current}
        onGoToCard={goToCard}
        onArchiveCard={handleArchiveCard}
        onUnarchiveCard={handleUnarchiveCard}
        onToggleFlag={(id) => toggleFlag(id)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header — hidden in focus mode, replaced with minimal bar */}
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
              <button onClick={handleSuspendCard} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Ban className="w-3.5 h-3.5" />
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

        {/* Card content — scrollable */}
        <div data-review-scroll-container="true" className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
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
            <p className="font-arabic text-sm text-muted-foreground">
              {portalName === 'الغريب' && !answerRevealed ? (card.meta.wordText as string) || 'كلمة غريب' : card.label}
            </p>
            {card.lastReview > 0 && (
              <p className="text-[10px] text-muted-foreground/60 font-arabic">
                آخر مراجعة: {new Date(card.lastReview).toLocaleDateString('ar-SA')} · الفاصل: {formatInterval(card.interval)}
                {card.successCount != null && ` · ✓${card.successCount} ✗${card.failCount || 0}`}
              </p>
            )}
          </div>
        )}

        {/* Actions — always fixed at bottom */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-3 space-y-2 shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          {/* Focus mode: top bar with index + exit + counter + actions */}
          {focusMode && (
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowIndex(!showIndex)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground font-arabic">
                  {currentIdx + 1}/{total}
                  {delayedQueue.length > 0 && ` · ⏳${delayedQueue.length}`}
                  {nextDueCountdown && ` · ⏱${nextDueCountdown}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleFlag(card.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${card.flagged ? 'text-orange-500' : 'hover:bg-accent text-muted-foreground'}`}
                  title="تعليق"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleArchiveCard(card.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-accent text-muted-foreground"
                  title="أرشفة"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button onClick={onFinish} className="text-muted-foreground hover:text-foreground p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!answerRevealed ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button onClick={handleRevealAnswer} className="flex-1 font-arabic text-base gap-2" size="lg">
                  <Eye className="w-5 h-5" />
                  إظهار الإجابة
                </Button>
                <Button onClick={handleSuspendCard} variant="outline" size="lg" className="font-arabic gap-1 text-destructive hover:bg-destructive/10">
                  <Ban className="w-4 h-4" />
                  تعليق
                </Button>
              </div>
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
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'فوري', days: 0 },
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
                    archivedIds.has(entry.card.id) ? 'bg-muted-foreground/40' :
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
