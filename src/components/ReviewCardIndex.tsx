import React, { useMemo } from 'react';
import { SRSCard, SRSRating, useSRSStore } from '@/stores/srsStore';
import { ReviewQueueEntry } from '@/utils/reviewQueue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Flag, Archive, ArchiveRestore, X } from 'lucide-react';

export type CardStatus = 'current' | 'reviewed-good' | 'reviewed-bad' | 'new' | 'flagged' | 'archived' | 'delayed' | 'suspended';

interface ReviewCardIndexProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeQueue: ReviewQueueEntry[];
  delayedQueue: ReviewQueueEntry[];
  currentIdx: number;
  reviewedIds: Set<string>;
  ratingsMap: Map<string, SRSRating>;
  archivedIds: Set<string>;
  suspendedIds: Set<string>;
  portalName: string;
  sessionName?: string;
  sessionCreatedAt?: number;
  onGoToCard: (idx: number) => void;
  onArchiveCard: (cardId: string) => void;
  onUnarchiveCard: (cardId: string) => void;
  onToggleFlag: (cardId: string) => void;
}

function getCardStatus(
  card: SRSCard,
  idx: number,
  currentIdx: number,
  reviewedIds: Set<string>,
  ratingsMap: Map<string, SRSRating>,
  archivedIds: Set<string>,
  suspendedIds: Set<string>,
): CardStatus {
  if (idx === currentIdx) return 'current';
  if (archivedIds.has(card.id)) return 'archived';
  if (suspendedIds.has(card.id)) return 'suspended';
  if (card.flagged) return 'flagged';
  if (reviewedIds.has(card.id)) {
    const rating = ratingsMap.get(card.id);
    return rating !== undefined && rating >= 3 ? 'reviewed-good' : 'reviewed-bad';
  }
  return 'new';
}

const STATUS_STYLES: Record<CardStatus, { dot: string; bg: string; label: string }> = {
  'current': { dot: 'bg-primary animate-pulse', bg: 'bg-primary/10 text-primary font-bold', label: 'الحالية' },
  'reviewed-good': { dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400', label: 'أُجيبت ✓' },
  'reviewed-bad': { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400', label: 'أُجيبت ✗' },
  'new': { dot: 'bg-muted-foreground/30', bg: 'hover:bg-muted/60 text-foreground', label: 'جديدة' },
  'flagged': { dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600', label: 'معلّمة' },
  'archived': { dot: 'bg-muted-foreground/50', bg: 'bg-muted/40 text-muted-foreground line-through', label: 'مؤرشفة' },
  'delayed': { dot: 'bg-blue-400', bg: 'text-muted-foreground/60', label: 'مؤجلة' },
  'suspended': { dot: 'bg-gray-400', bg: 'bg-muted/30 text-muted-foreground', label: 'معلّقة' },
};

function getCardLabel(card: SRSCard, portalName: string): string {
  if (portalName === 'الغريب') {
    return (card.meta?.wordText as string) || card.label || 'كلمة';
  }
  const surah = card.meta?.surahName as string;
  return surah ? `${surah} ص${card.page}` : `ص${card.page}`;
}

export function ReviewCardIndex({
  open,
  onOpenChange,
  activeQueue,
  delayedQueue,
  currentIdx,
  reviewedIds,
  ratingsMap,
  archivedIds,
  suspendedIds,
  portalName,
  sessionName,
  sessionCreatedAt,
  onGoToCard,
  onArchiveCard,
  onUnarchiveCard,
  onToggleFlag,
}: ReviewCardIndexProps) {
  const isMobile = useIsMobile();

  const counters = useMemo(() => {
    let total = activeQueue.length + delayedQueue.length;
    let reviewed = 0;
    let archived = archivedIds.size;
    let remaining = 0;
    let flagged = 0;

    activeQueue.forEach(e => {
      if (reviewedIds.has(e.card.id)) reviewed++;
      if (e.card.flagged) flagged++;
    });
    delayedQueue.forEach(e => {
      if (e.card.flagged) flagged++;
    });
    remaining = total - reviewed - archived;

    return { total, reviewed, archived, remaining, flagged, delayed: delayedQueue.length };
  }, [activeQueue, delayedQueue, reviewedIds, archivedIds]);

  const progress = counters.total > 0 ? Math.round((counters.reviewed / counters.total) * 100) : 0;

  const content = (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Session header */}
      <div className="px-4 py-3 border-b border-border space-y-2 shrink-0">
        {sessionName && (
          <p className="font-arabic font-bold text-sm text-foreground">{sessionName}</p>
        )}
        {sessionCreatedAt && (
          <p className="text-[10px] text-muted-foreground font-arabic">
            أنشئت: {new Date(sessionCreatedAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}

        {/* Counters */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-muted/40 rounded-md py-1.5">
            <p className="text-lg font-bold text-foreground leading-none">{counters.total}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">الكل</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 rounded-md py-1.5">
            <p className="text-lg font-bold text-green-600 leading-none">{counters.reviewed}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">منجزة</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-md py-1.5">
            <p className="text-lg font-bold text-orange-500 leading-none">{counters.remaining}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">متبقية</p>
          </div>
          <div className="bg-muted/40 rounded-md py-1.5">
            <p className="text-lg font-bold text-muted-foreground leading-none">{counters.archived}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">مؤرشفة</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-arabic">{progress}%</span>
        </div>
      </div>

      {/* Card list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5 font-arabic">
          {/* Active queue */}
          {activeQueue.map((entry, i) => {
            const card = entry.card;
            const status = getCardStatus(card, i, currentIdx, reviewedIds, ratingsMap, archivedIds, suspendedIds);
            const styles = STATUS_STYLES[status];
            const label = getCardLabel(card, portalName);

            return (
              <div
                key={`a_${card.id}_${i}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${styles.bg}`}
                onClick={() => { onGoToCard(i); onOpenChange(false); }}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${styles.dot}`} />
                <span className="w-5 text-center text-[10px] text-muted-foreground">{i + 1}</span>
                <span className="truncate flex-1">{label}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{styles.label}</span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {status === 'archived' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUnarchiveCard(card.id); }}
                      className="p-1 rounded hover:bg-accent"
                      title="إلغاء الأرشفة"
                    >
                      <ArchiveRestore className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveCard(card.id); }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="أرشفة"
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                  )}
                  {card.flagged && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFlag(card.id); }}
                      className="p-1 rounded hover:bg-accent"
                      title="إلغاء التعليق"
                    >
                      <Flag className="w-3 h-3 text-orange-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Delayed queue */}
          {delayedQueue.length > 0 && (
            <>
              <p className="text-[10px] text-muted-foreground mt-3 mb-1 px-2">⏳ مؤجلة زمنياً ({delayedQueue.length})</p>
              {delayedQueue.map((entry, i) => {
                const remainSec = Math.max(0, Math.ceil((entry.dueAt - Date.now()) / 1000));
                const label = remainSec < 60 ? `${remainSec} ث` : `${Math.ceil(remainSec / 60)} د`;
                const cardLabel = getCardLabel(entry.card, portalName);

                return (
                  <div
                    key={`d_${entry.card.id}_${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground/60"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400/50 shrink-0" />
                    <span className="truncate flex-1">{cardLabel}</span>
                    <span className="text-primary/60 shrink-0">{label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="font-arabic text-sm">فهرس البطاقات</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <div className="w-64 shrink-0 border-l border-border bg-card h-full overflow-hidden flex flex-col">
      <div className="p-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-arabic font-bold text-muted-foreground">فهرس البطاقات</span>
        <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {content}
    </div>
  );
}
