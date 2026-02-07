import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GhareebWord, QuranPage } from '@/types/quran';
import { useDataStore } from '@/stores/dataStore';
import { 
  getExpectedPageContent, 
  buildPageText, 
  validatePageCompleteness,
  getPageDebugInfo,
} from '@/utils/pageAssemblyModel';
import {
  FileText,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  Eye,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  CheckCircle,
  Info,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { DevDebugPanel } from './DevDebugPanel';

interface FullPageEditorDialogProps {
  children: React.ReactNode;
  currentPage?: number;
  pages?: QuranPage[];
  pageWords?: GhareebWord[];
  allWords?: GhareebWord[];
  renderedWords?: GhareebWord[];
  onNavigateToPage?: (page: number) => void;
  onHighlightWord?: (index: number) => void;
  onRefreshData?: () => void;
}

// Mushaf page text override storage
const MUSHAF_OVERRIDES_KEY = 'quran-mushaf-page-overrides';

interface MushafOverride {
  pageNumber: number;
  text: string;
  updatedAt: string;
}

function loadMushafOverrides(): Map<number, MushafOverride> {
  try {
    const stored = localStorage.getItem(MUSHAF_OVERRIDES_KEY);
    if (stored) {
      const arr: MushafOverride[] = JSON.parse(stored);
      const map = new Map<number, MushafOverride>();
      arr.forEach((o) => map.set(o.pageNumber, o));
      return map;
    }
  } catch (e) {
    console.error('Failed to load mushaf overrides:', e);
  }
  return new Map();
}

function saveMushafOverrides(overrides: Map<number, MushafOverride>) {
  const arr = Array.from(overrides.values());
  localStorage.setItem(MUSHAF_OVERRIDES_KEY, JSON.stringify(arr));
}

export function FullPageEditorDialog({
  children,
  currentPage = 1,
  pages = [],
  pageWords = [],
  allWords = [],
  renderedWords = [],
  onNavigateToPage,
  onHighlightWord,
  onRefreshData,
}: FullPageEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quran' | 'meanings'>('quran');
  const [page, setPage] = useState(currentPage);
  
  // Quran text state
  const [quranText, setQuranText] = useState('');
  const [originalQuranText, setOriginalQuranText] = useState('');
  const [isQuranDirty, setIsQuranDirty] = useState(false);
  
  // Meanings state
  const [meaningsText, setMeaningsText] = useState('');
  const [originalMeaningsText, setOriginalMeaningsText] = useState('');
  const [isMeaningsDirty, setIsMeaningsDirty] = useState(false);
  
  // Page validation state
  const [isValidating, setIsValidating] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [pageDebugInfo, setPageDebugInfo] = useState<{
    firstVerse: string;
    lastVerse: string;
    totalVerses: number;
    hasSurahTransition: boolean;
    surahs: number[];
  } | null>(null);
  const [tanzilText, setTanzilText] = useState<string>('');
  
  // Individual editing
  const [editingWord, setEditingWord] = useState<GhareebWord | null>(null);
  const [editForm, setEditForm] = useState({
    wordText: '',
    meaning: '',
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
  });

  // Mushaf overrides
  const [mushafOverrides, setMushafOverrides] = useState<Map<number, MushafOverride>>(() => loadMushafOverrides());
  
  const { addWordOverride, userOverrides, applyOverrides, resetAll } = useDataStore();

  // Load Tanzil text on mount
  useEffect(() => {
    if (open && !tanzilText) {
      fetch('/data/quran-tanzil.txt')
        .then(res => res.text())
        .then(text => setTanzilText(text))
        .catch(err => console.error('Failed to load tanzil:', err));
    }
  }, [open, tanzilText]);

  // Get resolved words for this page
  const resolvedWords = useMemo(() => {
    const all = applyOverrides(allWords);
    return all.filter((w) => w.pageNumber === page).sort((a, b) => a.order - b.order);
  }, [allWords, applyOverrides, page]);
  
  // Rebuild page from official source
  const handleRebuildFromSource = useCallback(async () => {
    if (!tanzilText) {
      toast.error('جاري تحميل البيانات...');
      return;
    }
    
    setIsRebuilding(true);
    try {
      const expected = await getExpectedPageContent(page, tanzilText);
      const rebuiltText = buildPageText(expected);
      
      // Set the rebuilt text
      setQuranText(rebuiltText);
      setIsQuranDirty(true);
      
      // Load debug info
      const debugInfo = await getPageDebugInfo(page, tanzilText);
      setPageDebugInfo(debugInfo);
      
      toast.success(`تم إعادة بناء الصفحة ${page} (${expected.segments.length} آية)`);
    } catch (err) {
      console.error('Rebuild error:', err);
      toast.error('خطأ في إعادة بناء الصفحة');
    } finally {
      setIsRebuilding(false);
    }
  }, [page, tanzilText]);
  
  // Validate page completeness
  const handleValidatePage = useCallback(async () => {
    if (!tanzilText) {
      toast.error('جاري تحميل البيانات...');
      return;
    }
    
    setIsValidating(true);
    setValidationIssues([]);
    
    try {
      const issues = await validatePageCompleteness(page, quranText, tanzilText);
      const debugInfo = await getPageDebugInfo(page, tanzilText);
      
      setPageDebugInfo(debugInfo);
      
      if (issues.length === 0) {
        toast.success('✅ الصفحة سليمة - لا توجد مشاكل');
        setValidationIssues([]);
      } else {
        const issueMessages = issues.map(i => `${i.description}: ${i.expected} vs ${i.actual}`);
        setValidationIssues(issueMessages);
        toast.error(`وُجدت ${issues.length} مشكلة في الصفحة`);
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('خطأ في التحقق');
    } finally {
      setIsValidating(false);
    }
  }, [page, quranText, tanzilText]);
  
  // Auto-fix: rebuild and save
  const handleAutoFix = useCallback(async () => {
    if (!tanzilText) {
      toast.error('جاري تحميل البيانات...');
      return;
    }
    
    setIsRebuilding(true);
    try {
      const expected = await getExpectedPageContent(page, tanzilText);
      const rebuiltText = buildPageText(expected);
      
      // Save directly as override
      const newOverride: MushafOverride = {
        pageNumber: page,
        text: rebuiltText,
        updatedAt: new Date().toISOString(),
      };
      
      const updated = new Map(mushafOverrides);
      updated.set(page, newOverride);
      setMushafOverrides(updated);
      saveMushafOverrides(updated);
      
      // Update UI state
      setQuranText(rebuiltText);
      setOriginalQuranText(rebuiltText);
      setIsQuranDirty(false);
      setValidationIssues([]);
      
      toast.success(`✅ تم إصلاح صفحة ${page} تلقائياً`);
      onRefreshData?.();
    } catch (err) {
      console.error('Auto-fix error:', err);
      toast.error('خطأ في الإصلاح التلقائي');
    } finally {
      setIsRebuilding(false);
    }
  }, [page, tanzilText, mushafOverrides, onRefreshData]);

  // Load page data when page changes
  useEffect(() => {
    if (!open) return;
    
    // Load Quran text
    const pageData = pages.find((p) => p.pageNumber === page);
    const override = mushafOverrides.get(page);
    
    if (override) {
      setQuranText(override.text);
      setOriginalQuranText(override.text);
    } else if (pageData) {
      setQuranText(pageData.text);
      setOriginalQuranText(pageData.text);
    } else {
      setQuranText('');
      setOriginalQuranText('');
    }
    setIsQuranDirty(false);
    
    // Load meanings as editable text
    const meaningsArr = resolvedWords.map((w, idx) => 
      `${idx + 1}. ${w.wordText} = ${w.meaning} [${w.surahNumber}:${w.verseNumber}:${w.wordIndex}]`
    );
    const meaningsStr = meaningsArr.join('\n');
    setMeaningsText(meaningsStr);
    setOriginalMeaningsText(meaningsStr);
    setIsMeaningsDirty(false);
  }, [open, page, pages, resolvedWords, mushafOverrides]);

  // Update page from currentPage prop
  useEffect(() => {
    if (open) {
      setPage(currentPage);
    }
  }, [currentPage, open]);

  // Handle Quran text change
  const handleQuranTextChange = (value: string) => {
    setQuranText(value);
    setIsQuranDirty(value !== originalQuranText);
  };

  // Handle meanings text change
  const handleMeaningsTextChange = (value: string) => {
    setMeaningsText(value);
    setIsMeaningsDirty(value !== originalMeaningsText);
  };

  // Save Quran text
  const handleSaveQuranText = () => {
    const newOverride: MushafOverride = {
      pageNumber: page,
      text: quranText,
      updatedAt: new Date().toISOString(),
    };
    
    const updated = new Map(mushafOverrides);
    updated.set(page, newOverride);
    setMushafOverrides(updated);
    saveMushafOverrides(updated);
    
    setOriginalQuranText(quranText);
    setIsQuranDirty(false);
    
    toast.success(`تم حفظ نص صفحة ${page}`);
    onRefreshData?.();
  };

  // Reset Quran text to original
  const handleResetQuranText = () => {
    const updated = new Map(mushafOverrides);
    updated.delete(page);
    setMushafOverrides(updated);
    saveMushafOverrides(updated);
    
    const pageData = pages.find((p) => p.pageNumber === page);
    if (pageData) {
      setQuranText(pageData.text);
      setOriginalQuranText(pageData.text);
    }
    setIsQuranDirty(false);
    
    toast.success('تم إعادة النص الأصلي');
  };

  // Parse and save meanings
  const handleSaveMeanings = () => {
    const lines = meaningsText.trim().split('\n');
    let savedCount = 0;
    
    for (const line of lines) {
      // Parse format: "1. الكلمة = المعنى [surah:ayah:wordIndex]"
      const match = line.match(/^\d+\.\s*(.+?)\s*=\s*(.+?)\s*\[(\d+):(\d+):(\d+)\]$/);
      if (match) {
        const [, wordText, meaning, surah, ayah, wordIdx] = match;
        const key = `${surah}_${ayah}_${wordIdx}`;
        
        addWordOverride({
          key,
          operation: 'edit',
          pageNumber: page,
          wordText: wordText.trim(),
          meaning: meaning.trim(),
          surahNumber: parseInt(surah),
          verseNumber: parseInt(ayah),
          wordIndex: parseInt(wordIdx),
          surahName: '',
        });
        savedCount++;
      }
    }
    
    if (savedCount > 0) {
      toast.success(`تم حفظ ${savedCount} معنى`);
      setOriginalMeaningsText(meaningsText);
      setIsMeaningsDirty(false);
    } else {
      toast.error('لم يتم التعرف على أي معاني. تأكد من الصيغة الصحيحة.');
    }
  };

  // Individual word editing
  const handleEditWord = (word: GhareebWord) => {
    setEditingWord(word);
    setEditForm({
      wordText: word.wordText,
      meaning: word.meaning,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex,
    });
  };

  const handleSaveWord = () => {
    if (!editingWord) return;
    
    addWordOverride({
      key: editingWord.uniqueKey,
      operation: 'edit',
      pageNumber: page,
      wordText: editForm.wordText,
      meaning: editForm.meaning,
      surahNumber: editForm.surahNumber,
      verseNumber: editForm.verseNumber,
      wordIndex: editForm.wordIndex,
      surahName: editingWord.surahName,
    });
    
    setEditingWord(null);
    toast.success('تم حفظ الكلمة');
  };

  const handleDeleteWord = (word: GhareebWord) => {
    if (confirm(`هل تريد حذف "${word.wordText}"؟`)) {
      addWordOverride({
        key: word.uniqueKey,
        operation: 'delete',
        pageNumber: word.pageNumber,
      });
      toast.success('تم الحذف');
    }
  };

  const handleAddNewWord = () => {
    const newKey = `new_${page}_${Date.now()}`;
    addWordOverride({
      key: newKey,
      operation: 'add',
      pageNumber: page,
      wordText: 'كلمة جديدة',
      meaning: 'المعنى',
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: resolvedWords.length,
      surahName: '',
    });
    toast.success('تمت إضافة كلمة جديدة');
  };

  const handlePreviewWord = (word: GhareebWord, index: number) => {
    onNavigateToPage?.(word.pageNumber);
    setTimeout(() => onHighlightWord?.(index), 300);
    setOpen(false);
  };

  // Navigation
  const goToPage = (newPage: number) => {
    const validPage = Math.max(1, Math.min(604, newPage));
    setPage(validPage);
    onNavigateToPage?.(validPage);
  };

  const pageOverridesCount = userOverrides.filter((o) => o.pageNumber === page).length;
  const hasMushafOverride = mushafOverrides.has(page);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <FileText className="w-5 h-5" />
            محرر الصفحات الكامل
          </DialogTitle>
          {/* DEV Debug Panel Toggle - Top Right */}
          {process.env.NODE_ENV !== 'production' && pages.find(p => p.pageNumber === page) && (
            <div dir="ltr">
              <DevDebugPanel
                page={pages.find(p => p.pageNumber === page)!}
                pageNumber={page}
                ghareebWords={resolvedWords}
                renderedWords={renderedWords.filter(w => w.pageNumber === page)}
                onInvalidateCache={onRefreshData}
              />
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Page Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => goToPage(page + 1)}
                disabled={page >= 604}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Label className="font-arabic">صفحة</Label>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={page}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  className="w-20 text-center"
                />
                <span className="text-muted-foreground">/ 604</span>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm font-arabic">
              <span className="text-muted-foreground">
                الكلمات الغريبة: <strong className="text-foreground">{resolvedWords.length}</strong>
              </span>
              <span className="text-muted-foreground">
                التعديلات: <strong className="text-foreground">{pageOverridesCount}</strong>
              </span>
              {hasMushafOverride && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  نص معدّل
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'quran' | 'meanings')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quran" className="font-arabic gap-2">
                <BookOpen className="w-4 h-4" />
                نص القرآن
                {isQuranDirty && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
              </TabsTrigger>
              <TabsTrigger value="meanings" className="font-arabic gap-2">
                <FileText className="w-4 h-4" />
                الكلمات والمعاني
                {isMeaningsDirty && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
              </TabsTrigger>
            </TabsList>

            {/* Quran Text Tab */}
            <TabsContent value="quran" className="space-y-4 mt-4">
              {/* Rebuild & Validate Actions - CRITICAL BUTTONS */}
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRebuildFromSource}
                  disabled={isRebuilding || !tanzilText}
                  className="font-arabic gap-1"
                >
                  {isRebuilding ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  🔄 إعادة بناء الصفحة من المصدر
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleValidatePage}
                  disabled={isValidating || !tanzilText}
                  className="font-arabic gap-1"
                >
                  {isValidating ? (
                    <ScanLine className="w-3 h-3 animate-pulse" />
                  ) : (
                    <ScanLine className="w-3 h-3" />
                  )}
                  فحص اكتمال الصفحة
                </Button>
                
                {validationIssues.length > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAutoFix}
                    disabled={isRebuilding}
                    className="font-arabic gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    ✅ إصلاح تلقائي
                  </Button>
                )}
              </div>
              
              {/* Validation Issues Display */}
              {validationIssues.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="font-arabic font-semibold text-destructive">مشاكل في الصفحة:</span>
                  </div>
                  <ul className="text-sm font-arabic text-destructive/90 space-y-1">
                    {validationIssues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Page Debug Info */}
              {pageDebugInfo && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm font-arabic">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-primary" />
                    <span className="font-semibold">معلومات الصفحة:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>الآية الأولى: <strong className="text-foreground">{pageDebugInfo.firstVerse}</strong></span>
                    <span>الآية الأخيرة: <strong className="text-foreground">{pageDebugInfo.lastVerse}</strong></span>
                    <span>إجمالي الآيات: <strong className="text-foreground">{pageDebugInfo.totalVerses}</strong></span>
                    <span>السور: <strong className="text-foreground">{pageDebugInfo.surahs.join(', ')}</strong></span>
                    {pageDebugInfo.hasSurahTransition && (
                      <span className="col-span-2 text-amber-600">⚠️ الصفحة تحتوي على انتقال بين السور</span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic font-semibold">نص صفحة المصحف الكامل</Label>
                  <div className="flex gap-2">
                    {hasMushafOverride && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleResetQuranText}
                        className="font-arabic gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        استعادة الأصلي
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveQuranText}
                      disabled={!isQuranDirty}
                      className="font-arabic gap-1"
                    >
                      <Save className="w-3 h-3" />
                      حفظ النص
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={quranText}
                  onChange={(e) => handleQuranTextChange(e.target.value)}
                  className="min-h-[350px] font-arabic text-lg leading-loose"
                  dir="rtl"
                  placeholder="نص صفحة المصحف..."
                />
                <p className="text-xs text-muted-foreground font-arabic">
                  يمكنك تعديل النص الكامل للصفحة. التعديلات تُحفظ في طبقة منفصلة ولا تغيّر الملف الأصلي.
                </p>
              </div>
            </TabsContent>

            {/* Meanings Tab */}
            <TabsContent value="meanings" className="space-y-4 mt-4">
              {/* Bulk Edit Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic font-semibold">تحرير جماعي (نص)</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const meaningsArr = resolvedWords.map((w, idx) => 
                          `${idx + 1}. ${w.wordText} = ${w.meaning} [${w.surahNumber}:${w.verseNumber}:${w.wordIndex}]`
                        );
                        setMeaningsText(meaningsArr.join('\n'));
                      }}
                      className="font-arabic gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      إعادة تحميل
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMeanings}
                      disabled={!isMeaningsDirty}
                      className="font-arabic gap-1"
                    >
                      <Save className="w-3 h-3" />
                      حفظ الكل
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={meaningsText}
                  onChange={(e) => handleMeaningsTextChange(e.target.value)}
                  className="min-h-[150px] font-arabic text-sm leading-relaxed font-mono"
                  dir="rtl"
                  placeholder="الصيغة: رقم. الكلمة = المعنى [سورة:آية:ترتيب]"
                />
                <p className="text-xs text-muted-foreground font-arabic">
                  الصيغة: <code className="bg-muted px-1 rounded">1. الكلمة = المعنى [سورة:آية:ترتيب]</code>
                </p>
              </div>

              {/* Individual Words Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-arabic font-semibold">تحرير فردي</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddNewWord}
                    className="font-arabic gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    إضافة كلمة
                  </Button>
                </div>
                
                <ScrollArea className="h-[200px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="font-arabic text-right w-12">#</TableHead>
                        <TableHead className="font-arabic text-right">الكلمة</TableHead>
                        <TableHead className="font-arabic text-right">المعنى</TableHead>
                        <TableHead className="font-arabic text-right">الموقع</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedWords.map((word, idx) => (
                        <TableRow key={word.uniqueKey}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                          <TableCell className="font-arabic text-sm max-w-[200px] truncate">
                            {word.meaning}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {word.surahNumber}:{word.verseNumber}:{word.wordIndex}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handlePreviewWord(word, idx)}
                                title="معاينة"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleEditWord(word)}
                                title="تعديل"
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteWord(word)}
                                title="حذف"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resolvedWords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-arabic">
                            لا توجد كلمات غريبة في هذه الصفحة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit Word Modal */}
        {editingWord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
              <h3 className="font-arabic font-bold flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                تعديل الكلمة
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label className="font-arabic text-xs">الكلمة</Label>
                  <Input
                    value={editForm.wordText}
                    onChange={(e) => setEditForm((f) => ({ ...f, wordText: e.target.value }))}
                    className="font-arabic"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">المعنى</Label>
                  <Textarea
                    value={editForm.meaning}
                    onChange={(e) => setEditForm((f) => ({ ...f, meaning: e.target.value }))}
                    className="font-arabic min-h-[80px]"
                    dir="rtl"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">السورة</Label>
                    <Input
                      type="number"
                      min={1}
                      max={114}
                      value={editForm.surahNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الآية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editForm.verseNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الترتيب</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.wordIndex}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSaveWord} className="flex-1 font-arabic gap-1">
                  <Check className="w-4 h-4" />
                  حفظ
                </Button>
                <Button
                  onClick={() => setEditingWord(null)}
                  variant="outline"
                  className="flex-1 font-arabic gap-1"
                >
                  <X className="w-4 h-4" />
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
