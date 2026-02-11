import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTahfeezStore } from '@/stores/tahfeezStore';
import { useQuranData } from '@/hooks/useQuranData';
import { Link } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, ArrowRight, Settings2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { TahfeezQuizView } from '@/components/TahfeezQuizView';

export default function TahfeezPage() {
  const {
    selectedWords, quizSource, setQuizSource,
    autoBlankMode, setAutoBlankMode,
    blankCount, setBlankCount,
    timerSeconds, setTimerSeconds,
    revealMode, setRevealMode,
  } = useTahfeezStore();

  const { currentPage, getCurrentPageData } = useQuranData();
  const pageData = getCurrentPageData();

  const [quizStarted, setQuizStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerDone, setTimerDone] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (!quizStarted || isPaused || timerDone) return;
    setTimeLeft(timerSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizStarted, isPaused, timerDone, timerSeconds]);

  // Compute blanked keys for gradual reveal
  const blankedKeys = useMemo((): string[] => {
    if (!pageData?.text) return [];
    // Build same keys as TahfeezQuizView would
    const lines = pageData.text.split('\n');
    const keys: string[] = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (line.startsWith('سُورَةُ') || line.startsWith('سورة ') || line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ')) continue;
      const tokens = line.split(/(\s+)/);
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (/^\s+$/.test(t)) continue;
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        if (/^[٠-٩0-9۰-۹]+$/.test(clean)) continue;
        keys.push(`${li}_${ti}`);
      }
    }
    return keys;
  }, [pageData?.text]);

  // Gradual reveal after timer
  useEffect(() => {
    if (!timerDone || revealMode !== 'gradual') return;
    let revIdx = 0;
    const interval = setInterval(() => {
      if (revIdx >= blankedKeys.length) {
        clearInterval(interval);
        return;
      }
      setRevealedIndices(prev => new Set([...prev, blankedKeys[revIdx]]));
      revIdx++;
    }, 500);
    return () => clearInterval(interval);
  }, [timerDone, revealMode, blankedKeys]);

  const handleStart = () => {
    setQuizStarted(true);
    setIsPaused(false);
    setTimerDone(false);
    setRevealedIndices(new Set());
    setShowSettings(false);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleRevealAll = () => {
    setTimerDone(true);
    setRevealedIndices(new Set(blankedKeys));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold font-arabic text-foreground">بوابة التحفيظ</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`nav-button w-8 h-8 rounded-full flex items-center justify-center ${showSettings ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <Link to="/" className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Settings panel */}
        {showSettings && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">إعدادات الاختبار</h2>

            {/* Source */}
            <div className="space-y-2">
              <label className="text-sm font-arabic text-muted-foreground">مصدر الكلمات</label>
              <div className="flex gap-2">
                <Button
                  variant={quizSource === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuizSource('custom')}
                  className="font-arabic"
                >
                  الكلمات المختارة ({selectedWords.length})
                </Button>
                <Button
                  variant={quizSource === 'auto' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuizSource('auto')}
                  className="font-arabic"
                >
                  إخفاء تلقائي
                </Button>
              </div>
            </div>

            {/* Auto blanking modes */}
            {quizSource === 'auto' && (
              <div className="space-y-3">
                <label className="text-sm font-arabic text-muted-foreground">نمط الإخفاء</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'beginning' as const, label: 'بداية الآية' },
                    { value: 'middle' as const, label: 'وسط الآية' },
                    { value: 'end' as const, label: 'نهاية الآية' },
                    { value: 'full-ayah' as const, label: 'الآية كاملة' },
                    { value: 'full-page' as const, label: 'الصفحة كاملة' },
                  ].map(opt => (
                    <Button
                      key={opt.value}
                      variant={autoBlankMode === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAutoBlankMode(opt.value)}
                      className="font-arabic text-xs"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>

                {autoBlankMode !== 'full-ayah' && autoBlankMode !== 'full-page' && (
                  <div className="space-y-1">
                    <label className="text-xs font-arabic text-muted-foreground">عدد الكلمات: {blankCount}</label>
                    <Slider
                      value={[blankCount]}
                      onValueChange={([v]) => setBlankCount(v)}
                      min={1} max={10} step={1}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Timer */}
            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مدة المؤقت: {timerSeconds} ثانية</label>
              <Slider
                value={[timerSeconds]}
                onValueChange={([v]) => setTimerSeconds(v)}
                min={3} max={30} step={1}
              />
            </div>

            {/* Reveal mode */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-arabic text-muted-foreground">كشف تدريجي</label>
              <Switch
                checked={revealMode === 'gradual'}
                onCheckedChange={(c) => setRevealMode(c ? 'gradual' : 'all')}
              />
            </div>

            {/* Start */}
            <Button onClick={handleStart} className="w-full font-arabic" disabled={!pageData}>
              <Play className="w-4 h-4 ml-2" />
              ابدأ الاختبار (صفحة {currentPage})
            </Button>

            {selectedWords.length === 0 && quizSource === 'custom' && (
              <p className="text-xs font-arabic text-muted-foreground text-center">
                لم تختر أي كلمات بعد. فعّل "وضع التحفيظ" من صفحة المصحف لاختيار الكلمات.
              </p>
            )}
          </div>
        )}

        {/* Full page quiz view */}
        {quizStarted && pageData && (
          <div className="space-y-4 animate-fade-in">
            {/* Timer bar */}
            <div className="page-frame p-3 flex items-center justify-between">
              <span className="text-sm font-arabic text-muted-foreground">
                صفحة {currentPage}
              </span>
              <span className={`text-lg font-bold font-arabic ${timeLeft <= 3 && !timerDone ? 'text-destructive' : 'text-foreground'}`}>
                {timerDone ? '✓' : `${timeLeft}s`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: timerDone ? '100%' : `${((timerSeconds - timeLeft) / timerSeconds) * 100}%` }}
              />
            </div>

            {/* Full Quran page with blanking */}
            <TahfeezQuizView
              page={pageData}
              quizSource={quizSource}
              selectedWords={selectedWords}
              autoBlankMode={autoBlankMode}
              blankCount={blankCount}
              revealedIndices={revealedIndices}
              timerDone={timerDone}
              revealMode={revealMode}
            />

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePauseResume} className="font-arabic">
                {isPaused ? <Play className="w-4 h-4 ml-1" /> : <Pause className="w-4 h-4 ml-1" />}
                {isPaused ? 'استئناف' : 'إيقاف'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRevealAll} className="font-arabic" disabled={timerDone && revealMode === 'all'}>
                <Eye className="w-4 h-4 ml-1" />
                كشف الآن
              </Button>
            </div>
          </div>
        )}

        {/* Selected words summary */}
        {!quizStarted && selectedWords.length > 0 && (
          <div className="page-frame p-4 space-y-3">
            <h3 className="font-arabic font-bold text-sm text-foreground">الكلمات المختارة ({selectedWords.length})</h3>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {selectedWords.map((w, i) => (
                <span key={i} className="inline-block bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-arabic">
                  {w.originalWord}
                  <span className="text-xs text-muted-foreground mr-1">ص{w.page}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
