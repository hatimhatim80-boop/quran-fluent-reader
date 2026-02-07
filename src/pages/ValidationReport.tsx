import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Loader2, AlertTriangle, CheckCircle, XCircle, Edit3, Search, Filter, RotateCcw, Upload, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { loadGhareebData } from '@/utils/ghareebLoader';
import { parseMushafText } from '@/utils/quranParser';
import { validateMatching, exportReportAsJSON, exportReportAsCSV, MatchingReport, MismatchEntry, MismatchReason } from '@/utils/matchingValidator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CorrectionDialog } from '@/components/CorrectionDialog';
import { useCorrectionsStore } from '@/stores/correctionsStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';

const REASON_LABELS: Record<MismatchReason, string> = {
  not_found_in_page: 'غير موجودة',
  diacritic_mismatch: 'اختلاف تشكيل',
  page_number_off: 'صفحة مختلفة',
  duplicate_match: 'مكررة',
  partial_match: 'تطابق جزئي',
  unknown: 'غير معروف',
};

export default function ValidationReport() {
  const navigate = useNavigate();
  const { corrections, getIgnoredKeys, exportCorrections, importCorrections, undo, canUndo, resetAll, addCorrection } = useCorrectionsStore();
  const { addWordOverride } = useDataStore();
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<MismatchReason | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIgnored, setShowIgnored] = useState(false);
  
  // Add word dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWordForm, setNewWordForm] = useState({
    pageNumber: 1,
    wordText: '',
    meaning: '',
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
  });
  
  // Correction dialog state
  const [selectedMismatch, setSelectedMismatch] = useState<MismatchEntry | null>(null);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  
  // All words for duplicate matching
  const [allWords, setAllWords] = useState<Array<{ word: string; surah: number; ayah: number; wordIndex: number; page: number }>>([]);

  useEffect(() => {
    async function runValidation() {
      try {
        setLoading(true);
        
        // تحميل البيانات
        const [ghareebMap, mushafResponse] = await Promise.all([
          loadGhareebData(),
          fetch('/data/mushaf.txt').then((r) => r.text()),
        ]);
        
        const pages = parseMushafText(mushafResponse);
        
        // Build all words list for duplicate matching
        const words: Array<{ word: string; surah: number; ayah: number; wordIndex: number; page: number }> = [];
        ghareebMap.forEach((pageWords) => {
          pageWords.forEach((w) => {
            words.push({
              word: w.wordText,
              surah: w.surahNumber,
              ayah: w.verseNumber,
              wordIndex: w.wordIndex,
              page: w.pageNumber,
            });
          });
        });
        setAllWords(words);
        
        // تشغيل التحقق
        const result = validateMatching(ghareebMap, pages);
        setReport(result);
      } catch (err) {
        console.error('Validation error:', err);
        setError('حدث خطأ أثناء التحقق من البيانات');
      } finally {
        setLoading(false);
      }
    }
    
    runValidation();
  }, []);

  // Filter out ignored corrections
  const ignoredKeys = useMemo(() => getIgnoredKeys(), [corrections, getIgnoredKeys]);

  const filteredMismatches = useMemo(() => {
    if (!report) return [];
    
    let filtered = report.mismatches;
    
    // Show or hide ignored
    if (!showIgnored) {
      filtered = filtered.filter((m) => !ignoredKeys.has(m.word.uniqueKey));
    }
    
    if (filterReason !== 'all') {
      filtered = filtered.filter((m) => m.reason === filterReason);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((m) => 
        m.word.wordText.includes(query) ||
        m.word.surahName.toLowerCase().includes(query) ||
        m.detail.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [report, filterReason, searchQuery, ignoredKeys, showIgnored]);

  const handleAddMissingWord = () => {
    const key = `${newWordForm.surahNumber}_${newWordForm.verseNumber}_${newWordForm.wordIndex}`;
    addWordOverride({
      key,
      operation: 'add',
      pageNumber: newWordForm.pageNumber,
      wordText: newWordForm.wordText,
      meaning: newWordForm.meaning,
      surahNumber: newWordForm.surahNumber,
      verseNumber: newWordForm.verseNumber,
      wordIndex: newWordForm.wordIndex,
      surahName: '',
    });
    setShowAddDialog(false);
    setNewWordForm({
      pageNumber: 1,
      wordText: '',
      meaning: '',
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: 0,
    });
    toast.success('تمت إضافة الكلمة المفقودة');
  };

  const handleIgnoreWord = (mismatch: MismatchEntry) => {
    addCorrection({
      originalKey: mismatch.word.uniqueKey,
      originalWord: mismatch.word.wordText,
      originalSurah: mismatch.word.surahNumber,
      originalAyah: mismatch.word.verseNumber,
      originalWordIndex: mismatch.word.wordIndex,
      originalPage: mismatch.word.pageNumber,
      type: 'page_override',
      ignored: true,
    });
    toast.success('تم تجاهل الكلمة');
  };

  const handleExportJSON = () => {
    if (!report) return;
    const json = exportReportAsJSON(report);
    downloadFile(json, 'matching-report.json', 'application/json');
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csv = exportReportAsCSV(report);
    downloadFile(csv, 'matching-report.csv', 'text/csv;charset=utf-8');
  };

  const handleExportCorrections = () => {
    const json = exportCorrections();
    downloadFile(json, 'corrections.json', 'application/json');
    toast.success('تم تصدير التصحيحات');
  };

  const handleImportCorrections = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          const result = importCorrections(json);
          if (result.success) {
            toast.success(`تم استيراد ${result.count} تصحيح`);
          } else {
            toast.error('فشل استيراد التصحيحات');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const goToPage = (pageNumber: number) => {
    localStorage.setItem('quran_current_page', pageNumber.toString());
    navigate('/');
  };

  const openCorrectionDialog = (mismatch: MismatchEntry) => {
    setSelectedMismatch(mismatch);
    setCorrectionDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="font-arabic text-muted-foreground">جاري التحقق من جميع الكلمات...</p>
          <p className="font-arabic text-sm text-muted-foreground/70">قد يستغرق هذا بضع ثوانٍ</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="page-frame p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="font-arabic text-destructive">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            العودة للقراءة
          </Button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const reasonCounts = report.mismatches.reduce((acc, m) => {
    if (!ignoredKeys.has(m.word.uniqueKey)) {
      acc[m.reason] = (acc[m.reason] || 0) + 1;
    }
    return acc;
  }, {} as Record<MismatchReason, number>);

  const activeUnmatchedCount = report.mismatches.filter((m) => !ignoredKeys.has(m.word.uniqueKey)).length;

  return (
    <div className="min-h-screen bg-background py-6 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-arabic">العودة للقراءة</span>
          </button>
          <h1 className="text-xl font-bold font-arabic">تقرير التحقق من المطابقة</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-primary">{report.totalGhareebWords.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">إجمالي الكلمات</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-accent">{report.matchedCount.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">مطابقة</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{activeUnmatchedCount.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">غير مطابقة</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-primary">{report.coveragePercent}%</div>
            <div className="text-sm font-arabic text-muted-foreground">نسبة التغطية</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-accent">{corrections.length}</div>
            <div className="text-sm font-arabic text-muted-foreground">التصحيحات</div>
          </div>
        </div>

        {/* Reason Breakdown */}
        {Object.keys(reasonCounts).length > 0 && (
          <div className="page-frame p-4">
            <h2 className="font-arabic font-bold mb-3">أسباب عدم المطابقة</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(reasonCounts).map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-3 py-1 rounded-full bg-muted text-sm font-arabic cursor-pointer hover:bg-muted/80"
                  onClick={() => setFilterReason(reason as MismatchReason)}
                >
                  {REASON_LABELS[reason as MismatchReason]}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex flex-wrap gap-3">
          {/* Add Missing Word Button */}
          <Button onClick={() => setShowAddDialog(true)} variant="default" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="font-arabic">إضافة كلمة مفقودة</span>
          </Button>
          <div className="h-8 w-px bg-border mx-1" />
          <Button onClick={handleExportJSON} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير JSON</span>
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير CSV</span>
          </Button>
          <div className="h-8 w-px bg-border mx-1" />
          <Button onClick={handleExportCorrections} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير التصحيحات</span>
          </Button>
          <Button onClick={handleImportCorrections} variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            <span className="font-arabic">استيراد</span>
          </Button>
          {canUndo() && (
            <Button onClick={undo} variant="ghost" size="sm" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              <span className="font-arabic">تراجع</span>
            </Button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الكلمات..."
              className="pr-10 font-arabic"
            />
          </div>
          <Select value={filterReason} onValueChange={(v) => setFilterReason(v as MismatchReason | 'all')}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({activeUnmatchedCount})</SelectItem>
              {Object.entries(reasonCounts).map(([reason, count]) => (
                <SelectItem key={reason} value={reason}>
                  {REASON_LABELS[reason as MismatchReason]} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showIgnored ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowIgnored(!showIgnored)}
            className="gap-2"
          >
            {showIgnored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="font-arabic">{showIgnored ? 'إظهار المتجاهل' : 'إخفاء المتجاهل'}</span>
          </Button>
        </div>

        {/* Mismatches List */}
        {filteredMismatches.length === 0 ? (
          <div className="page-frame p-8 text-center">
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <p className="font-arabic text-lg">
              {searchQuery ? 'لا توجد نتائج' : 'جميع الكلمات مطابقة!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-arabic font-bold">
              قائمة غير المطابق ({filteredMismatches.length})
            </h2>
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {filteredMismatches.slice(0, 200).map((m, idx) => (
                <div
                  key={`${m.word.uniqueKey}-${idx}`}
                  className="page-frame p-3 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-arabic text-lg font-bold">{m.word.wordText}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">
                        {REASON_LABELS[m.reason]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-arabic mt-1">
                      {m.word.surahName} - آية {m.word.verseNumber} - ص{m.word.pageNumber}
                    </div>
                    <div className="text-xs text-muted-foreground/80 font-arabic mt-1">
                      {m.detail}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCorrectionDialog(m)}
                      className="gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="font-arabic">تعديل</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => goToPage(m.word.pageNumber)}
                    >
                      <span className="font-arabic">انتقل</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleIgnoreWord(m)}
                      className="text-muted-foreground"
                    >
                      <EyeOff className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredMismatches.length > 200 && (
                <p className="text-center text-sm text-muted-foreground font-arabic py-4">
                  يُعرض أول 200 نتيجة. صدّر الملف للحصول على القائمة الكاملة.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground/60 font-arabic">
          تم التحقق في: {new Date(report.generatedAt).toLocaleString('ar-EG')}
        </div>
      </div>

      {/* Correction Dialog */}
      <CorrectionDialog
        mismatch={selectedMismatch}
        isOpen={correctionDialogOpen}
        onClose={() => setCorrectionDialogOpen(false)}
        onNavigate={goToPage}
        allWords={allWords}
      />

      {/* Add Missing Word Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
            <h3 className="font-arabic font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" />
              إضافة كلمة مفقودة
            </h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الصفحة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={604}
                    value={newWordForm.pageNumber}
                    onChange={(e) => setNewWordForm(f => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">السورة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={114}
                    value={newWordForm.surahNumber}
                    onChange={(e) => setNewWordForm(f => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الآية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newWordForm.verseNumber}
                    onChange={(e) => setNewWordForm(f => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newWordForm.wordIndex}
                    onChange={(e) => setNewWordForm(f => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label className="font-arabic text-xs">الكلمة</Label>
                <Input
                  value={newWordForm.wordText}
                  onChange={(e) => setNewWordForm(f => ({ ...f, wordText: e.target.value }))}
                  className="font-arabic"
                  placeholder="الكلمة القرآنية"
                  dir="rtl"
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">المعنى</Label>
                <Input
                  value={newWordForm.meaning}
                  onChange={(e) => setNewWordForm(f => ({ ...f, meaning: e.target.value }))}
                  className="font-arabic"
                  placeholder="معنى الكلمة"
                  dir="rtl"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleAddMissingWord} className="flex-1 font-arabic">
                <Plus className="w-4 h-4 ml-2" />
                إضافة
              </Button>
              <Button onClick={() => setShowAddDialog(false)} variant="outline" className="flex-1 font-arabic">
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
