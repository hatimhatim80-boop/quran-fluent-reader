import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Download, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Search, 
  Filter, 
  RotateCcw, 
  Upload, 
  Plus, 
  RefreshCw, 
  Eye, 
  EyeOff,
  ArrowUpDown,
  FileText,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { loadGhareebData } from '@/utils/ghareebLoader';
import { parseMushafText } from '@/utils/quranParser';
import { validateMatching, exportReportAsJSON, exportReportAsCSV, MatchingReport, MismatchEntry, MismatchReason } from '@/utils/matchingValidator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CorrectionDialog } from '@/components/CorrectionDialog';
import { useCorrectionsStore } from '@/stores/correctionsStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

const REASON_LABELS: Record<MismatchReason, string> = {
  not_found_in_page: 'غير موجودة في الصفحة',
  diacritic_mismatch: 'اختلاف التشكيل',
  page_number_off: 'صفحة مختلفة',
  duplicate_match: 'تكرار',
  partial_match: 'تطابق جزئي',
  unknown: 'غير معروف',
};

const REASON_ICONS: Record<MismatchReason, string> = {
  not_found_in_page: '❌',
  diacritic_mismatch: '🔤',
  page_number_off: '📄',
  duplicate_match: '🔁',
  partial_match: '⚡',
  unknown: '❓',
};

// Fix mode types
type FixMode = 'page' | 'mapping' | 'meaning' | 'order';

interface QuickFixForm {
  pageNumber: number;
  surahNumber: number;
  verseNumber: number;
  wordIndex: number;
  meaning: string;
  orderOffset: number;
}

