import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTahfeezStore, TahfeezItem } from '@/stores/tahfeezStore';
import { toast } from 'sonner';
import { useQuranData } from '@/hooks/useQuranData';
import { useSettingsApplier } from '@/hooks/useSettingsApplier';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Play, Pause, Eye, ArrowRight, Save, Trash2, GraduationCap, ListChecks, Zap, Book, Layers, Hash, FileText, Search, X, ChevronLeft, Download, Upload, Settings2, Maximize2, Minimize2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TahfeezQuizView } from '@/components/TahfeezQuizView';
import { TahfeezSelectionView } from '@/components/TahfeezSelectionView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { SettingsDialog } from '@/components/SettingsDialog';
// ---- Quran Index Data ----
const SURAHS = Object.entries(SURAH_NAMES).map(([name, number]) => ({
  number, name,
  startPage: SURAH_INFO[number]?.[0] || 1,
})).sort((a, b) => a.number - b.number);

const JUZ_DATA = [
  { number: 1, name: 'الم', page: 1 }, { number: 2, name: 'سيقول', page: 22 },
  { number: 3, name: 'تلك الرسل', page: 42 }, { number: 4, name: 'لن تنالوا', page: 62 },
  { number: 5, name: 'والمحصنات', page: 82 }, { number: 6, name: 'لا يحب الله', page: 102 },
  { number: 7, name: 'وإذا سمعوا', page: 121 }, { number: 8, name: 'ولو أننا', page: 142 },
  { number: 9, name: 'قال الملأ', page: 162 }, { number: 10, name: 'واعلموا', page: 182 },
  { number: 11, name: 'يعتذرون', page: 201 }, { number: 12, name: 'وما من دابة', page: 222 },
  { number: 13, name: 'وما أبرئ', page: 242 }, { number: 14, name: 'ربما', page: 262 },
  { number: 15, name: 'سبحان الذي', page: 282 }, { number: 16, name: 'قال ألم', page: 302 },
  { number: 17, name: 'اقترب للناس', page: 322 }, { number: 18, name: 'قد أفلح', page: 342 },
  { number: 19, name: 'وقال الذين', page: 362 }, { number: 20, name: 'أمن خلق', page: 382 },
  { number: 21, name: 'اتل ما أوحي', page: 402 }, { number: 22, name: 'ومن يقنت', page: 422 },
  { number: 23, name: 'وما لي', page: 442 }, { number: 24, name: 'فمن أظلم', page: 462 },
  { number: 25, name: 'إليه يرد', page: 482 }, { number: 26, name: 'حم', page: 502 },
  { number: 27, name: 'قال فما خطبكم', page: 522 }, { number: 28, name: 'قد سمع الله', page: 542 },
  { number: 29, name: 'تبارك الذي', page: 562 }, { number: 30, name: 'عم', page: 582 },
];

