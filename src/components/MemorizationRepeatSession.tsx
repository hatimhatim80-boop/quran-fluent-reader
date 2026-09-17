/**
 * جلسة الحفظ بالتكرار
 * ------------------------------------------------------------------
 * الاستماع → التكرار → التسميع من الحفظ → كتابة ما سمعه التطبيق →
 * المقارنة → إعادة المحاولة → اعتماد الحفظ → الوحدة التالية.
 *
 * مصممة للهاتف أولًا (Capacitor/Android): أزرار كبيرة، شريط سفلي ثابت،
 * التعرف الصوتي عبر طبقة مستقلة، والصوت عبر نظام التلاوة الموجود.
 *
 * حالة الحفظ مشتقة من الذرات القرآنية الثابتة، لا من حدود الوحدة المتغيرة.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Play, Pause, RotateCcw, Plus, Mic, Square, Settings, Check,
  Volume2, Loader2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { QuranPage } from '@/types/quran';
import { Session, useSessionsStore } from '@/stores/sessionsStore';
import { MemorizationMushafPage } from '@/components/MemorizationMushafPage';
import { AyahRef } from '@/utils/pageAyahRefs';
import {
  MemorizationSettings, STRUCTURAL_SETTING_KEYS,
  useMemorizationStore,
} from '@/stores/memorizationStore';
import {
  AyahMappingError, MemorizationUnit, buildMemorizationUnits, cumulativeRefs, cumulativeText,
  isUnitMemorized,
} from '@/utils/memorizationUnits';
import { DIFF_LABEL, DiffReport, compareRecitation } from '@/utils/memorizationDiff';
import {
  MicState, QuranSpeechRecognitionProvider, getSpeechProvider, isOnline,
} from '@/services/speechRecognition';
import {
  DEFAULT_RECITER_ID, RECITERS, narrationName, pauseAudio, playAyahSequence,
  resumeAudio, stopAudio,
} from '@/services/quranAudio';

const arabicNum = (n: number) => new Intl.NumberFormat('ar-SA').format(n);

const STATUS_CLASS: Record<string, string> = {
  correct: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  missing: 'bg-destructive/15 text-destructive line-through',
  extra: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  different: 'bg-destructive/20 text-destructive',
  order: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
  unclear: 'bg-muted text-muted-foreground',
};

type Phase = 'listening' | 'reciting' | 'reviewing';

interface Props {
  session: Session;
  pages: QuranPage[];
  totalPages: number;
}

export function MemorizationRepeatSession({ session, pages, totalPages }: Props) {
  const navigate = useNavigate();
  const sessionId = session.id;

  const patchSettings = useMemorizationStore(s => s.patchSettings);
  const patchProgress = useMemorizationStore(s => s.patchProgress);
  const addAttempt = useMemorizationStore(s => s.addAttempt);
  const markMemorized = useMemorizationStore(s => s.markMemorized);
  const resetSession = useMemorizationStore(s => s.resetSession);
  const record = useMemorizationStore(s => s.records[sessionId]);
  const updateSession = useSessionsStore(s => s.updateSession);

  const settings: MemorizationSettings = record.settings;
  const currentUnit = record.currentUnit;
  const memorizedIds = useMemo(() => new Set(record.memorizedIds), [record.memorizedIds]);
  const repsDone = record.repsDone;
  const lastAttempt = record.lastAttempt;

  /* ─── units ─── */
  const [units, setUnits] = useState<MemorizationUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUnitsLoading(true);
    setUnitsError(null);
    buildMemorizationUnits(pages, settings.startPage, settings.endPage, settings.unitMode, settings.unitSize)
      .then(list => { if (!cancelled) { setUnits(list); setUnitsLoading(false); } })
      .catch((e: unknown) => {
        console.error('[memorization] building units failed', e);
        if (cancelled) return;
        setUnits([]);
        setUnitsLoading(false);
        setUnitsError(
          e instanceof AyahMappingError
            ? `تعذّر تحديد أرقام الآيات في الصفحة ${arabicNum(e.page)} بدقة، ولن نربط نصًا بتلاوة غير مؤكدة. جرّب نطاقًا آخر أو حدّث بيانات المصحف.`
            : 'تعذّر تجهيز وحدات الحفظ.'
        );
      });
    return () => { cancelled = true; };
  }, [pages, settings.startPage, settings.endPage, settings.unitMode, settings.unitSize]);

  const unit = units[currentUnit];
  const targetText = useMemo(() => {
    if (!unit) return '';
    return settings.method === 'cumulative' ? cumulativeText(units, currentUnit, memorizedIds) : unit.text;
  }, [unit, units, currentUnit, settings.method, memorizedIds]);
  const targetRefs = useMemo(() => {
    if (!unit) return [];
    return settings.method === 'cumulative' ? cumulativeRefs(units, currentUnit, memorizedIds) : unit.refs;
  }, [unit, units, currentUnit, settings.method, memorizedIds]);

  /* ─── phase & audio ─── */
  const [phase, setPhase] = useState<Phase>('listening');
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [playingRef, setPlayingRef] = useState<AyahRef | null>(null);
  const loopToken = useRef(0);

  const stopLoop = useCallback(() => {
    loopToken.current++;
    stopAudio();
    setAudioBusy(false);
    setAudioPaused(false);
    setPlayingRef(null);
  }, []);

  /* ─── speech ─── */
  const providerRef = useRef<QuranSpeechRecognitionProvider | null>(null);
  const [micState, setMicState] = useState<MicState>('idle');
  const [partial, setPartial] = useState('');
  const [finalText, setFinalText] = useState('');
  const [report, setReport] = useState<DiffReport | null>(null);
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const startingRef = useRef(false);
  const endingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getSpeechProvider().then(p => {
      if (!alive) return;
      providerRef.current = p;
      if (p.id === 'none') setMicState('unavailable');
    }).catch(e => console.error('[memorization] speech provider failed', e));
    return () => {
      alive = false;
      void providerRef.current?.dispose();
      stopAudio();
    };
  }, []);

  /**
   * The single place that brings the session to a safe rest: repetition loop,
   * reciter audio and microphone all stop together — never one without the other.
   */
  const handleSessionInterruption = useCallback((note?: string) => {
    loopToken.current++;
    stopAudio();
    setAudioBusy(false);
    setAudioPaused(false);
    setPlayingRef(null);
    void providerRef.current?.dispose();
    setMicState(prev => (prev === 'listening' || prev === 'requestingPermission' || prev === 'processing' ? 'idle' : prev));
    setPartial('');
    if (note) setSpeechNote(note);
    // Progress is already persisted after every event; touch updatedAt so the
    // record reflects the interruption too.
    patchProgress(sessionId, {});
  }, [patchProgress, sessionId]);

  const approveUnitRef = useRef<() => void>(() => {});
  const beginRecitationRef = useRef<() => Promise<void>>(async () => {});

  const runCheck = useCallback((text: string) => {
    if (!targetText || !unit) return;
    const rep = compareRecitation(targetText, text);
    setReport(rep);
    addAttempt(sessionId, {
      at: Date.now(),
      stableUnitId: unit.stableId,
      rawTranscript: text,
      tokens: rep.tokens,
      score: rep.score,
      doubtful: rep.doubtful,
    });
    if (rep.approvable && settings.autoApproveOnSuccess) approveUnitRef.current();
  }, [targetText, unit, addAttempt, sessionId, settings.autoApproveOnSuccess]);

  const runRepeats = useCallback(async (times: number, fromZero: boolean) => {
    if (!unit || targetRefs.length === 0) return;
    const token = ++loopToken.current;
    setAudioBusy(true);
    setAudioPaused(false);
    setAudioNote(null);
    let done = fromZero ? 0 : repsDone;
    if (fromZero) patchProgress(sessionId, { repsDone: 0 });

    while (done < times) {
      const result = await playAyahSequence(
        settings.reciterId || DEFAULT_RECITER_ID,
        targetRefs,
        (ref) => { if (token === loopToken.current) setPlayingRef(ref); },
      );
      if (token !== loopToken.current) return;
      if (result.played === 0) {
        setAudioNote(result.notDownloaded
          ? 'هذه التلاوة غير محمّلة على الجهاز — يمكنك التكرار بنفسك أو تحميلها من إدارة التلاوة.'
          : 'تعذّر تشغيل التلاوة الآن.');
        setAudioBusy(false);
        setPlayingRef(null);
        return;
      }
      done++;
      patchProgress(sessionId, { repsDone: done });
    }
    setAudioBusy(false);
    setPlayingRef(null);
    if (settings.autoStartRecitation) void beginRecitationRef.current();
  }, [unit, targetRefs, repsDone, settings.reciterId, settings.autoStartRecitation, patchProgress, sessionId]);

  const beginRecitation = useCallback(async () => {
    if (startingRef.current || micState === 'listening' || micState === 'processing') return;
    startingRef.current = true;
    endingRef.current = false;
    try {
      // 1. reciter audio must be fully silent before the mic opens
      stopLoop();
      await new Promise(r => setTimeout(r, 250));

      setPhase('reciting');
      setPartial('');
      setFinalText('');
      setReport(null);
      setSpeechNote(null);

      const provider = providerRef.current || (await getSpeechProvider());
      providerRef.current = provider;

      if (provider.id === 'none') {
        setMicState('unavailable');
        setSpeechNote('التعرف الصوتي غير متاح حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.');
        return;
      }
      if (provider.networkRequirement === 'required' && !isOnline()) {
        setMicState('unavailable');
        setSpeechNote('التعرف الصوتي غير متاح بدون اتصال حاليًا — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.');
        return;
      }

      setMicState('requestingPermission');
      let perm = await provider.checkPermission();
      if (perm !== 'granted') perm = await provider.requestPermission();
      if (perm !== 'granted') {
        setMicState('permissionDenied');
        setSpeechNote('لم يُسمح باستخدام الميكروفون — يمكنك تفعيله من إعدادات الهاتف، أو المتابعة بالاعتماد اليدوي.');
        return;
      }

      // Arabic must really exist on the device; we never fall back to another language.
      const langCheck = await provider.resolveLanguage(settings.language || 'ar-SA');
      if (!langCheck.supported) {
        setMicState('unavailable');
        setSpeechNote('التعرف على العربية غير متاح على هذا الجهاز — يمكنك التسميع لنفسك واعتماد الحفظ يدويًا.');
        return;
      }
      if (langCheck.substituted) {
        setSpeechNote(`لهجة "${settings.language}" غير متوفرة — سيُستخدم "${langCheck.lang}".`);
      }

      const ok = await provider.startListening(langCheck.lang, {
        onPartialResult: (t) => setPartial(t),
        onStateChange: (s) => setMicState(s),
        onFinalResult: (t) => {
          endingRef.current = false;
          setFinalText(t);
          setPhase('reviewing');
          if (!t) {
            setSpeechNote('لم يلتقط التطبيق أي صوت — أعد التسميع.');
            return;
          }
          if (settings.autoCheck) runCheck(t);
        },
        onError: (msg, tech) => {
          console.error('[memorization] speech error', msg, tech);
          setSpeechNote(msg);
        },
      });
      if (!ok) {
        setSpeechNote('تعذّر بدء التسميع — حاول مرة أخرى.');
        setMicState('error');
        setPhase('reviewing');
      }
    } finally {
      startingRef.current = false;
    }
  }, [micState, stopLoop, settings.language, settings.autoCheck, runCheck]);

  useEffect(() => { beginRecitationRef.current = beginRecitation; }, [beginRecitation]);

  const endRecitation = useCallback(async () => {
    if (endingRef.current) return; // one finish per session
    endingRef.current = true;
    setMicState('processing');
    try {
      // The provider waits for the real final result (with its own safe timeout)
      // and calls onFinalResult exactly once.
      await providerRef.current?.stopListening();
    } catch (e) {
      console.error('[memorization] stop listening failed', e);
      setPhase('reviewing');
      setMicState('idle');
      setSpeechNote('توقفت محاولة التسميع — أعد المحاولة.');
      endingRef.current = false;
    }
  }, []);

  /* ─── interruptions (calls, background, screen lock) ─── */
  const wasListeningRef = useRef(false);
  useEffect(() => { wasListeningRef.current = micState === 'listening' || micState === 'requestingPermission'; }, [micState]);

  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) return;
          handleSessionInterruption(wasListeningRef.current ? 'توقفت محاولة التسميع — أعد المحاولة.' : undefined);
        });
        remove = () => { void handle.remove(); };
      } catch (e) {
        console.error('[memorization] app state listener failed', e);
      }
    })();
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      handleSessionInterruption(wasListeningRef.current ? 'توقفت محاولة التسميع — أعد المحاولة.' : undefined);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      remove?.();
    };
  }, [handleSessionInterruption]);

  /* ─── unit flow ─── */
  const autoPlayedFor = useRef<string | null>(null);

  const goToUnit = useCallback((index: number) => {
    const next = Math.max(0, Math.min(units.length - 1, index));
    stopLoop();
    void providerRef.current?.dispose();
    endingRef.current = false;
    setMicState('idle');
    setPartial('');
    setFinalText('');
    setReport(null);
    setSpeechNote(null);
    setAudioNote(null);
    setPhase('listening');
    patchProgress(sessionId, { currentUnit: next, repsDone: 0 });
    const page = units[next]?.page;
    if (page) updateSession(sessionId, { currentPage: page });
  }, [units, stopLoop, patchProgress, sessionId, updateSession]);

  const approveUnit = useCallback(() => {
    if (!unit) return;
    markMemorized(sessionId, unit.atomIds);
    toast.success('تم اعتماد حفظ هذه الوحدة');
    if (settings.autoAdvance && currentUnit < units.length - 1) goToUnit(currentUnit + 1);
    else { stopLoop(); setPhase('listening'); }
  }, [unit, markMemorized, sessionId, settings.autoAdvance, currentUnit, units.length, goToUnit, stopLoop]);

  useEffect(() => { approveUnitRef.current = approveUnit; }, [approveUnit]);

  /* keep the cursor inside the (possibly rebuilt) unit list */
  useEffect(() => {
    if (unitsLoading || units.length === 0) return;
    if (currentUnit > units.length - 1) {
      patchProgress(sessionId, { currentUnit: units.length - 1, repsDone: 0 });
      autoPlayedFor.current = null;
    }
  }, [units, unitsLoading, currentUnit, patchProgress, sessionId]);

  /* auto play when a unit opens — keyed by the unit identity, not its index */
  useEffect(() => {
    if (!settings.autoPlayAudio || unitsLoading || !unit) return;
    if (phase !== 'listening') return;
    if (autoPlayedFor.current === unit.stableId) return;
    autoPlayedFor.current = unit.stableId;
    if (repsDone < settings.repeatTarget) void runRepeats(settings.repeatTarget, repsDone === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit?.stableId, unitsLoading, settings.autoPlayAudio, phase]);

  /* ─── settings ─── */
  const [showSettings, setShowSettings] = useState(false);
  const [pendingStructural, setPendingStructural] = useState<Partial<MemorizationSettings> | null>(null);

  const setSetting = <K extends keyof MemorizationSettings>(key: K, value: MemorizationSettings[K]) => {
    if (settings[key] === value) return;
    if ((STRUCTURAL_SETTING_KEYS as readonly string[]).includes(key as string)) {
      setPendingStructural({ [key]: value } as Partial<MemorizationSettings>);
      return;
    }
    patchSettings(sessionId, { [key]: value } as Partial<MemorizationSettings>);
  };

  const applyStructural = () => {
    if (!pendingStructural) return;
    // Structure changes stop everything first, then rebuild.
    handleSessionInterruption();
    setPhase('listening');
    setReport(null);
    setFinalText('');
    autoPlayedFor.current = null;
    patchSettings(sessionId, pendingStructural);
    patchProgress(sessionId, { repsDone: 0 });
    setPendingStructural(null);
  };

  const listening = micState === 'listening';
  const hideText = phase === 'reciting';
  const wordModeAudioNote = settings.unitMode === 'words' && unit && unit.refs.length > 0;

  /* ─── صفحة المصحف تتبع وحدة الحفظ الحالية ─── */
  const [viewPage, setViewPage] = useState<number>(unit?.page || settings.startPage);
  useEffect(() => { if (unit?.page) setViewPage(unit.page); }, [unit?.page]);

  const pageData = useMemo(() => pages.find(p => p.pageNumber === viewPage), [pages, viewPage]);
  const currentAtomIds = unit?.atomIds ?? [];
  const nextAtomIds = units[currentUnit + 1]?.atomIds ?? [];
  const memorizedCount = units.filter(u => isUnitMemorized(u, memorizedIds)).length;
  const notes = [audioNote, speechNote].filter(Boolean) as string[];

  /* ─── render ─── */
  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* top bar — compact so the mushaf gets the space */}
      <header className="shrink-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { handleSessionInterruption(); navigate('/sessions'); }}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted/60"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-arabic font-bold text-xs truncate">{session.name}</h1>
            <p className="font-arabic text-[11px] text-muted-foreground truncate">
              {unitsLoading
                ? 'جارٍ التجهيز…'
                : `صفحة ${arabicNum(viewPage)} • الوحدة ${arabicNum(currentUnit + 1)}/${arabicNum(units.length || 1)} • محفوظة ${arabicNum(memorizedCount)}`}
            </p>
          </div>
          <button
            onClick={() => setViewPage(p => Math.max(1, p - 1))}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted/60 disabled:opacity-40"
            disabled={viewPage <= 1}
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewPage(p => Math.min(totalPages, p + 1))}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted/60 disabled:opacity-40"
            disabled={viewPage >= totalPages}
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted/60"
            aria-label="إعدادات الجلسة"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* المصحف نفسه — أكبر مساحة ممكنة */}
      <main className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
        {unitsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-arabic text-sm p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تجهيز وحدات الحفظ…
          </div>
        ) : unitsError ? (
          <p className="font-arabic text-sm text-destructive flex items-start gap-2 p-4">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />{unitsError}
          </p>
        ) : units.length === 0 ? (
          <p className="font-arabic text-sm text-muted-foreground p-4">لا توجد آيات في النطاق المحدد.</p>
        ) : !pageData ? (
          <p className="font-arabic text-sm text-muted-foreground p-4">
            صفحة المصحف {arabicNum(viewPage)} غير متاحة في بيانات هذه الجلسة.
          </p>
        ) : (
          <MemorizationMushafPage
            page={pageData}
            currentAtomIds={currentAtomIds}
            nextAtomIds={nextAtomIds}
            memorizedIds={memorizedIds}
            upcomingVisibility={settings.upcomingVisibility}
            hideCurrent={hideText}
            playingRef={playingRef}
          />
        )}
      </main>

      {/* لوحة التسميع والنتيجة — فوق الشريط السفلي مباشرة */}
      {(phase === 'reciting' || phase === 'reviewing') && (
        <div className="shrink-0 max-h-[42dvh] overflow-y-auto border-t border-border/60 bg-card/95 backdrop-blur px-3 py-2 space-y-2">
          {micState === 'processing' && (
            <p className="font-arabic text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ استخراج النص…
            </p>
          )}

          {(settings.transcriptVisibility === 'live' && phase === 'reciting' && partial) && (
            <p className="font-arabic text-sm leading-7 text-muted-foreground">{partial}</p>
          )}

          {phase === 'reviewing' && finalText && (
            <div>
              <p className="font-arabic text-[11px] text-muted-foreground mb-1">ما قرأتَه:</p>
              <p className="font-arabic text-sm leading-7">{finalText}</p>
            </div>
          )}

          {phase === 'reviewing' && !settings.autoCheck && finalText && !report && (
            <Button className="h-11 w-full font-arabic" onClick={() => runCheck(finalText)}>
              تحقق من التسميع
            </Button>
          )}

          {report && (
            <div className="space-y-2">
              {report.doubtful && (
                <p className="font-arabic text-[11px] text-muted-foreground">
                  نتيجة التعرف الصوتي غير مؤكدة — لا يعني ذلك بالضرورة خطأ منك.
                </p>
              )}
              {!report.doubtful && report.hasUnclear && (
                <p className="font-arabic text-[11px] text-muted-foreground">
                  بعض الكلمات غير واضحة — يمكنك إعادة تسميعها قبل اعتماد الحفظ.
                </p>
              )}
              <p className="font-arabic text-xs">
                الكلمات الصحيحة: {arabicNum(report.correct)} من {arabicNum(report.total)}
              </p>
              <div className="flex flex-wrap gap-1 justify-end" dir="rtl">
                {report.tokens.map((t, i) => (
                  <span
                    key={i}
                    title={DIFF_LABEL[t.status]}
                    className={`px-2 py-0.5 rounded-lg text-base font-quran ${STATUS_CLASS[t.status]}`}
                  >
                    {t.expected || t.heard}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase === 'reviewing' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 font-arabic gap-2" onClick={() => void beginRecitation()}>
                <Mic className="w-4 h-4" /> إعادة التسميع
              </Button>
              <Button
                variant="outline"
                className="h-11 font-arabic gap-2"
                onClick={() => { setPhase('listening'); void runRepeats(repsDone + 1, false); }}
              >
                <Volume2 className="w-4 h-4" /> سماع المقطع
              </Button>
              <Button className="h-11 font-arabic gap-2 col-span-2" onClick={approveUnit}>
                <Check className="w-4 h-4" /> تم الحفظ
              </Button>
            </div>
          )}
        </div>
      )}

      {/* الشريط السفلي الثابت المضغوط */}
      <div className="shrink-0 z-40 bg-background/95 backdrop-blur border-t border-border/60 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {notes.length > 0 && (
          <p className="font-arabic text-[11px] text-amber-600 flex items-start gap-1 pb-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{notes[0]}
          </p>
        )}
        {phase === 'reciting' ? (
          <div className="flex items-center gap-2">
            <span className="font-arabic text-xs flex items-center gap-2 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              {listening ? '🎙 جارٍ الاستماع' : micState === 'requestingPermission' ? 'طلب إذن الميكروفون…' : 'تجهيز الميكروفون…'}
            </span>
            <Button className="h-11 px-5 font-arabic gap-2" variant="destructive" onClick={() => void endRecitation()}>
              <Square className="w-4 h-4" /> إنهاء التسميع
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-arabic text-[11px] text-primary font-bold shrink-0 px-1">
              {arabicNum(Math.min(repsDone, settings.repeatTarget))}/{arabicNum(settings.repeatTarget)}
            </span>
            {!audioBusy ? (
              <Button size="icon" className="h-11 w-11" aria-label="تشغيل"
                onClick={() => runRepeats(settings.repeatTarget, repsDone >= settings.repeatTarget)}>
                <Play className="w-5 h-5" />
              </Button>
            ) : audioPaused ? (
              <Button size="icon" className="h-11 w-11" aria-label="متابعة"
                onClick={() => { void resumeAudio(); setAudioPaused(false); }}>
                <Play className="w-5 h-5" />
              </Button>
            ) : (
              <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="إيقاف مؤقت"
                onClick={() => { pauseAudio(); setAudioPaused(true); }}>
                <Pause className="w-5 h-5" />
              </Button>
            )}
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="إعادة من البداية"
              onClick={() => runRepeats(settings.repeatTarget, true)}>
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="تكرار مرة إضافية"
              onClick={() => runRepeats(repsDone + 1, false)}>
              <Plus className="w-5 h-5" />
            </Button>
            <Button className="h-11 flex-1 font-arabic gap-2" onClick={() => void beginRecitation()}>
              <Mic className="w-4 h-4" /> ابدأ التسميع
            </Button>
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="تم الحفظ" onClick={approveUnit}>
              <Check className="w-5 h-5" />
            </Button>
          </div>
        )}
        {wordModeAudioNote && phase === 'listening' && (
          <p className="font-arabic text-[10px] text-muted-foreground pt-1">
            التلاوة على مستوى الآية كاملة، لذا ستُتلى الآية التي تحوي هذه الكلمات.
          </p>
        )}
      </div>


      {/* structural change confirmation */}
      <AlertDialog open={!!pendingStructural} onOpenChange={(o) => { if (!o) setPendingStructural(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-arabic text-right">تغيير بنية وحدات الحفظ</AlertDialogTitle>
            <AlertDialogDescription className="font-arabic text-right">
              هذا التغيير يعيد تقسيم وحدات الحفظ. ما اعتمدتَه محفوظًا يبقى محفوظًا بحسب موضعه في المصحف،
              لكن حدود الوحدات وترقيمها ستتغير، وسيتوقف الصوت والميكروفون الآن.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="font-arabic">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="font-arabic" onClick={applyStructural}>متابعة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* settings */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle className="font-arabic text-right">إعدادات الجلسة</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-arabic text-xs">من صفحة</Label>
                <Input
                  type="number" inputMode="numeric" min={1} max={totalPages}
                  defaultValue={settings.startPage}
                  key={`start-${settings.startPage}`}
                  onBlur={e => setSetting('startPage', Math.max(1, Number(e.target.value) || 1))}
                  className="h-11"
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">إلى صفحة</Label>
                <Input
                  type="number" inputMode="numeric" min={1} max={totalPages}
                  defaultValue={settings.endPage}
                  key={`end-${settings.endPage}`}
                  onBlur={e => setSetting('endPage', Math.max(1, Number(e.target.value) || 1))}
                  className="h-11"
                />
              </div>
            </div>

            <div>
              <Label className="font-arabic text-xs">وحدة الحفظ</Label>
              <Select value={settings.unitMode} onValueChange={(v) => setSetting('unitMode', v as MemorizationSettings['unitMode'])}>
                <SelectTrigger className="h-11 font-arabic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ayah" className="font-arabic">آيات</SelectItem>
                  <SelectItem value="words" className="font-arabic">كلمات</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-arabic text-xs">
                {settings.unitMode === 'ayah' ? 'عدد الآيات في الوحدة' : 'عدد الكلمات في الوحدة'}
              </Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {(settings.unitMode === 'ayah' ? [1, 2, 3, 5] : [3, 5, 10]).map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={settings.unitSize === n ? 'default' : 'outline'}
                    className="h-10 min-w-14 font-arabic"
                    onClick={() => setSetting('unitSize', n)}
                  >
                    {arabicNum(n)}
                  </Button>
                ))}
                <Input
                  type="number" inputMode="numeric" min={1}
                  defaultValue={settings.unitSize}
                  key={`size-${settings.unitSize}`}
                  onBlur={e => setSetting('unitSize', Math.max(1, Number(e.target.value) || 1))}
                  className="h-10 w-24"
                />
              </div>
            </div>

            <div>
              <Label className="font-arabic text-xs">عدد مرات التكرار</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {[3, 5, 7, 10, 20].map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={settings.repeatTarget === n ? 'default' : 'outline'}
                    className="h-10 min-w-14 font-arabic"
                    onClick={() => setSetting('repeatTarget', n)}
                  >
                    {arabicNum(n)}
                  </Button>
                ))}
                <Input
                  type="number" inputMode="numeric" min={1}
                  defaultValue={settings.repeatTarget}
                  key={`rep-${settings.repeatTarget}`}
                  onBlur={e => setSetting('repeatTarget', Math.max(1, Number(e.target.value) || 1))}
                  className="h-10 w-24"
                />
              </div>
            </div>

            <div>
              <Label className="font-arabic text-xs">طريقة الحفظ</Label>
              <Select value={settings.method} onValueChange={(v) => setSetting('method', v as MemorizationSettings['method'])}>
                <SelectTrigger className="h-11 font-arabic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new" className="font-arabic">الجديد فقط</SelectItem>
                  <SelectItem value="cumulative" className="font-arabic">تراكمي (المحفوظ + الجديد)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-arabic text-xs">عرض الوحدات القادمة</Label>
              <Select
                value={settings.upcomingVisibility}
                onValueChange={(v) => setSetting('upcomingVisibility', v as MemorizationSettings['upcomingVisibility'])}
              >
                <SelectTrigger className="h-11 font-arabic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hidden" className="font-arabic">مخفية</SelectItem>
                  <SelectItem value="next" className="font-arabic">الوحدة التالية فقط</SelectItem>
                  <SelectItem value="all" className="font-arabic">الجميع بشكل باهت</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-arabic text-xs">القارئ</Label>
              <Select value={settings.reciterId || DEFAULT_RECITER_ID} onValueChange={(v) => setSetting('reciterId', v)}>
                <SelectTrigger className="h-11 font-arabic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECITERS.map(r => (
                    <SelectItem key={r.id} value={r.id} className="font-arabic">
                      {r.name} — {narrationName(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-arabic text-xs">إظهار النص الذي يسمعه التطبيق</Label>
              <Select
                value={settings.transcriptVisibility}
                onValueChange={(v) => setSetting('transcriptVisibility', v as MemorizationSettings['transcriptVisibility'])}
              >
                <SelectTrigger className="h-11 font-arabic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live" className="font-arabic">أثناء التسميع</SelectItem>
                  <SelectItem value="after" className="font-arabic">بعد الانتهاء فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {([
              ['autoPlayAudio', 'تشغيل التلاوة تلقائيًا'],
              ['autoStartRecitation', 'الانتقال إلى التسميع تلقائيًا بعد التكرار'],
              ['autoCheck', 'التحقق تلقائيًا بعد التسميع'],
              ['autoApproveOnSuccess', 'اعتماد الحفظ بعد تسميع ناجح'],
              ['autoAdvance', 'الانتقال إلى الوحدة التالية بعد اعتماد الحفظ'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1">
                <Label className="font-arabic text-sm">{label}</Label>
                <Switch
                  checked={settings[key] as boolean}
                  onCheckedChange={(v) => setSetting(key, v as never)}
                />
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full h-11 font-arabic text-destructive"
              onClick={() => { resetSession(sessionId); handleSessionInterruption(); autoPlayedFor.current = null; setShowSettings(false); toast.success('تم تصفير تقدم الجلسة'); }}
            >
              تصفير تقدم الجلسة
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
