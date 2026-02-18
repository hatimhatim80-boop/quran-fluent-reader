import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Map, ArrowLeft, Settings } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSettingsStore } from '@/stores/settingsStore';
import { SURAH_INFO, SURAH_NAMES } from '@/utils/quranPageIndex';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const SURAHS = Object.entries(SURAH_NAMES)
  .map(([name, number]) => ({ number, name, startPage: SURAH_INFO[number]?.[0] || 1 }))
  .sort((a, b) => a.number - b.number);

const STORAGE_KEY_CHOICE = 'ghareeb_entry_choice';
const STORAGE_KEY_REMEMBER = 'ghareeb_entry_remember';

type EntryChoice = 'range' | 'direct';

interface RangeConfig {
  type: 'surah' | 'pages';
  surahFrom?: number;
  surahTo?: number;
  pageFrom?: number;
  pageTo?: number;
}

interface GhareebEntryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GhareebEntryDialog({ open, onClose }: GhareebEntryDialogProps) {
  const navigate = useNavigate();
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const [remember, setRemember] = useState(false);
  const [step, setStep] = useState<'choose' | 'range'>('choose');
  const [rangeType, setRangeType] = useState<'surah' | 'pages'>('surah');
  const [surahFrom, setSurahFrom] = useState(1);
  const [surahTo, setSurahTo] = useState(1);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(10);

  const handleDirectEntry = () => {
    if (remember) {
      localStorage.setItem(STORAGE_KEY_CHOICE, 'direct');
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    }
    onClose();
    navigate('/mushaf');
  };

  const handleRangeChoice = () => {
    setStep('range');
  };

  const handleRangeConfirm = () => {
    // Apply range to autoplay settings
    if (rangeType === 'surah') {
      setAutoplay({
        ghareebRangeType: 'surah',
        ghareebRangeFrom: surahFrom,
        ghareebRangeTo: surahTo,
      });
    } else {
      setAutoplay({
        ghareebRangeType: 'page-range',
        ghareebRangeFrom: pageFrom,
        ghareebRangeTo: pageTo,
      });
    }

    if (remember) {
      localStorage.setItem(STORAGE_KEY_CHOICE, 'range');
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    }

    onClose();
    navigate('/mushaf');
  };

  const handleBack = () => setStep('choose');

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden rounded-2xl border-border"
        dir="rtl"
        // prevent closing on outside click
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 'choose' ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="bg-primary/10 px-6 py-5 text-center border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-arabic text-foreground">بوابة الغريب</h2>
              <p className="text-xs font-arabic text-muted-foreground mt-1">كيف تريد الدخول؟</p>
            </div>

            {/* Options */}
            <div className="p-5 space-y-3">
              {/* Range option */}
              <button
                onClick={handleRangeChoice}
                className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-right flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Map className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-arabic text-foreground text-sm">اختيار نطاق</div>
                  <div className="text-xs font-arabic text-muted-foreground mt-0.5">حدد السور أو الصفحات التي تريد مراجعتها</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Direct entry */}
              <button
                onClick={handleDirectEntry}
                className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-right flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-arabic text-foreground text-sm">دخول مباشر للمصحف</div>
                  <div className="text-xs font-arabic text-muted-foreground mt-0.5">استأنف من آخر صفحة بدون تحديد نطاق</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Remember checkbox */}
              <label className="flex items-center gap-3 px-1 py-2 cursor-pointer select-none group">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    remember ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  }`}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-arabic text-muted-foreground group-hover:text-foreground transition-colors">
                  تذكر اختياري ولا تعرض هذه الشاشة مرة أخرى
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="bg-primary/10 px-6 py-5 border-b border-border">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-xs font-arabic text-muted-foreground hover:text-primary transition-colors mb-3"
              >
                <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                رجوع
              </button>
              <h2 className="text-lg font-bold font-arabic text-foreground">تحديد النطاق</h2>
              <p className="text-xs font-arabic text-muted-foreground mt-0.5">اختر نطاق الكلمات الغريبة</p>
            </div>

            {/* Range selector */}
            <div className="p-5 space-y-4">
              {/* Type tabs */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setRangeType('surah')}
                  className={`flex-1 py-2 text-sm font-arabic transition-colors ${
                    rangeType === 'surah' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  بالسورة
                </button>
                <button
                  onClick={() => setRangeType('pages')}
                  className={`flex-1 py-2 text-sm font-arabic transition-colors ${
                    rangeType === 'pages' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  بالصفحات
                </button>
              </div>

              {rangeType === 'surah' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من سورة</Label>
                    <Select value={String(surahFrom)} onValueChange={(v) => setSurahFrom(Number(v))}>
                      <SelectTrigger className="font-arabic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SURAHS.map((s) => (
                          <SelectItem key={s.number} value={String(s.number)} className="font-arabic">
                            {s.number}. {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى سورة</Label>
                    <Select value={String(surahTo)} onValueChange={(v) => setSurahTo(Number(v))}>
                      <SelectTrigger className="font-arabic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {SURAHS.filter((s) => s.number >= surahFrom).map((s) => (
                          <SelectItem key={s.number} value={String(s.number)} className="font-arabic">
                            {s.number}. {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">من صفحة</Label>
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={pageFrom}
                      onChange={(e) => setPageFrom(Math.min(604, Math.max(1, Number(e.target.value))))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-arabic text-xs text-muted-foreground">إلى صفحة</Label>
                    <input
                      type="number"
                      min={pageFrom}
                      max={604}
                      value={pageTo}
                      onChange={(e) => setPageTo(Math.min(604, Math.max(pageFrom, Number(e.target.value))))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Remember */}
              <label className="flex items-center gap-3 px-1 py-1 cursor-pointer select-none group">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    remember ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  }`}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-arabic text-muted-foreground group-hover:text-foreground transition-colors">
                  تذكر اختياري ولا تعرض هذه الشاشة مرة أخرى
                </span>
              </label>

              {/* Confirm */}
              <button
                onClick={handleRangeConfirm}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-arabic font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                تطبيق النطاق والدخول
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** زر صغير لإعادة ضبط تفضيل الدخول */
export function GhareebEntryResetButton({ onReset }: { onReset: () => void }) {
  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY_CHOICE);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
    onReset();
  };
  return (
    <button
      onClick={handleReset}
      className="flex items-center gap-1 text-[11px] font-arabic text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
      title="تغيير طريقة الدخول"
    >
      <Settings className="w-3 h-3" />
      تغيير طريقة الدخول
    </button>
  );
}

/** Hook: يحدد ما إذا كان يجب عرض شاشة الاختيار */
export function useGhareebEntry() {
  const [showDialog, setShowDialog] = useState(false);
  const navigate = useNavigate();
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);

  const triggerEntry = () => {
    const remember = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    if (remember) {
      const choice = localStorage.getItem(STORAGE_KEY_CHOICE) as EntryChoice | null;
      if (choice === 'direct') {
        navigate('/mushaf');
        return;
      }
      if (choice === 'range') {
        // Go directly with whatever range is saved in settings store
        navigate('/mushaf');
        return;
      }
    }
    setShowDialog(true);
  };

  const closeDialog = () => setShowDialog(false);
  const resetPreference = () => setShowDialog(true);

  return { showDialog, triggerEntry, closeDialog, resetPreference };
}