export default function TahfeezPage() {
  const {
    storedItems, clearAllItems, addItem, removeItem, getItemKey,
    quizSource, setQuizSource,
    autoBlankMode, setAutoBlankMode,
    blankCount, setBlankCount,
    ayahCount, setAyahCount,
    timerSeconds, setTimerSeconds,
    firstWordTimerSeconds, setFirstWordTimerSeconds,
    revealMode, setRevealMode,
    activeTab, setActiveTab,
    selectionMode, setSelectionMode,
    rangeAnchor, setRangeAnchor,
  } = useTahfeezStore();

  const { currentPage, getCurrentPageData, goToPage, totalPages } = useQuranData();
  useSettingsApplier(); // Apply font/display settings globally
  const pageData = getCurrentPageData();

  const [quizStarted, setQuizStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [blankedKeysList, setBlankedKeysList] = useState<string[]>([]);
  const [firstKeysSet, setFirstKeysSet] = useState<Set<string>>(new Set());
  const [currentRevealIdx, setCurrentRevealIdx] = useState(-1);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  const [indexTab, setIndexTab] = useState('surahs');
  const [fullscreen, setFullscreen] = useState(false);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom handler
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: pinchScale };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = Math.min(3, Math.max(0.5, pinchRef.current.startScale * (dist / pinchRef.current.startDist)));
        setPinchScale(newScale);
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pinchScale]);

  // Read blanked keys from the quiz view after it renders
  useEffect(() => {
    if (!quizStarted) return;
    const readKeys = () => {
      const el = document.getElementById('tahfeez-blanked-keys');
      if (el) {
        try {
          const keys = JSON.parse(el.getAttribute('data-keys') || '[]');
          const fKeys = JSON.parse(el.getAttribute('data-first-keys') || '[]');
          if (keys.length > 0 && JSON.stringify(keys) !== JSON.stringify(blankedKeysList)) {
            setBlankedKeysList(keys);
            setFirstKeysSet(new Set(fKeys));
          }
        } catch {}
      }
    };
    const timer = setTimeout(readKeys, 100);
    return () => clearTimeout(timer);
  }, [quizStarted, pageData]);

  // Auto-reveal sequencing
  useEffect(() => {
    if (!quizStarted || isPaused || showAll || blankedKeysList.length === 0) return;

    const revealNext = (idx: number) => {
      if (idx >= blankedKeysList.length) {
        setShowAll(true);
        setActiveBlankKey(null);
        return;
      }
      const key = blankedKeysList[idx];
      const isFirstKey = firstKeysSet.has(key);

      if (isFirstKey) {
        // First word of each ayah/phrase: wait the "thinking" delay BEFORE showing it
        setActiveBlankKey(null); // keep hidden during thinking delay
        setCurrentRevealIdx(idx);
        revealTimerRef.current = setTimeout(() => {
          // Now highlight it as active
          setActiveBlankKey(key);
          // Then reveal after normal timer
          revealTimerRef.current = setTimeout(() => {
            setRevealedKeys(prev => new Set([...prev, key]));
            setActiveBlankKey(null);
            revealTimerRef.current = setTimeout(() => revealNext(idx + 1), 300);
          }, timerSeconds * 1000);
        }, firstWordTimerSeconds * 1000);
      } else {
        setActiveBlankKey(key);
        setCurrentRevealIdx(idx);
        revealTimerRef.current = setTimeout(() => {
          setRevealedKeys(prev => new Set([...prev, key]));
          setActiveBlankKey(null);
          revealTimerRef.current = setTimeout(() => revealNext(idx + 1), 300);
        }, timerSeconds * 1000);
      }
    };

    const startIdx = currentRevealIdx < 0 ? 0 : currentRevealIdx;
    if (startIdx < blankedKeysList.length && !revealedKeys.has(blankedKeysList[startIdx])) {
      revealNext(startIdx);
    }

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [quizStarted, isPaused, showAll, blankedKeysList, timerSeconds, firstWordTimerSeconds, firstKeysSet]);

  const handleStart = () => {
    setQuizStarted(true);
    setIsPaused(false);
    setShowAll(false);
    setRevealedKeys(new Set());
    setActiveBlankKey(null);
    setCurrentRevealIdx(-1);
    setBlankedKeysList([]);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      // Resume from next unrevealed
      const nextIdx = blankedKeysList.findIndex(k => !revealedKeys.has(k));
      if (nextIdx >= 0) setCurrentRevealIdx(nextIdx);
    } else {
      setIsPaused(true);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    }
  };

  const handleRevealAll = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setShowAll(true);
    setActiveBlankKey(null);
  };

  const handleGoToMushaf = () => {
    setSelectionMode(true);
  };

  const handleNavigateToPage = (page: number) => {
    goToPage(page);
    setShowIndex(false);
  };

  const pageItems = storedItems.filter(i => i.data.page === currentPage);
  const progress = blankedKeysList.length > 0
    ? Math.round(((revealedKeys.size) / blankedKeysList.length) * 100)
    : 0;

  const filteredSurahs = useMemo(() => {
    if (!indexSearch.trim()) return SURAHS;
    const q = indexSearch.trim();
    return SURAHS.filter(s => s.name.includes(q) || s.number.toString() === q);
  }, [indexSearch]);

  const tabs = [
    { id: 'store' as const, icon: Save, label: 'تخزين' },
    { id: 'custom-quiz' as const, icon: ListChecks, label: 'اختبار المخزون' },
    { id: 'auto-quiz' as const, icon: Zap, label: 'اختبار تلقائي' },
  ];

  // Index overlay
  if (showIndex) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <h2 className="font-arabic font-bold text-foreground text-sm">فهرس التحفيظ</h2>
            <button onClick={() => setShowIndex(false)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Tabs value={indexTab} onValueChange={setIndexTab}>
            <TabsList className="grid grid-cols-4 h-9 mb-3">
              <TabsTrigger value="surahs" className="text-xs font-arabic gap-1"><Book className="w-3 h-3" />السور</TabsTrigger>
              <TabsTrigger value="juz" className="text-xs font-arabic gap-1"><Layers className="w-3 h-3" />الأجزاء</TabsTrigger>
              <TabsTrigger value="hizb" className="text-xs font-arabic gap-1"><Hash className="w-3 h-3" />الأحزاب</TabsTrigger>
              <TabsTrigger value="pages" className="text-xs font-arabic gap-1"><FileText className="w-3 h-3" />الصفحات</TabsTrigger>
            </TabsList>

            <TabsContent value="surahs" className="space-y-2">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={indexSearch} onChange={e => setIndexSearch(e.target.value)} placeholder="بحث عن سورة..." className="h-8 text-xs font-arabic pr-8" />
              </div>
              <div className="max-h-[65vh] overflow-y-auto space-y-0.5">
                {filteredSurahs.map(s => (
                  <button key={s.number} onClick={() => handleNavigateToPage(s.startPage)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic transition-colors ${currentPage >= s.startPage ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] font-mono">{s.number}</span>
                      <span>{s.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">ص {s.startPage}</span>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="juz" className="max-h-[70vh] overflow-y-auto space-y-0.5">
              {JUZ_DATA.map(j => (
                <button key={j.number} onClick={() => handleNavigateToPage(j.page)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic transition-colors ${currentPage >= j.page ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-[10px] font-mono">{j.number}</span>
                    <span>الجزء {j.number}</span>
                    <span className="text-muted-foreground text-[10px]">({j.name})</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">ص {j.page}</span>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="hizb" className="max-h-[70vh] overflow-y-auto space-y-0.5">
              {JUZ_DATA.flatMap((juz, idx) => {
                const nextPage = idx < 29 ? JUZ_DATA[idx + 1].page : 605;
                const midPage = Math.floor((juz.page + nextPage) / 2);
                return [
                  <button key={`h${juz.number * 2 - 1}`} onClick={() => handleNavigateToPage(juz.page)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic hover:bg-muted/60 transition-colors">
                    <span>الحزب {juz.number * 2 - 1} <span className="text-muted-foreground">(الجزء {juz.number})</span></span>
                    <span className="text-[10px] text-muted-foreground">ص {juz.page}</span>
                  </button>,
                  <button key={`h${juz.number * 2}`} onClick={() => handleNavigateToPage(midPage)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-arabic hover:bg-muted/60 transition-colors">
                    <span>الحزب {juz.number * 2} <span className="text-muted-foreground">(الجزء {juz.number})</span></span>
                    <span className="text-[10px] text-muted-foreground">ص {midPage}</span>
                  </button>,
                ];
              })}
            </TabsContent>

            <TabsContent value="pages" className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-arabic text-muted-foreground">انتقال سريع للصفحة</label>
                <div className="flex items-center gap-2">
                  <Slider value={[currentPage]} onValueChange={([v]) => goToPage(v)} min={1} max={totalPages} step={1} className="flex-1" />
                  <span className="text-sm font-arabic font-bold min-w-[3rem] text-center">{currentPage}</span>
                </div>
                <Button onClick={() => setShowIndex(false)} className="w-full font-arabic text-xs" size="sm">
                  الذهاب لصفحة {currentPage}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl" ref={contentRef}>
      {/* Header */}
      {!fullscreen && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-lg font-bold font-arabic text-foreground">بوابة التحفيظ</h1>
            </div>
            <div className="flex items-center gap-2">
              <SettingsDialog>
                <button className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="الإعدادات">
                  <Settings2 className="w-4 h-4" />
                </button>
              </SettingsDialog>
              <button onClick={() => setShowIndex(true)} className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="فهرس المصحف">
                <Book className="w-4 h-4" />
              </button>
              <Link to="/mushaf" className="nav-button w-8 h-8 rounded-full flex items-center justify-center" title="بوابة الغريب">
                <BookOpen className="w-4 h-4" />
              </Link>
              <Link to="/" className="nav-button w-8 h-8 rounded-full flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {/* Current page indicator */}
          <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="text-xs font-arabic h-7 px-2">→</Button>
            <span className="text-xs font-arabic text-muted-foreground">صفحة {currentPage} / {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="text-xs font-arabic h-7 px-2">←</Button>
          </div>
        </div>
      )}

      {/* Fullscreen toggle - always visible */}
      <button
        onClick={() => setFullscreen(!fullscreen)}
        className={`fixed top-3 left-3 z-50 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
          fullscreen ? 'bg-primary text-primary-foreground' : 'bg-background/90 border border-border text-foreground'
        }`}
        title={fullscreen ? 'إظهار الأشرطة' : 'صفحة كاملة'}
      >
        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {/* Tab icons */}
      {!quizStarted && !fullscreen && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex justify-center gap-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-arabic font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-3 py-6 space-y-6" style={{ transform: `scale(${pinchScale})`, transformOrigin: 'top center', transition: pinchRef.current ? 'none' : 'transform 0.2s ease' }}>
        {/* Tab 1: Store words */}
        {/* Fullscreen: show only the quran page text */}
        {fullscreen && pageData && (
          <div className="animate-fade-in">
            <TahfeezSelectionView page={pageData} />
          </div>
        )}

        {!fullscreen && !quizStarted && activeTab === 'store' && (
          <div className="space-y-4 animate-fade-in">
            {pageData && (
              <TahfeezSelectionView page={pageData} />
            )}

            {storedItems.length > 0 && (
              <div className="page-frame p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-arabic font-bold text-sm text-foreground">
                    المخزون ({storedItems.length})
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const data = JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), items: storedItems }, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'tahfeez-items.json'; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('تم تصدير المخزون');
                    }} className="font-arabic text-xs h-7 px-2">
                      <Download className="w-3 h-3 ml-1" />
                      تصدير
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file'; input.accept = '.json';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const parsed = JSON.parse(ev.target?.result as string);
                            const items = parsed.items || parsed;
                            if (Array.isArray(items)) {
                              items.forEach((item: TahfeezItem) => addItem(item));
                              toast.success(`تم استيراد ${items.length} عنصر`);
                            } else { toast.error('ملف غير صالح'); }
                          } catch { toast.error('فشل قراءة الملف'); }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }} className="font-arabic text-xs h-7 px-2">
                      <Upload className="w-3 h-3 ml-1" />
                      استيراد
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllItems} className="text-destructive font-arabic text-xs h-7 px-2">
                      <Trash2 className="w-3 h-3 ml-1" />
                      مسح الكل
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {storedItems.map((item, i) => (
                    <StoredItemBadge key={i} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Custom quiz (stored words) */}
        {!fullscreen && !quizStarted && activeTab === 'custom-quiz' && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار المخزون</h2>

            {storedItems.length === 0 ? (
              <p className="text-xs font-arabic text-muted-foreground text-center py-4">
                لم تخزّن أي كلمات بعد. اذهب لتبويب "تخزين" أولاً.
              </p>
            ) : (
              <>
                <p className="text-xs font-arabic text-muted-foreground">
                  سيتم إخفاء {pageItems.length} عنصر في صفحة {currentPage}
                </p>

                <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds} ثانية</label>
                  <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(v)} min={1} max={30} step={1} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds} ثانية</label>
                  <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={1} max={10} step={1} />
                </div>

                <Button onClick={() => { setQuizSource('custom'); handleStart(); }} className="w-full font-arabic" disabled={!pageData || pageItems.length === 0}>
                  <Play className="w-4 h-4 ml-2" />
                  ابدأ الاختبار (صفحة {currentPage})
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Auto quiz */}
        {!fullscreen && !quizStarted && activeTab === 'auto-quiz' && (
          <div className="page-frame p-5 space-y-5 animate-fade-in">
            <h2 className="font-arabic font-bold text-foreground">اختبار تلقائي</h2>

            <div className="space-y-3">
              <label className="text-sm font-arabic text-muted-foreground">نمط الإخفاء</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'beginning' as const, label: 'أول الآية' },
                  { value: 'middle' as const, label: 'وسط الآية' },
                  { value: 'end' as const, label: 'آخر الآية' },
                  { value: 'beginning-middle' as const, label: 'أول + وسط' },
                  { value: 'middle-end' as const, label: 'وسط + آخر' },
                  { value: 'beginning-end' as const, label: 'أول + آخر' },
                  { value: 'full-ayah' as const, label: 'آية كاملة' },
                  { value: 'ayah-count' as const, label: 'عدد آيات' },
                  { value: 'full-page' as const, label: 'صفحة كاملة' },
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

              {(['beginning', 'middle', 'end', 'beginning-middle', 'middle-end', 'beginning-end'] as const).includes(autoBlankMode as any) && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الكلمات: {blankCount}</label>
                  <Slider value={[blankCount]} onValueChange={([v]) => setBlankCount(v)} min={1} max={10} step={1} />
                </div>
              )}

              {autoBlankMode === 'ayah-count' && (
                <div className="space-y-1">
                  <label className="text-xs font-arabic text-muted-foreground">عدد الآيات: {ayahCount}</label>
                  <Slider value={[ayahCount]} onValueChange={([v]) => setAyahCount(v)} min={1} max={15} step={1} />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مهلة التفكير قبل الكلمة الأولى: {firstWordTimerSeconds} ثانية</label>
              <Slider value={[firstWordTimerSeconds]} onValueChange={([v]) => setFirstWordTimerSeconds(v)} min={1} max={30} step={1} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-arabic text-muted-foreground">مدة ظهور كل كلمة: {timerSeconds} ثانية</label>
              <Slider value={[timerSeconds]} onValueChange={([v]) => setTimerSeconds(v)} min={1} max={10} step={1} />
            </div>

            <Button onClick={() => { setQuizSource('auto'); handleStart(); }} className="w-full font-arabic" disabled={!pageData}>
              <Play className="w-4 h-4 ml-2" />
              ابدأ الاختبار (صفحة {currentPage})
            </Button>
          </div>
        )}

        {/* Quiz view */}
        {quizStarted && pageData && (
          <div className="space-y-4 animate-fade-in">
            {/* Progress */}
            <div className="page-frame p-3 flex items-center justify-between">
              <span className="text-sm font-arabic text-muted-foreground">
                {revealedKeys.size} / {blankedKeysList.length} كلمة
              </span>
              <span className={`text-lg font-bold font-arabic ${showAll ? 'text-green-600' : 'text-foreground'}`}>
                {showAll ? '✓ تم الكشف' : `${progress}%`}
              </span>
            </div>

            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            <TahfeezQuizView
              page={pageData}
              quizSource={quizSource}
              storedItems={storedItems}
              autoBlankMode={autoBlankMode}
              blankCount={blankCount}
              ayahCount={ayahCount}
              activeBlankKey={activeBlankKey}
              revealedKeys={revealedKeys}
              showAll={showAll}
            />

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePauseResume} className="font-arabic">
                {isPaused ? <Play className="w-4 h-4 ml-1" /> : <Pause className="w-4 h-4 ml-1" />}
                {isPaused ? 'استئناف' : 'إيقاف'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRevealAll} className="font-arabic" disabled={showAll}>
                <Eye className="w-4 h-4 ml-1" />
                كشف الكل
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setQuizStarted(false); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); }} className="font-arabic">
                إعادة
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StoredItemBadge({ item }: { item: TahfeezItem }) {
  const removeItem = useTahfeezStore(s => s.removeItem);
  const getItemKey = useTahfeezStore(s => s.getItemKey);

  const text = item.type === 'word' ? item.data.originalWord : item.data.originalText;
  const page = item.data.page;
  const label = item.type === 'phrase' ? '📝' : '';

  return (
    <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-arabic group">
      {label}{text}
      <span className="text-xs text-muted-foreground mr-1">ص{page}</span>
      <button
        onClick={() => removeItem(getItemKey(item))}
        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity mr-1"
      >
        ×
      </button>
    </span>
  );
}
