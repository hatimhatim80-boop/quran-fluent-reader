import React, { useState, useCallback, useMemo } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RotateCcw, ChevronLeft, ChevronRight, Clock, X, Eye, EyeOff, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SRSReviewSessionProps {
  /** Cards to review in this session */
  cards: SRSCard[];
  /** Called when session ends */
  onFinish: () => void;
  /** Called when navigating to a card's page */
  onNavigateToPage: (page: number) => void;
  /** Render the content area for the current card */
  renderCard: (card: SRSCard, revealed: boolean) => React.ReactNode;
  /** Portal name for display */
  portalName: string;
}

export function SRSReviewSession({
  cards,
  onFinish,
  onNavigateToPage,
  renderCard,
  portalName,
}: SRSReviewSessionProps) {
  const rateCard = useSRSStore(s => s.rateCard);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [manualDays, setManualDays] = useState('3');
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [ratings, setRatings] = useState<Map<number, SRSRating>>(new Map());

  const card = cards[currentIdx];
  const total = cards.length;
  const doneCount = reviewed.size;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  // Navigate to card's page when card changes
  React.useEffect(() => {
    if (card) {
      onNavigateToPage(card.page);
    }
  }, [card, onNavigateToPage]);

  const intervals = useMemo(() => {
    if (!card) return [];
    return previewIntervals(card);
  }, [card]);

  const handleRate = useCallback((rating: SRSRating, customInterval?: number) => {
    if (!card) return;
    rateCard(card.id, rating, customInterval);
    setReviewed(prev => new Set(prev).add(currentIdx));
    setRatings(prev => new Map(prev).set(currentIdx, rating));
    setRevealed(false);
    setShowManualInterval(false);

    // Move to next unreviewed card
    const nextUnreviewed = cards.findIndex((_, i) => i > currentIdx && !reviewed.has(i) && i !== currentIdx);
    if (nextUnreviewed >= 0) {
      setCurrentIdx(nextUnreviewed);
    } else {
      // Check if there are unreviewed cards before current
      const prevUnreviewed = cards.findIndex((_, i) => i < currentIdx && !reviewed.has(i));
      if (prevUnreviewed >= 0) {
        setCurrentIdx(prevUnreviewed);
      } else {
        // All done
        onFinish();
      }
    }
  }, [card, currentIdx, cards, reviewed, rateCard, onFinish]);

  const goToCard = useCallback((idx: number) => {
    if (idx >= 0 && idx < total) {
      setCurrentIdx(idx);
      setRevealed(false);
      setShowManualInterval(false);
    }
  }, [total]);

  if (!card) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground">
        <p>لا توجد بطاقات للمراجعة</p>
        <Button variant="outline" onClick={onFinish} className="mt-4 font-arabic">إغلاق</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="font-arabic text-sm font-bold text-primary">{portalName} — مراجعة</span>
          <span className="text-xs text-muted-foreground font-arabic">
            {doneCount}/{total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Card navigator */}
          <button
            onClick={() => goToCard(currentIdx - 1)}
            disabled={currentIdx <= 0}
            className="nav-button w-7 h-7 rounded-full disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs font-arabic text-muted-foreground min-w-[3rem] text-center">
            {currentIdx + 1} / {total}
          </span>
          <button
            onClick={() => goToCard(currentIdx + 1)}
            disabled={currentIdx >= total - 1}
            className="nav-button w-7 h-7 rounded-full disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onFinish} className="nav-button w-7 h-7 rounded-full mr-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Card content */}
      <div className="flex-1 overflow-auto">
        {renderCard(card, revealed)}
      </div>

      {/* Card info */}
      <div className="px-3 py-1 text-center">
        <p className="font-arabic text-sm text-muted-foreground">{card.label}</p>
        {card.lastReview > 0 && (
          <p className="text-[10px] text-muted-foreground/60 font-arabic">
            آخر مراجعة: {new Date(card.lastReview).toLocaleDateString('ar-SA')} · الفاصل: {formatInterval(card.interval)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-3 space-y-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        {!revealed ? (
          <Button
            onClick={() => setRevealed(true)}
            className="w-full font-arabic text-base gap-2"
            size="lg"
          >
            <Eye className="w-5 h-5" />
            إظهار الإجابة
          </Button>
        ) : (
          <>
            {/* Rating buttons */}
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
                      <span className="text-[9px] text-muted-foreground font-arabic">
                        {formatInterval(intervalInfo.interval)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Manual interval toggle */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setShowManualInterval(!showManualInterval)}
                className="text-xs text-muted-foreground font-arabic flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                تعديل المدة يدوياً
              </button>
            </div>

            {showManualInterval && (
              <div className="flex items-center justify-center gap-2 animate-fade-in">
                <Select value={manualDays} onValueChange={setManualDays}>
                  <SelectTrigger className="w-32 h-8 text-xs font-arabic">
                    <SelectValue />
                  </SelectTrigger>
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
                <Button
                  size="sm"
                  variant="outline"
                  className="font-arabic text-xs h-8"
                  onClick={() => handleRate(3, parseFloat(manualDays))}
                >
                  تطبيق
                </Button>
              </div>
            )}
          </>
        )}

        {/* Quick index (mini dots) */}
        {total <= 50 && (
          <div className="flex flex-wrap justify-center gap-1 pt-1">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => goToCard(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === currentIdx
                    ? 'bg-primary scale-125'
                    : reviewed.has(i)
                      ? ratings.get(i)! >= 3 ? 'bg-green-400' : 'bg-red-400'
                      : 'bg-muted-foreground/20'
                }`}
                title={`بطاقة ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
