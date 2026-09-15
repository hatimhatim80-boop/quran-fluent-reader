import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSRSStore, SRSCard, SRSRating, RATING_OPTIONS, formatInterval, previewIntervals } from '@/stores/srsStore';
import { useReviewSessionStore, SessionRevealMode, SessionAudioMode } from '@/stores/reviewSessionStore';
import { useSessionsStore } from '@/stores/sessionsStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ReviewCardIndex } from './ReviewCardIndex';
import { Ban, ChevronLeft, ChevronRight, X, Eye, Settings2, Flag, List, Archive, ArchiveRestore, Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import { ReviewQueueEntry, partitionSessionCards, promoteDueQueue, getNextDueCountdownLabel } from '@/utils/reviewQueue';
import { SessionFontSettings } from '@/components/SessionFontSettings';
import { GhareebSourceSettings } from '@/components/GhareebSourceSettings';
import { SessionRevealAudioSettings } from '@/components/SessionRevealAudioSettings';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { captureTahfeezSettings, applyTahfeezSettings } from '@/utils/tahfeezSessionSettings';
import { playAyahSequence, stopAudio, DEFAULT_RECITER_ID } from '@/services/quranAudio';
import { toast } from 'sonner';
import { AyahRef, previousAyahRef } from '@/utils/pageAyahRefs';

export type AnswerDisplayMode = 'bottom' | 'tooltip' | 'inline';

/** Progressive reveal state handed to the card renderer. */
export interface CardRevealState {
  mode: SessionRevealMode;
  /** Number of words already uncovered (word-by-word modes). */
  revealedWords: number;
  /** True when the whole ayah should be shown. */
  full: boolean;
}

interface SRSReviewSessionProps {
  cards: SRSCard[];
  sessionId?: string;
  sessionName?: string;
  onFinish: () => void;
  onNavigateToPage: (page: number) => void;
  renderCard: (card: SRSCard, answerRevealed: boolean, answerDisplayMode: AnswerDisplayMode, revealState?: CardRevealState) => React.ReactNode;
  portalName: string;
  renderAnswer?: (card: SRSCard) => React.ReactNode;
  defaultAnswerMode?: AnswerDisplayMode;
  answerModeOptions?: AnswerDisplayMode[];
  headerExtra?: React.ReactNode;
  focusMode?: boolean;
  /** Extra settings shown inside the in-session settings drawer. */
  settingsPanel?: React.ReactNode;
  /** Enables the reveal-method + recitation options (tahfeez review). */
  enableRevealModes?: boolean;
  /** Word count of the hidden ayah — needed for word-by-word reveal. */
  getCardWordCount?: (card: SRSCard) => number;
  /** Exact surah/ayah of the card — needed for recitation. */
  getCardAyahRef?: (card: SRSCard) => Promise<AyahRef | null>;
}

type QueueOrder = 'smart' | 'mushaf' | 'random';

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
  settingsPanel,
  enableRevealModes = false,
  getCardWordCount,
  getCardAyahRef,

}: SRSReviewSessionProps) {
  const rateCard = useSRSStore(s => s.rateCard);
  const toggleFlag = useSRSStore(s => s.toggleFlag);
  const archiveCard = useSRSStore(s => s.archiveCard);
  const unarchiveCard = useSRSStore(s => s.unarchiveCard);
  const updateSessionMeta = useReviewSessionStore(s => s.updateSession);
  const updateGeneralSession = useSessionsStore(s => s.updateSession);
  const markGeneralSessionPaused = useSessionsStore(s => s.markSessionPaused);
  const markTahfeezSessionCompleted = useSessionsStore(s => s.markSessionCompleted);
  const markGeneralSessionCompleted = useSessionsStore(s => s.markSessionCompleted);

  const updateSessionSettings = useReviewSessionStore(s => s.updateSessionSettings);

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [showManualInterval, setShowManualInterval] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [queueOrder, setQueueOrder] = useState<QueueOrder>(() => {
    const saved = sessionId ? useReviewSessionStore.getState().getSessionSettings(sessionId)?.order : undefined;
    return (saved as QueueOrder) || 'smart';
  });
  // Answer mode is restored from THIS session's saved settings (never shared).
  const [answerMode, setAnswerMode] = useState<AnswerDisplayMode>(() => {
    if (sessionId) {
      const saved = useReviewSessionStore.getState().getSessionSettings(sessionId)?.answerMode;
      if (saved) return saved as AnswerDisplayMode;
    }
    return defaultAnswerMode;
  });

  // ── Reveal method + recitation (saved per session, applied live) ──────────
  const initialRevealSettings = sessionId
    ? useReviewSessionStore.getState().getSessionSettings(sessionId)
    : undefined;

  const [revealMode, setRevealMode] = useState<SessionRevealMode>(() => initialRevealSettings?.revealMode ?? 'smart');
  const [wordRevealInterval, setWordRevealInterval] = useState<number>(() => initialRevealSettings?.wordRevealInterval ?? 1);
  const [audioMode, setAudioMode] = useState<SessionAudioMode>(() => initialRevealSettings?.audioBeforeReveal ?? 'none');
  const [reciterId, setReciterId] = useState<string>(() => initialRevealSettings?.audioReciter ?? DEFAULT_RECITER_ID);
  const [crossSurah, setCrossSurah] = useState<boolean>(() => initialRevealSettings?.audioPreviousCrossSurah ?? false);
  /** Reveal method used by the card on screen (changes apply from the next card
      when the current one is already mid-reveal). */
  const [activeRevealMode, setActiveRevealMode] = useState<SessionRevealMode>(revealMode);
  const [revealedWords, setRevealedWords] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);

  /** Any answer-mode change is saved immediately under this session id. */
  const applyAnswerMode = useCallback((mode: AnswerDisplayMode) => {
    setAnswerMode(mode);
    if (sessionId) updateSessionSettings(sessionId, { answerMode: mode });
  }, [sessionId, updateSessionSettings]);

  const applyRevealMode = useCallback((mode: SessionRevealMode) => {
    setRevealMode(mode);
    if (sessionId) updateSessionSettings(sessionId, { revealMode: mode });
    // Only switch the live card when it is not mid-reveal, so progress is safe.
    setAnswerRevealed(revealed => {
      if (!revealed) setActiveRevealMode(mode);
      return revealed;
    });
  }, [sessionId, updateSessionSettings]);

  const applyWordRevealInterval = useCallback((seconds: number) => {
    setWordRevealInterval(seconds);
    if (sessionId) updateSessionSettings(sessionId, { wordRevealInterval: seconds });
  }, [sessionId, updateSessionSettings]);

  const applyAudioMode = useCallback((mode: SessionAudioMode) => {
    setAudioMode(mode);
    if (sessionId) updateSessionSettings(sessionId, { audioBeforeReveal: mode });
  }, [sessionId, updateSessionSettings]);

  const applyReciter = useCallback((id: string) => {
    stopAudio();
    setReciterId(id);
    if (sessionId) updateSessionSettings(sessionId, { audioReciter: id });
  }, [sessionId, updateSessionSettings]);

  const applyCrossSurah = useCallback((on: boolean) => {
    setCrossSurah(on);
    if (sessionId) updateSessionSettings(sessionId, { audioPreviousCrossSurah: on });
  }, [sessionId, updateSessionSettings]);


  /** Reorders the remaining cards live and saves the choice on this session. */
  const applyQueueOrder = useCallback((mode: QueueOrder) => {
    setQueueOrder(mode);
    if (sessionId) updateSessionSettings(sessionId, { order: mode });
    setActiveQueue(prev => {
      const arr = [...prev];
      if (mode === 'mushaf') {
        arr.sort((a, b) => a.card.page - b.card.page || a.card.id.localeCompare(b.card.id));
      } else if (mode === 'random') {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      } else {
        arr.sort((a, b) => a.card.nextReview - b.card.nextReview);
      }
      return arr;
    });
    setCurrentIdx(0);
  }, [sessionId, updateSessionSettings]);

  // Dual-queue system
  const [activeQueue, setActiveQueue] = useState<ReviewQueueEntry[]>([]);
  const [delayedQueue, setDelayedQueue] = useState<ReviewQueueEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalSeen, setTotalSeen] = useState(1);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [ratingsMap, setRatingsMap] = useState<Map<string, SRSRating>>(new Map());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());
  const [nextDueCountdown, setNextDueCountdown] = useState<string | null>(null);
  const currentIdxRef = useRef(0);
  const nextOrderRef = useRef(cards.length);
  const sessionCreatedAt = useRef(Date.now());

  const getSavedSessionState = useCallback(() => {
    if (!sessionId) return undefined;
    return useReviewSessionStore.getState().getSession(sessionId);
  }, [sessionId]);

  const currentEntry = activeQueue[currentIdx];
  const card = currentEntry?.card;

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const persistSessionState = useCallback(() => {
    if (!sessionId) return;
    const savedSession = useReviewSessionStore.getState().getSession(sessionId);
    const generalSessionId = savedSession?.settings?.generalSessionId;
    const reviewed = Array.from(reviewedIds);
    updateSessionMeta(sessionId, {
      reviewedIds: Array.from(reviewedIds),
      archivedInSession: Array.from(archivedIds),
      suspendedIds: Array.from(suspendedIds),
      currentIdx,
      ratingsMap: Object.fromEntries(ratingsMap),
    });
    if (generalSessionId) {
      updateGeneralSession(generalSessionId, {
        currentPage: card?.page ?? 1,
        lastOpenedAt: Date.now(),
        progress: totalSeen > 0 ? Math.round((reviewed.length / totalSeen) * 100) : 0,
      });
    }
  }, [sessionId, reviewedIds, archivedIds, suspendedIds, currentIdx, ratingsMap, updateSessionMeta, updateGeneralSession, card?.page, totalSeen]);

  // Reset on new session
  useEffect(() => {
    const savedSession = getSavedSessionState();
    const savedArchivedIds = new Set(savedSession?.archivedInSession ?? []);
    const savedSuspendedIds = new Set(savedSession?.suspendedIds ?? []);
    const savedReviewedIds = new Set(savedSession?.reviewedIds ?? []);
    const savedRatingsMap = new Map(
      Object.entries(savedSession?.ratingsMap ?? {}).map(([id, rating]) => [id, rating as SRSRating])
    );
    const availableCards = cards.filter(
      (sessionCard) => !savedArchivedIds.has(sessionCard.id) && !savedSuspendedIds.has(sessionCard.id)
    );
    const queues = partitionSessionCards(availableCards);
    // Honour this session's saved order so the chosen order really applies.
    const savedOrder = (savedSession?.settings?.order as QueueOrder) || 'smart';
    if (savedOrder === 'mushaf') {
      queues.activeQueue.sort((a, b) => a.card.page - b.card.page || a.card.id.localeCompare(b.card.id));
    } else if (savedOrder === 'random') {
      for (let i = queues.activeQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queues.activeQueue[i], queues.activeQueue[j]] = [queues.activeQueue[j], queues.activeQueue[i]];
      }
    }
    setQueueOrder(savedOrder);
    setActiveQueue(queues.activeQueue);
    setDelayedQueue(queues.delayedQueue);
    nextOrderRef.current = queues.nextOrder;
    setCurrentIdx(Math.min(savedSession?.currentIdx ?? 0, Math.max(queues.activeQueue.length - 1, 0)));
    setReviewedCount(savedReviewedIds.size);
    setTotalSeen(Math.max(availableCards.length, 1));
    setReviewedIds(savedReviewedIds);
    setRatingsMap(savedRatingsMap);
    setArchivedIds(savedArchivedIds);
    setSuspendedIds(savedSuspendedIds);
    setNextDueCountdown(getNextDueCountdownLabel(queues.delayedQueue));
    setAnswerRevealed(false);
    setShowManualInterval(false);
    sessionCreatedAt.current = savedSession?.createdAt ?? Date.now();
  }, [cards, getSavedSessionState]);

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
    persistSessionState();
  }, [sessionId, reviewedIds, archivedIds, suspendedIds, currentIdx, ratingsMap, persistSessionState]);

  const activeSessionType = useSessionsStore(s => s.getActiveSession()?.type);

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
    if (!availableAnswerModes.includes(answerMode)) applyAnswerMode(availableAnswerModes[0]);
  }, [availableAnswerModes, answerMode, applyAnswerMode]);

  // When switching to another session, load THAT session's own answer mode
  // (falling back to the portal default) instead of keeping the previous one.
  useEffect(() => {
    const saved = sessionId
      ? (useReviewSessionStore.getState().getSessionSettings(sessionId)?.answerMode as AnswerDisplayMode | undefined)
      : undefined;
    setAnswerMode(saved ?? defaultAnswerMode);
  }, [sessionId, defaultAnswerMode]);

  // Per-session tahfeez/quiz settings: restore this session's snapshot on open,
  // then save every later change immediately under the same session id.
  useEffect(() => {
    if (!sessionId) return;
    const saved = useReviewSessionStore.getState().getSessionSettings(sessionId)?.extra?.tahfeezSettings;
    if (saved) applyTahfeezSettings(saved as never);
    const persist = () => {
      useReviewSessionStore.getState().updateSessionSettings(sessionId, {
        extra: { tahfeezSettings: captureTahfeezSettings() },
      });
    };
    const unsubTahfeez = useTahfeezStore.subscribe(persist);
    const unsubFonts = useSettingsStore.subscribe(persist);
    window.addEventListener('beforeunload', persist);
    return () => {
      persist();
      unsubTahfeez();
      unsubFonts();
      window.removeEventListener('beforeunload', persist);
    };
  }, [sessionId]);

  // Reload reveal/recitation options when another session is opened.
  useEffect(() => {
    const s = sessionId ? useReviewSessionStore.getState().getSessionSettings(sessionId) : undefined;
    const mode = (s?.revealMode as SessionRevealMode) ?? 'smart';
    setRevealMode(mode);
    setActiveRevealMode(mode);
    setWordRevealInterval(s?.wordRevealInterval ?? 1);
    setAudioMode((s?.audioBeforeReveal as SessionAudioMode) ?? 'none');
    setReciterId(s?.audioReciter ?? DEFAULT_RECITER_ID);
    setCrossSurah(s?.audioPreviousCrossSurah ?? false);
  }, [sessionId]);

  const totalCardWords = useMemo(() => (card && getCardWordCount ? Math.max(getCardWordCount(card), 0) : 0), [card, getCardWordCount]);
  const wordByWord = enableRevealModes && activeRevealMode !== 'smart' && totalCardWords > 0;
  const fullyRevealed = !wordByWord || revealedWords >= totalCardWords;

  // Fresh card: reset reveal progress and take the latest chosen method.
  useEffect(() => {
    setRevealedWords(0);
    setAutoPaused(false);
    setActiveRevealMode(revealMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, currentIdx]);

  // Automatic word-by-word reveal.
  useEffect(() => {
    if (!answerRevealed || !wordByWord || activeRevealMode !== 'wordByWordAuto') return;
    if (autoPaused || revealedWords >= totalCardWords) return;
    const t = setTimeout(() => setRevealedWords(n => Math.min(n + 1, totalCardWords)), Math.max(0.2, wordRevealInterval) * 1000);
    return () => clearTimeout(t);
  }, [answerRevealed, wordByWord, activeRevealMode, autoPaused, revealedWords, totalCardWords, wordRevealInterval]);

  // ── Recitation (never touches text reveal or session progress) ────────────
  const [cardAyahRef, setCardAyahRef] = useState<AyahRef | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!card || !getCardAyahRef) { setCardAyahRef(null); return; }
    getCardAyahRef(card).then(ref => { if (!cancelled) setCardAyahRef(ref); }).catch(() => { if (!cancelled) setCardAyahRef(null); });
    return () => { cancelled = true; };
  }, [card, getCardAyahRef]);

  /** Plays audio only — reveal state, progress and ratings stay untouched. */
  const playRefs = useCallback((refs: (AyahRef | null)[], manual = false) => {
    const list = refs.filter(Boolean) as AyahRef[];
    if (list.length === 0) {
      if (manual) toast.info('لا توجد آية سابقة ضمن هذه السورة');
      return;
    }
    void playAyahSequence(reciterId, list).then(res => {
      if (manual && res.played === 0 && res.failed > 0) {
        toast.error(
          res.notDownloaded
            ? 'هذه التلاوة غير محمّلة على الجهاز — افتح ⚙ ثم «إدارة التلاوة الصوتية»'
            : 'تعذّر تشغيل التلاوة',
        );
      }
    });
  }, [reciterId]);

  const prevRef = useCallback(
    (ref: AyahRef) => previousAyahRef(ref, crossSurah),
    [crossSurah],
  );

  const playPrevious = useCallback(() => { if (cardAyahRef) playRefs([prevRef(cardAyahRef)], true); }, [cardAyahRef, playRefs, prevRef]);
  const playCurrent = useCallback(() => { if (cardAyahRef) playRefs([cardAyahRef], true); }, [cardAyahRef, playRefs]);

  // Auto recitation when a hidden ayah appears — the text stays hidden.
  useEffect(() => {
    if (!enableRevealModes || audioMode === 'none' || !cardAyahRef) return;
    if (audioMode === 'previous') playRefs([prevRef(cardAyahRef)]);
    else if (audioMode === 'current') playRefs([cardAyahRef]);
    else playRefs([prevRef(cardAyahRef), cardAyahRef]);
    return () => stopAudio();
  }, [cardAyahRef, audioMode, enableRevealModes, playRefs, prevRef]);

  useEffect(() => () => stopAudio(), []);

  const sessionPages = useMemo(() => Array.from(new Set(cards.map(c => c.page))), [cards]);

  const intervals = useMemo(() => card ? previewIntervals(card) : [], [card]);
  const handleRevealAnswer = useCallback(() => {
    setAnswerRevealed(true);
    if (enableRevealModes && activeRevealMode !== 'smart') {
      setRevealedWords(1);
      setAutoPaused(false);
    }
  }, [enableRevealModes, activeRevealMode]);

  const revealNextWord = useCallback(() => setRevealedWords(n => Math.min(n + 1, Math.max(totalCardWords, 1))), [totalCardWords]);
  const revealWholeAyah = useCallback(() => setRevealedWords(Math.max(totalCardWords, 1)), [totalCardWords]);


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
        const savedSession = useReviewSessionStore.getState().getSession(sessionId);
        useReviewSessionStore.getState().completeSession(sessionId);
        const generalSessionId = savedSession?.settings?.generalSessionId;
        if (generalSessionId) markGeneralSessionCompleted(generalSessionId);
      }
      const activeTahfeezSession = useSessionsStore.getState().getActiveSession();
      if (activeTahfeezSession?.type === 'tahfeez-review') {
        markTahfeezSessionCompleted(activeTahfeezSession.id);
      }
      setTimeout(() => onFinish(), 100);
    }

    setReviewedCount(c => c + 1);
    setReviewedIds(prev => new Set(prev).add(card.id));
    setRatingsMap(prev => { const m = new Map(prev); m.set(card.id, rating); return m; });
    setAnswerRevealed(false);
    setShowManualInterval(false);
  }, [card, currentEntry, activeQueue, currentIdx, delayedQueue, rateCard, onFinish, sessionId, markTahfeezSessionCompleted, markGeneralSessionCompleted]);

  const finishReviewSession = useCallback(() => {
    persistSessionState();
    const savedSession = sessionId ? useReviewSessionStore.getState().getSession(sessionId) : undefined;
    const generalSessionId = savedSession?.settings?.generalSessionId;
    if (generalSessionId) markGeneralSessionPaused(generalSessionId);
    onFinish();
  }, [persistSessionState, sessionId, markGeneralSessionPaused, onFinish]);

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
    applyAnswerMode(availableAnswerModes[(ci + 1) % availableAnswerModes.length]);
  }, [answerMode, availableAnswerModes, applyAnswerMode]);

  // Waiting state
  if (!card && delayedQueue.length > 0) {
    return (
      <div className="text-center py-8 font-arabic text-muted-foreground space-y-3" dir="rtl">
        <p className="text-lg">⏳ في انتظار البطاقات المعلقة...</p>
        {nextDueCountdown && <p className="text-2xl font-bold text-primary animate-pulse">{nextDueCountdown}</p>}
        <p className="text-sm">ستعود البطاقات تلقائياً عند حلول موعد مراجعتها</p>
        <p className="text-xs text-muted-foreground/60">تمت مراجعة {reviewedCount} بطاقة</p>
        <Button variant="outline" onClick={finishReviewSession} className="mt-4 font-arabic">إنهاء الجلسة</Button>
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
  const progress = totalSeen > 0 ? (reviewedIds.size / totalSeen) * 100 : 0;

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
              <button onClick={() => setShowIndex(!showIndex)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowSettings(v => !v)} title="إعدادات الجلسة" className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showSettings ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                <Settings2 className="w-3.5 h-3.5" />
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
              <button onClick={finishReviewSession} className="nav-button w-7 h-7 rounded-full mr-2"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <Progress value={progress} className="h-1 rounded-none shrink-0" />

        {!focusMode && (
          <details className="border-b border-border bg-card/40 px-3 py-2 shrink-0">
            <summary className="cursor-pointer text-xs font-arabic text-muted-foreground list-none flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> إعدادات خط الجلسة
            </summary>
            <div className="pt-3">
              <SessionFontSettings sessionType={activeSessionType || 'tahfeez-review'} reviewSessionId={sessionId} compact />
            </div>
          </details>
        )}

        {(headerExtra || (!focusMode && portalName === 'الغريب')) && (
          <details className="border-b border-border bg-card/40 px-3 py-2 shrink-0">
            <summary className="cursor-pointer text-xs font-arabic text-muted-foreground list-none flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> مصادر الكلمات والمعاني
            </summary>
            <div className="pt-3">
              {headerExtra ?? <GhareebSourceSettings compact />}
            </div>
          </details>
        )}

        {/* Card content — scrollable */}
        <div
          data-review-scroll-container="true"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          onClick={answerRevealed && wordByWord && activeRevealMode === 'wordByWordManual' && !fullyRevealed ? revealNextWord : undefined}
        >
          {renderCard(card, answerRevealed, answerMode, {
            mode: activeRevealMode,
            revealedWords,
            full: fullyRevealed,
          })}

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

        {/* In-session settings drawer */}
        {showSettings && (
          <div className="border-t border-border bg-card/95 px-3 py-3 shrink-0 max-h-[45vh] overflow-y-auto overscroll-contain space-y-3 animate-fade-in" dir="rtl">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-arabic">ترتيب المراجعة</p>
              <div className="flex gap-1.5">
                {([
                  { value: 'smart' as const, label: 'ذكي (الأقدم)' },
                  { value: 'mushaf' as const, label: 'ترتيب المصحف' },
                  { value: 'random' as const, label: 'عشوائي' },
                ]).map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={queueOrder === opt.value ? 'default' : 'outline'}
                    className="text-[11px] h-7 px-2.5 font-arabic"
                    onClick={() => applyQueueOrder(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {queueOrder === 'random' && (
                <button onClick={() => applyQueueOrder('random')} className="text-[11px] text-primary font-arabic hover:underline">
                  إعادة الخلط الآن
                </button>
              )}
            </div>
            {enableRevealModes && (
              <div className="border-t border-border pt-3">
                <SessionRevealAudioSettings
                  revealMode={revealMode}
                  onRevealMode={applyRevealMode}
                  wordRevealInterval={wordRevealInterval}
                  onWordRevealInterval={applyWordRevealInterval}
                  audioMode={audioMode}
                  onAudioMode={applyAudioMode}
                  reciterId={reciterId}
                  onReciterChange={applyReciter}
                  crossSurah={crossSurah}
                  onCrossSurah={applyCrossSurah}
                  sessionPages={sessionPages}
                />
              </div>
            )}
            <SessionFontSettings sessionType={activeSessionType || 'tahfeez-review'} reviewSessionId={sessionId} compact />

            {settingsPanel}
            {headerExtra}
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
                <button
                  onClick={() => setShowSettings(v => !v)}
                  title="إعدادات الجلسة"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showSettings ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                >
                  <Settings2 className="w-4 h-4" />
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
                <button onClick={finishReviewSession} className="text-muted-foreground hover:text-foreground p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Recitation — fully independent from text reveal */}
          {enableRevealModes && cardAyahRef && (
            <div className="flex items-center justify-center gap-1.5">
              <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic gap-1" onClick={playPrevious}>
                <Volume2 className="w-3.5 h-3.5" /> سماع الآية السابقة
              </Button>
              <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic gap-1" onClick={playCurrent}>
                <Volume2 className="w-3.5 h-3.5" /> سماع الآية المخفية
              </Button>
              <Button size="sm" variant="ghost" className="text-[11px] h-7 px-2 font-arabic" onClick={() => stopAudio()}>
                إيقاف
              </Button>
            </div>
          )}

          {/* Word-by-word reveal controls */}
          {answerRevealed && wordByWord && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-arabic">
                {Math.min(revealedWords, totalCardWords)} / {totalCardWords}
              </span>
              {!fullyRevealed && activeRevealMode === 'wordByWordAuto' && (
                <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic gap-1" onClick={() => setAutoPaused(p => !p)}>
                  {autoPaused ? <><Play className="w-3.5 h-3.5" /> متابعة</> : <><Pause className="w-3.5 h-3.5" /> إيقاف مؤقت</>}
                </Button>
              )}
              {!fullyRevealed && (
                <>
                  <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic gap-1" onClick={revealNextWord}>
                    <SkipForward className="w-3.5 h-3.5" /> الكلمة التالية
                  </Button>
                  <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5 font-arabic gap-1" onClick={revealWholeAyah}>
                    <Eye className="w-3.5 h-3.5" /> إظهار الآية كاملة
                  </Button>
                </>
              )}
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