export default function ValidationReport() {
  const navigate = useNavigate();
  const { corrections, getIgnoredKeys, exportCorrections, importCorrections, undo, canUndo, resetAll, addCorrection } = useCorrectionsStore();
  const { addWordOverride, userOverrides } = useDataStore();
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<MismatchReason | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIgnored, setShowIgnored] = useState(false);
  const [sortBy, setSortBy] = useState<'page' | 'reason' | 'surah'>('page');
  
  // Add word dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWordForm, setNewWordForm] = useState({
    pageNumber: 1,
    wordText: '',
    meaning: '',
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
    surahName: '',
  });
  
  // Quick fix dialog state
  const [showQuickFix, setShowQuickFix] = useState(false);
  const [fixMode, setFixMode] = useState<FixMode>('page');
  const [selectedMismatch, setSelectedMismatch] = useState<MismatchEntry | null>(null);
  const [quickFixForm, setQuickFixForm] = useState<QuickFixForm>({
    pageNumber: 1,
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
    meaning: '',
    orderOffset: 0,
  });
  
  // Correction dialog state
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
    
    // Sort
    if (sortBy === 'page') {
      filtered = [...filtered].sort((a, b) => a.word.pageNumber - b.word.pageNumber);
    } else if (sortBy === 'surah') {
      filtered = [...filtered].sort((a, b) => a.word.surahNumber - b.word.surahNumber || a.word.verseNumber - b.word.verseNumber);
    } else if (sortBy === 'reason') {
      filtered = [...filtered].sort((a, b) => a.reason.localeCompare(b.reason));
    }
    
    return filtered;
  }, [report, filterReason, searchQuery, ignoredKeys, showIgnored, sortBy]);

  // Handle add missing word
  const handleAddMissingWord = () => {
    if (!newWordForm.wordText.trim()) {
      toast.error('يرجى إدخال الكلمة');
      return;
    }
    
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
      surahName: newWordForm.surahName,
    });
    setShowAddDialog(false);
    setNewWordForm({
      pageNumber: 1,
      wordText: '',
      meaning: '',
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: 0,
      surahName: '',
    });
    toast.success('✅ تمت إضافة الكلمة المفقودة');
  };

  // Handle quick fix
  const openQuickFix = (mismatch: MismatchEntry) => {
    setSelectedMismatch(mismatch);
    setQuickFixForm({
      pageNumber: mismatch.word.pageNumber,
      surahNumber: mismatch.word.surahNumber,
      verseNumber: mismatch.word.verseNumber,
      wordIndex: mismatch.word.wordIndex,
      meaning: mismatch.word.meaning,
      orderOffset: 0,
    });
    setFixMode('page');
    setShowQuickFix(true);
  };

  const applyQuickFix = () => {
    if (!selectedMismatch) return;
    
    const word = selectedMismatch.word;
    
    if (fixMode === 'page') {
      // Fix page only
      addWordOverride({
        key: word.uniqueKey,
        operation: 'edit',
        pageNumber: quickFixForm.pageNumber,
        wordText: word.wordText,
        meaning: word.meaning,
        surahNumber: word.surahNumber,
        verseNumber: word.verseNumber,
        wordIndex: word.wordIndex,
        surahName: word.surahName,
      });
      toast.success(`تم تصحيح الصفحة إلى ${quickFixForm.pageNumber}`);
    } else if (fixMode === 'mapping') {
      // Fix full mapping
      addWordOverride({
        key: word.uniqueKey,
        operation: 'edit',
        pageNumber: quickFixForm.pageNumber,
        wordText: word.wordText,
        meaning: word.meaning,
        surahNumber: quickFixForm.surahNumber,
        verseNumber: quickFixForm.verseNumber,
        wordIndex: quickFixForm.wordIndex,
        surahName: word.surahName,
      });
      toast.success('تم تصحيح الربط الكامل');
    } else if (fixMode === 'meaning') {
      // Fix meaning
      addWordOverride({
        key: word.uniqueKey,
        operation: 'edit',
        pageNumber: word.pageNumber,
        wordText: word.wordText,
        meaning: quickFixForm.meaning,
        surahNumber: word.surahNumber,
        verseNumber: word.verseNumber,
        wordIndex: word.wordIndex,
        surahName: word.surahName,
      });
      toast.success('تم تصحيح المعنى');
    } else if (fixMode === 'order') {
      // Fix order (shift word index)
      const newWordIndex = word.wordIndex + quickFixForm.orderOffset;
      addWordOverride({
        key: word.uniqueKey,
        operation: 'edit',
        pageNumber: word.pageNumber,
        wordText: word.wordText,
        meaning: word.meaning,
        surahNumber: word.surahNumber,
        verseNumber: word.verseNumber,
        wordIndex: newWordIndex,
        surahName: word.surahName,
      });
      toast.success(`تم إزاحة الترتيب بمقدار ${quickFixForm.orderOffset > 0 ? '+' : ''}${quickFixForm.orderOffset}`);
    }
    
    setShowQuickFix(false);
    setSelectedMismatch(null);
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
            <div className="text-2xl font-bold text-green-600">{report.matchedCount.toLocaleString('ar-EG')}</div>
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
            <div className="text-2xl font-bold text-amber-600">{userOverrides.length}</div>
            <div className="text-sm font-arabic text-muted-foreground">التعديلات</div>
          </div>
        </div>

        {/* Reason Breakdown */}
        {Object.keys(reasonCounts).length > 0 && (
          <div className="page-frame p-4">
            <h2 className="font-arabic font-bold mb-3">أسباب عدم المطابقة</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(reasonCounts).map(([reason, count]) => (
                <button
                  key={reason}
                  className={`px-3 py-2 rounded-lg text-sm font-arabic cursor-pointer transition-colors flex items-center gap-2
                    ${filterReason === reason ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                  onClick={() => setFilterReason(filterReason === reason ? 'all' : reason as MismatchReason)}
                >
                  <span>{REASON_ICONS[reason as MismatchReason]}</span>
                  <span>{REASON_LABELS[reason as MismatchReason]}</span>
                  <span className="font-bold">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary Actions Row */}
        <div className="page-frame p-4">
          <h2 className="font-arabic font-bold mb-3">أدوات التصحيح</h2>
          <div className="flex flex-wrap gap-3">
            {/* Add Missing Word Button */}
            <Button onClick={() => setShowAddDialog(true)} variant="default" className="gap-2 font-arabic">
              <Plus className="w-4 h-4" />
              إضافة كلمة مفقودة
            </Button>
            
            <div className="h-9 w-px bg-border" />
            
            <Button onClick={handleExportJSON} variant="outline" size="sm" className="gap-2 font-arabic">
              <Download className="w-4 h-4" />
              JSON
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2 font-arabic">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            
            <div className="h-9 w-px bg-border" />
            
            <Button onClick={handleExportCorrections} variant="outline" size="sm" className="gap-2 font-arabic">
              <Download className="w-4 h-4" />
              تصدير التصحيحات
            </Button>
            <Button onClick={handleImportCorrections} variant="outline" size="sm" className="gap-2 font-arabic">
              <Upload className="w-4 h-4" />
              استيراد
            </Button>
            {canUndo() && (
              <Button onClick={undo} variant="ghost" size="sm" className="gap-2 font-arabic">
                <RotateCcw className="w-4 h-4" />
                تراجع
              </Button>
            )}
          </div>
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-36">
              <ArrowUpDown className="w-4 h-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="page">ترتيب بالصفحة</SelectItem>
              <SelectItem value="surah">ترتيب بالسورة</SelectItem>
              <SelectItem value="reason">ترتيب بالسبب</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showIgnored ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowIgnored(!showIgnored)}
            className="gap-2 font-arabic"
          >
            {showIgnored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showIgnored ? 'يشمل المتجاهل' : 'بدون المتجاهل'}
          </Button>
        </div>

        {/* Mismatches List */}
        {filteredMismatches.length === 0 ? (
          <div className="page-frame p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="font-arabic text-lg">
              {searchQuery ? 'لا توجد نتائج للبحث' : 'جميع الكلمات مطابقة! 🎉'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-arabic font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              قائمة غير المطابق ({filteredMismatches.length})
            </h2>
            
            <ScrollArea className="h-[500px] border rounded-lg">
              <div className="p-2 space-y-2">
                {filteredMismatches.slice(0, 200).map((m, idx) => {
                  const isIgnored = ignoredKeys.has(m.word.uniqueKey);
                  
                  return (
                    <div
                      key={`${m.word.uniqueKey}-${idx}`}
                      className={`p-3 rounded-lg border transition-colors ${
                        isIgnored ? 'bg-muted/30 opacity-60' : 'bg-card hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-arabic text-lg font-bold">{m.word.wordText}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-muted flex items-center gap-1">
                              <span>{REASON_ICONS[m.reason]}</span>
                              <span>{REASON_LABELS[m.reason]}</span>
                            </span>
                            {isIgnored && (
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">متجاهل</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground font-arabic mt-1">
                            {m.word.surahName} - آية {m.word.verseNumber} - ص{m.word.pageNumber}
                          </div>
                          {m.word.meaning && (
                            <div className="text-sm text-muted-foreground/70 font-arabic mt-1">
                              المعنى: {m.word.meaning}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground/60 font-arabic mt-1">
                            {m.detail}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openQuickFix(m)}
                            className="gap-1"
                            title="تصحيح سريع"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span className="font-arabic hidden sm:inline">تصحيح</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => goToPage(m.word.pageNumber)}
                            title="الانتقال للصفحة"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {!isIgnored && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleIgnoreWord(m)}
                              title="تجاهل"
                              className="text-muted-foreground"
                            >
                              <EyeOff className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {filteredMismatches.length > 200 && (
              <p className="text-xs text-muted-foreground font-arabic text-center">
                يتم عرض أول 200 نتيجة. استخدم البحث لتضييق النتائج.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add Word Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background p-6 rounded-lg max-w-md w-full space-y-4 shadow-xl" dir="rtl">
            <h3 className="font-arabic font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              إضافة كلمة مفقودة
            </h3>
            
            <div className="space-y-3">
              <div>
                <Label className="font-arabic text-sm">الكلمة *</Label>
                <Input
                  value={newWordForm.wordText}
                  onChange={(e) => setNewWordForm((f) => ({ ...f, wordText: e.target.value }))}
                  className="font-arabic text-lg"
                  placeholder="الكلمة الغريبة..."
                  dir="rtl"
                />
              </div>
              <div>
                <Label className="font-arabic text-sm">المعنى *</Label>
                <Textarea
                  value={newWordForm.meaning}
                  onChange={(e) => setNewWordForm((f) => ({ ...f, meaning: e.target.value }))}
                  className="font-arabic"
                  placeholder="معنى الكلمة..."
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الصفحة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={604}
                    value={newWordForm.pageNumber}
                    onChange={(e) => setNewWordForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">السورة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={114}
                    value={newWordForm.surahNumber}
                    onChange={(e) => setNewWordForm((f) => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))}
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
                    onChange={(e) => setNewWordForm((f) => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newWordForm.wordIndex}
                    onChange={(e) => setNewWordForm((f) => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddMissingWord} className="flex-1 font-arabic">
                <Check className="w-4 h-4 ml-2" />
                إضافة
              </Button>
              <Button onClick={() => setShowAddDialog(false)} variant="outline" className="flex-1 font-arabic">
                <X className="w-4 h-4 ml-2" />
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Fix Dialog */}
      {showQuickFix && selectedMismatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background p-6 rounded-lg max-w-lg w-full space-y-4 shadow-xl" dir="rtl">
            <h3 className="font-arabic font-bold text-lg flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              تصحيح: {selectedMismatch.word.wordText}
            </h3>
            
            {/* Fix Mode Selector */}
            <div className="space-y-2">
              <Label className="font-arabic text-sm font-bold">نوع التصحيح:</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`p-3 rounded-lg border text-sm font-arabic transition-colors ${
                    fixMode === 'page' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 hover:bg-muted'
                  }`}
                  onClick={() => setFixMode('page')}
                >
                  📄 تصحيح الصفحة
                </button>
                <button
                  className={`p-3 rounded-lg border text-sm font-arabic transition-colors ${
                    fixMode === 'mapping' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 hover:bg-muted'
                  }`}
                  onClick={() => setFixMode('mapping')}
                >
                  🔗 تصحيح الربط
                </button>
                <button
                  className={`p-3 rounded-lg border text-sm font-arabic transition-colors ${
                    fixMode === 'meaning' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 hover:bg-muted'
                  }`}
                  onClick={() => setFixMode('meaning')}
                >
                  📝 تصحيح المعنى
                </button>
                <button
                  className={`p-3 rounded-lg border text-sm font-arabic transition-colors ${
                    fixMode === 'order' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 hover:bg-muted'
                  }`}
                  onClick={() => setFixMode('order')}
                >
                  🔢 تصحيح الترتيب
                </button>
              </div>
            </div>
            
            {/* Fix Form */}
            <div className="space-y-3 pt-2">
              {fixMode === 'page' && (
                <div>
                  <Label className="font-arabic text-sm">الصفحة الصحيحة</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min={1}
                      max={604}
                      value={quickFixForm.pageNumber}
                      onChange={(e) => setQuickFixForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground font-arabic">
                      (الحالية: {selectedMismatch.word.pageNumber})
                    </span>
                  </div>
                </div>
              )}
              
              {fixMode === 'mapping' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-arabic text-xs">الصفحة</Label>
                      <Input
                        type="number"
                        min={1}
                        max={604}
                        value={quickFixForm.pageNumber}
                        onChange={(e) => setQuickFixForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div>
                      <Label className="font-arabic text-xs">السورة</Label>
                      <Input
                        type="number"
                        min={1}
                        max={114}
                        value={quickFixForm.surahNumber}
                        onChange={(e) => setQuickFixForm((f) => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-arabic text-xs">الآية</Label>
                      <Input
                        type="number"
                        min={1}
                        value={quickFixForm.verseNumber}
                        onChange={(e) => setQuickFixForm((f) => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div>
                      <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                      <Input
                        type="number"
                        min={0}
                        value={quickFixForm.wordIndex}
                        onChange={(e) => setQuickFixForm((f) => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </>
              )}
              
              {fixMode === 'meaning' && (
                <div>
                  <Label className="font-arabic text-sm">المعنى الجديد</Label>
                  <Textarea
                    value={quickFixForm.meaning}
                    onChange={(e) => setQuickFixForm((f) => ({ ...f, meaning: e.target.value }))}
                    className="font-arabic"
                    placeholder="معنى الكلمة..."
                    dir="rtl"
                  />
                </div>
              )}
              
              {fixMode === 'order' && (
                <div>
                  <Label className="font-arabic text-sm">مقدار الإزاحة</Label>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFixForm((f) => ({ ...f, orderOffset: f.orderOffset - 1 }))}
                    >
                      -1
                    </Button>
                    <Input
                      type="number"
                      value={quickFixForm.orderOffset}
                      onChange={(e) => setQuickFixForm((f) => ({ ...f, orderOffset: parseInt(e.target.value) || 0 }))}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFixForm((f) => ({ ...f, orderOffset: f.orderOffset + 1 }))}
                    >
                      +1
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-arabic mt-1">
                    الترتيب الحالي: {selectedMismatch.word.wordIndex} → الجديد: {selectedMismatch.word.wordIndex + quickFixForm.orderOffset}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={applyQuickFix} className="flex-1 font-arabic">
                <Check className="w-4 h-4 ml-2" />
                تطبيق
              </Button>
              <Button onClick={() => setShowQuickFix(false)} variant="outline" className="flex-1 font-arabic">
                <X className="w-4 h-4 ml-2" />
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Dialog (for more complex edits) */}
      {selectedMismatch && (
        <CorrectionDialog
          isOpen={correctionDialogOpen}
          onClose={() => setCorrectionDialogOpen(false)}
          mismatch={selectedMismatch}
          allWords={allWords}
          onNavigate={goToPage}
        />
      )}
    </div>
  );
}
