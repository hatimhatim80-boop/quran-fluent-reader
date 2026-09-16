/**
 * جلسة الحفظ بالتكرار
 * ------------------------------------------------------------------
 * الاستماع → التكرار → التسميع من الحفظ → كتابة ما سمعه التطبيق →
 * المقارنة → إعادة المحاولة → اعتماد الحفظ → الوحدة التالية.
 *
 * مصممة للهاتف أولًا (Capacitor/Android): أزرار كبيرة، شريط سفلي ثابت،
 * التعرف الصوتي عبر طبقة مستقلة، والصوت عبر نظام التلاوة الموجود.
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
import { toast } from 'sonner';
import { QuranPage } from '@/types/quran';
import { Session, useSessionsStore } from '@/stores/sessionsStore';
import {
  DEFAULT_MEMORIZATION_SETTINGS, MemorizationSettings, useMemorizationStore,
} from '@/stores/memorizationStore';
import {
  MemorizationUnit, buildMemorizationUnits, cumulativeRefs, cumulativeText,
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

  const ensure = useMemorizationStore(s => s.ensure);
  const patchSettings = useMemorizationStore(s => s.patchSettings);
  const patchProgress = useMemorizationStore(s => s.patchProgress);
  const addAttempt = useMemorizationStore(s => s.addAttempt);
  const markMemorized = useMemorizationStore(s => s.markMemorized);
  const resetSession = useMemorizationStore(s => s.resetSession);
  const record = useMemorizationStore(s => s.records[sessionId]);
  const updateSession = useSessionsStore(s => s.updateSession);

  /* ─── record bootstrap ─── */
  useEffect(() => {
    ensure(sessionId, {
      startPage: session.startPage || session.currentPage || 1,
      endPage: session.endPage || session.startPage || session.currentPage || 1,
      reciterId: DEFAULT_RECITER_ID,
    });
  }, [ensure, sessionId, session.startPage, session.endPage, session.currentPage]);

  const settings: MemorizationSettings = record?.settings || DEFAULT_MEMORIZATION_SETTINGS;
  const currentUnit = record?.currentUnit ?? 0;
  const memorizedUnits = record?.memorizedUnits ?? [];
  const repsDone = record?.repsDone ?? 0;
  const lastAttempt = record?.lastAttempt ?? null;

  /* ─── units ─── */
  const [units, setUnits] = useState<MemorizationUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setUnitsLoading(true);
    buildMemorizationUnits(pages, settings.startPage, settings.endPage, settings.unitMode, settings.unitSize)
      .then(list => { if (!cancelled) { setUnits(list); setUnitsLoading(false); } })
      .catch(e => {
        console.error('[memorization] building units failed', e);
        if (!cancelled) { setUnits([]); setUnitsLoading(false); toast.error('تعذّر تجهيز وحدات الحفظ'); }
      });
    return () => { cancelled = true; };
  }, [pages, settings.startPage, settings.endPage, settings.unitMode, settings.unitSize]);

  const unit = units[currentUnit];
  const targetText = useMemo(() => {
    if (!unit) return '';
    return settings.method === 'cumulative' ? cumulativeText(units, currentUnit) : unit.text;
  }, [unit, units, currentUnit, settings.method]);
  const targetRefs = useMemo(() => {
    if (!unit) return [];
    return settings.method === 'cumulative' ? cumulativeRefs(units, currentUnit) : unit.refs;
  }, [unit, units, currentUnit, settings.method]);

  /* ─── phase & audio ─── */
  const [phase, setPhase] = useState<Phase>('listening');
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const loopToken = useRef(0);

  const stopLoop = useCallback(() => {
    loopToken.current++;
    stopAudio();
    setAudioBusy(false);
    setAudioPaused(false);
  }, []);

  const runRepeats = useCallback(async (times: number, fromZero: boolean) => {
    if (!unit || targetRefs.length === 0) return;
    const token = ++loopToken.current;
    setAudioBusy(true);
    setAudioPaused(false);
    setAudioNote(null);
    let done = fromZero ? 0 : repsDone;
    if (fromZero) patchProgress(sessionId, { repsDone: 0 });

    while (done < times) {
      const result = await playAyahSequence(settings.reciterId || DEFAULT_RECITER_ID, targetRefs);
      if (token !== loopToken.current) return;
      if (result.played === 0) {
        setAudioNote(result.notDownloaded
          ? 'هذه التلاوة غير محمّلة على الجهاز — يمكنك التكرار بنفسك أو تحميلها من إدارة التلاوة.'
          : 'تعذّر تشغيل التلاوة الآن.');
        setAudioBusy(false);
        return;
      }
      done++;
      patchProgress(sessionId, { repsDone: done });
    }
    setAudioBusy(false);
    if (settings.autoStartRecitation) void beginRecitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, targetRefs, repsDone, settings.reciterId, settings.autoStartRecitation, patchProgress, sessionId]);

  /* ─── speech ─── */
  const providerRef = useRef<QuranSpeechRecognitionProvider | null>(null);
  const [micState, setMicState] = useState<MicState>('idle');
  const [partial, setPartial] = useState('');
  const [finalText, setFinalText] = useState('');
  const [report, setReport] = useState<DiffReport | null>(null);
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const startingRef = useRef(false);

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

  const runCheck = useCallback((text: string) => {
    if (!targetText) return;
    const rep = compareRecitation(targetText, text);
    setReport(rep);
    addAttempt(sessionId, {
      at: Date.now(),
      unitIndex: currentUnit,
      rawTranscript: text,
      tokens: rep.tokens,
      score: rep.score,
      doubtful: rep.doubtful,
    });
    if (!rep.doubtful && rep.score === 1 && settings.autoApproveOnSuccess) approveUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetText, addAttempt, sessionId, currentUnit, settings.autoApproveOnSuccess]);

  const beginRecitation = useCallback(async () => {
    if (startingRef.current || micState === 'listening') return;
    startingRef.current = true;
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
        setSpeechNote('التعرف الصوتي غير متاح على هذا الجهاز — سمِّع لنفسك ثم اعتمد الحفظ يدويًا.');
        return;
      }
      if (provider.requiresNetwork && !isOnline()) {
        setMicState('unavailable');
        setSpeechNote('التعرف الصوتي غير متاح بدون اتصال حاليًا — سمِّع لنفسك ثم اعتمد الحفظ يدويًا.');
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

      const ok = await provider.startListening(settings.language || 'ar-SA', {
        onPartialResult: (t) => setPartial(t),
        onStateChange: (s) => setMicState(s),
        onFinalResult: (t) => {
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
      }
    } finally {
      startingRef.current = false;
    }
  }, [micState, stopLoop, settings.language, settings.autoCheck, runCheck]);

  const endRecitation = useCallback(async () => {
    setPhase('reviewing');
    try {
      await providerRef.current?.stopListening();
    } catch (e) {
      console.error('[memorization] stop listening failed', e);
      setMicState('idle');
      setSpeechNote('توقفت محاولة التسميع — أعد المحاولة.');
    }
  }, []);

  /* ─── interruptions (calls, background, screen lock) ─── */
  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) return;
          loopToken.current++;
          stopAudio();
          setAudioBusy(false);
          void providerRef.current?.dispose();
          if (micState === 'listening' || micState === 'requestingPermission') {
            setMicState('idle');
            setSpeechNote('توقفت محاولة التسميع — أعد المحاولة.');
          }
        });
        remove = () => { void handle.remove(); };
      } catch (e) {
        console.error('[memorization] app state listener failed', e);
      }
    })();
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      loopToken.current++;
      stopAudio();
      setAudioBusy(false);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      remove?.();
    };
  }, [micState]);

  /* ─── unit flow ─── */
  const approveUnit = useCallback(() => {
    markMemorized(sessionId, currentUnit);
    toast.success('تم اعتماد حفظ هذه الوحدة');
    if (settings.autoAdvance) goToUnit(currentUnit + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markMemorized, sessionId, currentUnit, settings.autoAdvance]);

  const goToUnit = useCallback((index: number) => {
    const next = Math.max(0, Math.min(units.length - 1, index));
    stopLoop();
    void providerRef.current?.dispose();
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

  /* auto play when a unit opens */
  const autoPlayedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.autoPlayAudio || unitsLoading || !unit) return;
    if (phase !== 'listening') return;
    if (autoPlayedFor.current === currentUnit) return;
    autoPlayedFor.current = currentUnit;
    if (repsDone < settings.repeatTarget) void runRepeats(settings.repeatTarget, repsDone === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUnit, unitsLoading, settings.autoPlayAudio, phase]);

  /* ─── settings sheet ─── */
  const [showSettings, setShowSettings] = useState(false);
  const setSetting = <K extends keyof MemorizationSettings>(key: K, value: MemorizationSettings[K]) => {
    patchSettings(sessionId, { [key]: value } as Partial<MemorizationSettings>);
  };

  const listening = micState === 'listening';
  const memorizedSet = useMemo(() => new Set(memorizedUnits), [memorizedUnits]);
  const hideText = phase === 'reciting';

  /* ─── render ─── */
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" dir="rtl">
      {/* top bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-3 py-2">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <button
            onClick={() => { stopLoop(); void providerRef.current?.dispose(); navigate('/sessions'); }}
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted/60"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-arabic font-bold text-sm truncate">{session.name}</h1>
            <p className="font-arabic text-[11px] text-muted-foreground">
              {unitsLoading
                ? 'جارٍ التجهيز…'
                : `الوحدة ${arabicNum(currentUnit + 1)} من ${arabicNum(units.length || 1)} • محفوظة ${arabicNum(memorizedUnits.length)}`}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted/60"
            aria-label="إعدادات الجلسة"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-3 py-4 space-y-4 pb-40">
        {/* units text */}
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          {unitsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground font-arabic text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تجهيز وحدات الحفظ…
            </div>
          ) : units.length === 0 ? (
            <p className="font-arabic text-sm text-muted-foreground">لا توجد آيات في النطاق المحدد.</p>
          ) : (
            <div className="space-y-2 leading-[2.4] text-right font-quran text-xl">
              {units.map(u => {
                const isCurrent = u.index === currentUnit;
                const isMemorized = memorizedSet.has(u.index);
                if (u.index > currentUnit && !isMemorized) {
                  return (
                    <p key={u.id} className="text-muted-foreground/35">{u.text}</p>
                  );
                }
                return (
                  <p
                    key={u.id}
                    data-unit-state={isMemorized ? 'memorized' : isCurrent ? 'current' : 'upcoming'}
                    className={
                      isMemorized
                        ? 'text-emerald-700 dark:text-emerald-300 rounded-lg px-1'
                        : isCurrent
                          ? 'text-foreground bg-primary/5 rounded-lg px-1 ring-1 ring-primary/30'
                          : 'text-muted-foreground'
                    }
                  >
                    {isCurrent && hideText
                      ? <span className="text-muted-foreground font-arabic text-base">النص مخفي أثناء التسميع…</span>
                      : u.text}
                  </p>
                );
              })}
            </div>
          )}
        </section>

        {/* listening & repetition */}
        {phase === 'listening' && unit && (
          <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-arabic text-sm font-bold">{unit.label}</span>
              <span className="font-arabic text-sm text-primary font-bold">
                التكرار {arabicNum(Math.min(repsDone, settings.repeatTarget))} / {arabicNum(settings.repeatTarget)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (repsDone / Math.max(1, settings.repeatTarget)) * 100)}%` }}
              />
            </div>
            {audioNote && (
              <p className="font-arabic text-xs text-amber-600 flex items-start gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{audioNote}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {!audioBusy ? (
                <Button className="h-12 font-arabic gap-2" onClick={() => runRepeats(settings.repeatTarget, repsDone >= settings.repeatTarget)}>
                  <Play className="w-5 h-5" /> تشغيل
                </Button>
              ) : audioPaused ? (
                <Button className="h-12 font-arabic gap-2" onClick={() => { void resumeAudio(); setAudioPaused(false); }}>
                  <Play className="w-5 h-5" /> متابعة
                </Button>
              ) : (
                <Button variant="secondary" className="h-12 font-arabic gap-2" onClick={() => { pauseAudio(); setAudioPaused(true); }}>
                  <Pause className="w-5 h-5" /> إيقاف مؤقت
                </Button>
              )}
              <Button variant="outline" className="h-12 font-arabic gap-2" onClick={() => runRepeats(settings.repeatTarget, true)}>
                <RotateCcw className="w-5 h-5" /> إعادة من البداية
              </Button>
              <Button variant="outline" className="h-12 font-arabic gap-2" onClick={() => runRepeats(repsDone + 1, false)}>
                <Plus className="w-5 h-5" /> تكرار مرة إضافية
              </Button>
              <Button className="h-12 font-arabic gap-2" onClick={() => void beginRecitation()}>
                <Mic className="w-5 h-5" /> ابدأ التسميع
              </Button>
            </div>
          </section>
        )}

        {/* transcript / result */}
        {(phase === 'reciting' || phase === 'reviewing') && (
          <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            {phase === 'reciting' && (
              <div className="flex items-center gap-2 font-arabic text-sm text-primary">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                {listening ? '🎙 جارٍ الاستماع' : micState === 'requestingPermission' ? 'طلب إذن الميكروفون…' : 'تجهيز الميكروفون…'}
              </div>
            )}
            {micState === 'processing' && (
              <p className="font-arabic text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> جارٍ استخراج النص…
              </p>
            )}
            {speechNote && (
              <p className="font-arabic text-xs text-amber-600 flex items-start gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{speechNote}
              </p>
            )}

            {(settings.transcriptVisibility === 'live' && phase === 'reciting' && partial) && (
              <div>
                <p className="font-arabic text-xs text-muted-foreground mb-1">ما يسمعه التطبيق الآن:</p>
                <p className="font-arabic text-base leading-8 text-muted-foreground">{partial}</p>
              </div>
            )}

            {phase === 'reviewing' && finalText && (
              <div>
                <p className="font-arabic text-xs text-muted-foreground mb-1">ما قرأتَه:</p>
                <p className="font-arabic text-base leading-8">{finalText}</p>
              </div>
            )}

            {phase === 'reviewing' && !settings.autoCheck && finalText && !report && (
              <Button className="h-12 w-full font-arabic" onClick={() => runCheck(finalText)}>
                تحقق من التسميع
              </Button>
            )}

            {report && (
              <div className="space-y-2">
                {report.doubtful && (
                  <p className="font-arabic text-xs text-muted-foreground">
                    نتيجة التعرف الصوتي غير مؤكدة — لا يعني ذلك بالضرورة خطأ منك.
                  </p>
                )}
                <p className="font-arabic text-sm">
                  الكلمات الصحيحة: {arabicNum(report.correct)} من {arabicNum(report.total)}
                </p>
                <div className="flex flex-wrap gap-1 justify-end" dir="rtl">
                  {report.tokens.map((t, i) => (
                    <span
                      key={i}
                      title={DIFF_LABEL[t.status]}
                      className={`px-2 py-1 rounded-lg text-base font-quran ${STATUS_CLASS[t.status]}`}
                    >
                      {t.expected || t.heard}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(['correct', 'missing', 'extra', 'different', 'order', 'unclear'] as const).map(k => (
                    <span key={k} className={`px-2 py-0.5 rounded text-[11px] font-arabic ${STATUS_CLASS[k]}`}>
                      {DIFF_LABEL[k]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {phase === 'reviewing' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" className="h-12 font-arabic gap-2" onClick={() => void beginRecitation()}>
                  <Mic className="w-5 h-5" /> إعادة التسميع
                </Button>
                <Button
                  variant="outline"
                  className="h-12 font-arabic gap-2"
                  onClick={() => { setPhase('listening'); void runRepeats(repsDone + 1, false); }}
                >
                  <Volume2 className="w-5 h-5" /> سماع المقطع مرة أخرى
                </Button>
                <Button className="h-12 font-arabic gap-2 col-span-2" onClick={approveUnit}>
                  <Check className="w-5 h-5" /> تم الحفظ
                </Button>
                {currentUnit < units.length - 1 && (
                  <Button variant="secondary" className="h-12 font-arabic col-span-2" onClick={() => goToUnit(currentUnit + 1)}>
                    الوحدة التالية
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {lastAttempt && phase === 'listening' && (
          <p className="font-arabic text-xs text-muted-foreground">
            آخر محاولة تسميع: {arabicNum(Math.round(lastAttempt.score * 100))}٪ — عدد المحاولات {arabicNum(record?.attemptCount || 0)}
          </p>
        )}
      </main>

      {/* sticky recording bar — always visible while the mic is open */}
      {phase === 'reciting' && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span className="font-arabic text-sm flex items-center gap-2 flex-1">
              <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              🎙 جارٍ الاستماع
            </span>
            <Button className="h-14 px-6 font-arabic text-base gap-2" variant="destructive" onClick={() => void endRecitation()}>
              <Square className="w-5 h-5" /> إنهاء التسميع
            </Button>
          </div>
        </div>
      )}

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
                  value={settings.startPage}
                  onChange={e => setSetting('startPage', Math.max(1, Number(e.target.value) || 1))}
                  className="h-11"
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">إلى صفحة</Label>
                <Input
                  type="number" inputMode="numeric" min={1} max={totalPages}
                  value={settings.endPage}
                  onChange={e => setSetting('endPage', Math.max(1, Number(e.target.value) || 1))}
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
                  value={settings.unitSize}
                  onChange={e => setSetting('unitSize', Math.max(1, Number(e.target.value) || 1))}
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
                  value={settings.repeatTarget}
                  onChange={e => setSetting('repeatTarget', Math.max(1, Number(e.target.value) || 1))}
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
                  <SelectItem value="cumulative" className="font-arabic">تراكمي</SelectItem>
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
              ['autoAdvance', 'الانتقال إلى الوحدة التالية تلقائيًا'],
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
              onClick={() => { resetSession(sessionId); stopLoop(); setShowSettings(false); toast.success('تم تصفير تقدم الجلسة'); }}
            >
              تصفير تقدم الجلسة
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
