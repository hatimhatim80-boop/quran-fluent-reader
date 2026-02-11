import React, { useState, useMemo, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataStore, UserWordOverride } from '@/stores/dataStore';
import { useCorrectionsStore } from '@/stores/correctionsStore';
import { GhareebWord } from '@/types/quran';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Edit3,
  FileText,
  Layers,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  Check,
  X,
  BookOpen,
  Copy,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

const surahNumberToName: Record<number, string> = {
  1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',
  11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',
  21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
  31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبإ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',
  41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',
  51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
  61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',
  71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبإ',79:'النازعات',80:'عبس',
  81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
  91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',
  101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',
  111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس',
};

interface WorkingDataManagerProps {
  children: React.ReactNode;
  allWords?: GhareebWord[];
}

// ---- Diagnostic types ----
interface DiagnosticIssue {
  type: 'missing_meaning' | 'duplicate' | 'empty_word' | 'invalid_surah' | 'invalid_page' | 'short_meaning';
  severity: 'error' | 'warning' | 'info';
  word: GhareebWord;
  message: string;
}

const ITEMS_PER_PAGE = 50;

export function WorkingDataManager({ children, allWords = [] }: WorkingDataManagerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [surahFilter, setSurahFilter] = useState<string>('all');
  const [browsePage, setBrowsePage] = useState(1);
  
  // Edit state
  const [editingOverride, setEditingOverride] = useState<UserWordOverride | null>(null);
  const [newEntryForm, setNewEntryForm] = useState({
    pageNumber: 1,
    wordText: '',
    meaning: '',
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
    surahName: '',
  });
  
  // Import state
  const [importText, setImportText] = useState('');
  
  // Diagnostics state
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagFilter, setDiagFilter] = useState<string>('all');

  const {
    userOverrides,
    addWordOverride,
    updateWordOverride,
    deleteWordOverride,
    applyOverrides,
    exportOverrides,
    importOverrides,
    undo,
    canUndo,
    resetAll,
  } = useDataStore();

  const { corrections, exportCorrections, importCorrections } = useCorrectionsStore();

  // Resolved data
  const resolvedWords = useMemo(() => applyOverrides(allWords), [allWords, applyOverrides]);

  // ---- SEARCH: Filter resolved words with flexible criteria ----
  const filteredBaseWords = useMemo(() => {
    let result = resolvedWords;
    
    // Page range filter
    const pFrom = pageFrom ? parseInt(pageFrom) : null;
    const pTo = pageTo ? parseInt(pageTo) : null;
    if (pFrom && pTo) {
      result = result.filter(w => w.pageNumber >= pFrom && w.pageNumber <= pTo);
    } else if (pFrom) {
      result = result.filter(w => w.pageNumber === pFrom);
    } else if (pTo) {
      result = result.filter(w => w.pageNumber <= pTo);
    }
    
    // Surah filter
    if (surahFilter !== 'all') {
      const sNum = parseInt(surahFilter);
      result = result.filter(w => w.surahNumber === sNum);
    }
    
    // Text search (word text, meaning, surah name, key)
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter(w =>
        w.wordText.includes(q) ||
        w.meaning.includes(q) ||
        w.surahName.includes(q) ||
        w.uniqueKey.includes(q) ||
        `${w.surahNumber}:${w.verseNumber}`.includes(q)
      );
    }
    
    return result;
  }, [resolvedWords, pageFrom, pageTo, surahFilter, searchQuery]);

  // Paginated results
  const totalBrowsePages = Math.max(1, Math.ceil(filteredBaseWords.length / ITEMS_PER_PAGE));
  const paginatedWords = useMemo(() => {
    const start = (browsePage - 1) * ITEMS_PER_PAGE;
    return filteredBaseWords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBaseWords, browsePage]);

  // Reset browse page on filter change
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setBrowsePage(1);
  }, []);

  // ---- OVERRIDES filter ----
  const filteredOverrides = useMemo(() => {
    let result = [...userOverrides];
    
    if (pageFrom) {
      const pf = parseInt(pageFrom);
      result = result.filter(o => o.pageNumber === pf);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter(o =>
        o.wordText?.includes(q) ||
        o.meaning?.includes(q) ||
        o.key.includes(q)
      );
    }
    
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [userOverrides, pageFrom, searchQuery]);

  // ---- DIAGNOSTICS ----
  const diagnosticIssues = useMemo((): DiagnosticIssue[] => {
    if (!diagRunning) return [];
    const issues: DiagnosticIssue[] = [];
    const seenKeys = new Map<string, GhareebWord>();
    
    for (const word of resolvedWords) {
      // Missing meaning
      if (!word.meaning || word.meaning.trim().length === 0) {
        issues.push({
          type: 'missing_meaning',
          severity: 'error',
          word,
          message: `كلمة "${word.wordText}" بدون معنى`,
        });
      }
      
      // Very short meaning (likely incomplete)
      if (word.meaning && word.meaning.trim().length > 0 && word.meaning.trim().length < 3) {
        issues.push({
          type: 'short_meaning',
          severity: 'warning',
          word,
          message: `معنى قصير جداً: "${word.meaning}"`,
        });
      }
      
      // Empty word text
      if (!word.wordText || word.wordText.trim().length === 0) {
        issues.push({
          type: 'empty_word',
          severity: 'error',
          word,
          message: `نص الكلمة فارغ (${word.uniqueKey})`,
        });
      }
      
      // Invalid surah number
      if (word.surahNumber < 1 || word.surahNumber > 114) {
        issues.push({
          type: 'invalid_surah',
          severity: 'error',
          word,
          message: `رقم سورة غير صحيح: ${word.surahNumber}`,
        });
      }
      
      // Invalid page
      if (word.pageNumber < 1 || word.pageNumber > 604) {
        issues.push({
          type: 'invalid_page',
          severity: 'error',
          word,
          message: `رقم صفحة غير صحيح: ${word.pageNumber}`,
        });
      }
      
      // Duplicate check (same surah + verse + similar word text)
      const dupKey = `${word.surahNumber}_${word.verseNumber}_${word.wordText}`;
      if (seenKeys.has(dupKey)) {
        const existing = seenKeys.get(dupKey)!;
        if (existing.uniqueKey !== word.uniqueKey) {
          issues.push({
            type: 'duplicate',
            severity: 'warning',
            word,
            message: `تكرار: "${word.wordText}" في ${word.surahNumber}:${word.verseNumber} (مع ${existing.uniqueKey})`,
          });
        }
      } else {
        seenKeys.set(dupKey, word);
      }
    }
    
    return issues;
  }, [resolvedWords, diagRunning]);

  const filteredDiagIssues = useMemo(() => {
    if (diagFilter === 'all') return diagnosticIssues;
    return diagnosticIssues.filter(i => i.type === diagFilter);
  }, [diagnosticIssues, diagFilter]);

  const diagStats = useMemo(() => ({
    total: diagnosticIssues.length,
    errors: diagnosticIssues.filter(i => i.severity === 'error').length,
    warnings: diagnosticIssues.filter(i => i.severity === 'warning').length,
    missingMeaning: diagnosticIssues.filter(i => i.type === 'missing_meaning').length,
    duplicates: diagnosticIssues.filter(i => i.type === 'duplicate').length,
    emptyWords: diagnosticIssues.filter(i => i.type === 'empty_word').length,
    invalidSurah: diagnosticIssues.filter(i => i.type === 'invalid_surah').length,
    invalidPage: diagnosticIssues.filter(i => i.type === 'invalid_page').length,
    shortMeaning: diagnosticIssues.filter(i => i.type === 'short_meaning').length,
  }), [diagnosticIssues]);

  // ---- HANDLERS ----
  const handleAddEntry = () => {
    if (!newEntryForm.wordText.trim() || !newEntryForm.meaning.trim()) {
      toast.error('أدخل الكلمة والمعنى');
      return;
    }
    const key = `${newEntryForm.surahNumber}_${newEntryForm.verseNumber}_${newEntryForm.wordIndex}`;
    addWordOverride({ key, operation: 'add', ...newEntryForm });
    setNewEntryForm({ pageNumber: parseInt(pageFrom) || 1, wordText: '', meaning: '', surahNumber: 1, verseNumber: 1, wordIndex: 0, surahName: '' });
    toast.success('تمت إضافة الكلمة');
  };

  const handleSaveEdit = () => {
    if (!editingOverride) return;
    updateWordOverride(editingOverride.id, {
      pageNumber: editingOverride.pageNumber,
      wordText: editingOverride.wordText,
      meaning: editingOverride.meaning,
      surahNumber: editingOverride.surahNumber,
      verseNumber: editingOverride.verseNumber,
      wordIndex: editingOverride.wordIndex,
      surahName: editingOverride.surahName,
    });
    setEditingOverride(null);
    toast.success('تم حفظ التعديل');
  };

  const handleDeleteOverride = (id: string) => {
    if (confirm('هل تريد حذف هذا التعديل؟')) {
      deleteWordOverride(id);
      toast.success('تم الحذف');
    }
  };

  const handleEditBaseWord = (word: GhareebWord) => {
    addWordOverride({
      key: word.uniqueKey,
      operation: 'edit',
      pageNumber: word.pageNumber,
      wordText: word.wordText,
      meaning: word.meaning,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex,
      surahName: word.surahName,
    });
    const lastOverride = userOverrides[userOverrides.length - 1];
    if (lastOverride) {
      setEditingOverride({...lastOverride, wordText: word.wordText, meaning: word.meaning});
    }
    setActiveTab('overrides');
    toast.info('تم إنشاء تعديل - يمكنك الآن تحريره');
  };

  const handleDeleteBaseWord = (word: GhareebWord) => {
    if (confirm(`هل تريد حذف "${word.wordText}"؟`)) {
      addWordOverride({ key: word.uniqueKey, operation: 'delete', pageNumber: word.pageNumber });
      toast.success('تم الحذف');
    }
  };

  const handleDuplicateWord = (word: GhareebWord) => {
    const newKey = `${word.surahNumber}_${word.verseNumber}_${word.wordIndex + 100}`;
    addWordOverride({
      key: newKey, operation: 'add', pageNumber: word.pageNumber,
      wordText: word.wordText, meaning: word.meaning,
      surahNumber: word.surahNumber, verseNumber: word.verseNumber,
      wordIndex: word.wordIndex + 100, surahName: word.surahName,
    });
    toast.success('تم نسخ الكلمة');
  };

  // Fix diagnostic issue: navigate to edit
  const handleFixIssue = (issue: DiagnosticIssue) => {
    handleEditBaseWord(issue.word);
  };

  // Export
  const handleExportJSON = () => {
    const combined = {
      version: '1.0', exportedAt: new Date().toISOString(),
      dataOverrides: JSON.parse(exportOverrides()),
      corrections: JSON.parse(exportCorrections()),
      stats: { totalOverrides: userOverrides.length, totalCorrections: corrections.length },
    };
    downloadFile(JSON.stringify(combined, null, 2), 'quran-app-backup.json', 'application/json');
    toast.success('تم تصدير البيانات');
  };

  const handleExportCSV = () => {
    const header = 'العملية,الصفحة,السورة,الآية,الترتيب,الكلمة,المعنى,المفتاح\n';
    const rows = userOverrides.map(o =>
      `${o.operation},${o.pageNumber || ''},${o.surahNumber || ''},${o.verseNumber || ''},${o.wordIndex || ''},"${o.wordText || ''}","${o.meaning || ''}",${o.key}`
    ).join('\n');
    downloadFile(header + rows, 'quran-overrides.csv', 'text/csv;charset=utf-8');
    toast.success('تم تصدير CSV');
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const json = ev.target?.result as string;
            const data = JSON.parse(json);
            let imported = 0;
            if (data.dataOverrides?.overrides) {
              const result = importOverrides(JSON.stringify({ overrides: data.dataOverrides.overrides }));
              if (result.success) imported += result.count;
            } else if (data.overrides) {
              const result = importOverrides(json);
              if (result.success) imported += result.count;
            }
            if (data.corrections?.corrections) {
              const result = importCorrections(JSON.stringify(data.corrections));
              if (result.success) imported += result.count;
            }
            toast.success(`تم استيراد ${imported} عنصر`);
          } catch {
            toast.error('فشل قراءة الملف');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleImportText = () => {
    if (!importText.trim()) { toast.error('أدخل البيانات'); return; }
    try {
      const result = importOverrides(importText);
      if (result.success) { toast.success(`تم استيراد ${result.count} تعديل`); setImportText(''); }
      else toast.error('فشل الاستيراد');
    } catch { toast.error('خطأ في تحليل البيانات'); }
  };

  const handleResetAll = () => {
    if (confirm('هل أنت متأكد من حذف جميع التعديلات؟')) { resetAll(); toast.success('تم إعادة التعيين'); }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const stats = {
    totalPages: 604,
    totalBaseWords: allWords.length,
    totalResolved: resolvedWords.length,
    totalOverrides: userOverrides.length,
    addedWords: userOverrides.filter(o => o.operation === 'add').length,
    editedWords: userOverrides.filter(o => o.operation === 'edit').length,
    deletedWords: userOverrides.filter(o => o.operation === 'delete').length,
    corrections: corrections.length,
  };

  // Shared search bar component
  const SearchBar = () => (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="بحث بالكلمة أو المعنى أو السورة..."
            className="pr-10 font-arabic"
          />
        </div>
        <div className="flex gap-1 items-center">
          <Input
            type="number" min={1} max={604}
            value={pageFrom}
            onChange={e => { setPageFrom(e.target.value); setBrowsePage(1); }}
            placeholder="من ص"
            className="w-20 text-center"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="number" min={1} max={604}
            value={pageTo}
            onChange={e => { setPageTo(e.target.value); setBrowsePage(1); }}
            placeholder="إلى ص"
            className="w-20 text-center"
          />
        </div>
        <Select value={surahFilter} onValueChange={v => { setSurahFilter(v); setBrowsePage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="السورة" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">كل السور</SelectItem>
            {Object.entries(surahNumberToName).map(([num, name]) => (
              <SelectItem key={num} value={num}>{num}. {name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(searchQuery || pageFrom || pageTo || surahFilter !== 'all') && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-arabic">
            {filteredBaseWords.length.toLocaleString()} نتيجة
          </span>
          <Button size="sm" variant="ghost" className="h-6 text-xs font-arabic"
            onClick={() => { setSearchQuery(''); setPageFrom(''); setPageTo(''); setSurahFilter('all'); setBrowsePage(1); }}>
            مسح الفلاتر
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <Database className="w-5 h-5" />
            مدير البيانات
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="font-arabic text-xs gap-1">
              <FileText className="w-3 h-3" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="browse" className="font-arabic text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              بحث وتحرير
            </TabsTrigger>
            <TabsTrigger value="overrides" className="font-arabic text-xs gap-1">
              <Layers className="w-3 h-3" />
              التعديلات ({stats.totalOverrides})
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="font-arabic text-xs gap-1">
              <Stethoscope className="w-3 h-3" />
              تشخيص
            </TabsTrigger>
            <TabsTrigger value="io" className="font-arabic text-xs gap-1">
              <Download className="w-3 h-3" />
              استيراد/تصدير
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalPages}</div>
                <div className="text-xs font-arabic text-muted-foreground">صفحات المصحف</div>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalBaseWords.toLocaleString()}</div>
                <div className="text-xs font-arabic text-muted-foreground">كلمات الغريب</div>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-accent">{stats.totalOverrides}</div>
                <div className="text-xs font-arabic text-muted-foreground">التعديلات</div>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{stats.corrections}</div>
                <div className="text-xs font-arabic text-muted-foreground">التصحيحات</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg text-center bg-green-50 dark:bg-green-950">
                <div className="text-xl font-bold text-green-600">{stats.addedWords}</div>
                <div className="text-xs font-arabic text-green-700">مضافة</div>
              </div>
              <div className="p-3 border rounded-lg text-center bg-blue-50 dark:bg-blue-950">
                <div className="text-xl font-bold text-blue-600">{stats.editedWords}</div>
                <div className="text-xs font-arabic text-blue-700">معدلة</div>
              </div>
              <div className="p-3 border rounded-lg text-center bg-red-50 dark:bg-red-950">
                <div className="text-xl font-bold text-red-600">{stats.deletedWords}</div>
                <div className="text-xs font-arabic text-red-700">محذوفة</div>
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-muted/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="font-arabic text-sm text-muted-foreground">
                جميع التعديلات تُحفظ في طبقة منفصلة ولا تغيّر الملفات الأصلية.
              </p>
            </div>
          </TabsContent>

          {/* Browse & Edit Tab */}
          <TabsContent value="browse" className="space-y-3 mt-4">
            <SearchBar />

            {/* Add New */}
            <details className="border rounded-lg">
              <summary className="p-3 font-arabic font-semibold cursor-pointer flex items-center gap-2 hover:bg-muted/30">
                <Plus className="w-4 h-4" />
                إضافة كلمة جديدة
              </summary>
              <div className="p-4 pt-2 space-y-3 border-t">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الصفحة</Label>
                    <Input type="number" min={1} max={604} value={newEntryForm.pageNumber}
                      onChange={e => setNewEntryForm(f => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">السورة</Label>
                    <Input type="number" min={1} max={114} value={newEntryForm.surahNumber}
                      onChange={e => {
                        const num = parseInt(e.target.value) || 1;
                        setNewEntryForm(f => ({ ...f, surahNumber: num, surahName: surahNumberToName[num] || '' }));
                      }} />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الآية</Label>
                    <Input type="number" min={1} value={newEntryForm.verseNumber}
                      onChange={e => setNewEntryForm(f => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الترتيب</Label>
                    <Input type="number" min={0} value={newEntryForm.wordIndex}
                      onChange={e => setNewEntryForm(f => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الكلمة</Label>
                    <Input value={newEntryForm.wordText} onChange={e => setNewEntryForm(f => ({ ...f, wordText: e.target.value }))}
                      className="font-arabic" placeholder="الكلمة القرآنية" dir="rtl" />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">المعنى</Label>
                    <Input value={newEntryForm.meaning} onChange={e => setNewEntryForm(f => ({ ...f, meaning: e.target.value }))}
                      className="font-arabic" placeholder="معنى الكلمة" dir="rtl" />
                  </div>
                </div>
                <Button onClick={handleAddEntry} className="w-full font-arabic gap-1">
                  <Plus className="w-4 h-4" /> إضافة
                </Button>
              </div>
            </details>

            {/* Words Table */}
            <ScrollArea className="h-[280px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="font-arabic text-right w-14">ص</TableHead>
                    <TableHead className="font-arabic text-right">الكلمة</TableHead>
                    <TableHead className="font-arabic text-right">المعنى</TableHead>
                    <TableHead className="font-arabic text-right w-20">الموقع</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWords.map((word) => (
                    <TableRow key={`${word.uniqueKey}-${word.pageNumber}`}>
                      <TableCell className="text-sm">{word.pageNumber}</TableCell>
                      <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                      <TableCell className="font-arabic text-sm max-w-[200px] truncate">{word.meaning}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{word.surahNumber}:{word.verseNumber}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditBaseWord(word)} title="تعديل">
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicateWord(word)} title="نسخ">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBaseWord(word)} title="حذف">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination */}
            {totalBrowsePages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={browsePage <= 1}
                  onClick={() => setBrowsePage(p => p - 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-xs font-arabic text-muted-foreground">
                  {browsePage} / {totalBrowsePages}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={browsePage >= totalBrowsePages}
                  onClick={() => setBrowsePage(p => p + 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {filteredOverrides.length > 0 ? (
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="font-arabic text-right">العملية</TableHead>
                      <TableHead className="font-arabic text-right">الكلمة</TableHead>
                      <TableHead className="font-arabic text-right">المعنى</TableHead>
                      <TableHead className="font-arabic text-right">الصفحة</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverrides.map(override => (
                      <TableRow key={override.id}>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded font-arabic ${
                            override.operation === 'add' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : override.operation === 'edit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {override.operation === 'add' ? 'إضافة' : override.operation === 'edit' ? 'تعديل' : 'حذف'}
                          </span>
                        </TableCell>
                        <TableCell className="font-arabic font-semibold">{override.wordText || '-'}</TableCell>
                        <TableCell className="font-arabic text-sm max-w-[150px] truncate">{override.meaning || '-'}</TableCell>
                        <TableCell>{override.pageNumber || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingOverride(override)}>
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteOverride(override.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground font-arabic">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>لا توجد تعديلات بعد</p>
              </div>
            )}
            {canUndo() && (
              <Button onClick={undo} variant="ghost" className="w-full font-arabic gap-1">
                <RotateCcw className="w-4 h-4" /> تراجع عن آخر تغيير
              </Button>
            )}
          </TabsContent>

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" className="space-y-4 mt-4">
            {!diagRunning ? (
              <div className="text-center py-8 space-y-4">
                <Stethoscope className="w-16 h-16 mx-auto text-muted-foreground/40" />
                <h3 className="font-arabic font-bold text-lg">فحص تشخيصي للبيانات</h3>
                <p className="font-arabic text-sm text-muted-foreground max-w-md mx-auto">
                  يفحص جميع الكلمات ({resolvedWords.length.toLocaleString()}) للكشف عن: كلمات بدون معنى، تكرارات، بيانات ناقصة، أرقام سور أو صفحات خاطئة.
                </p>
                <Button onClick={() => setDiagRunning(true)} className="font-arabic gap-2">
                  <Stethoscope className="w-4 h-4" />
                  بدء الفحص
                </Button>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <button onClick={() => setDiagFilter('all')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'all' ? 'border-primary bg-primary/5' : ''}`}>
                    <div className={`text-lg font-bold ${diagStats.total === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {diagStats.total}
                    </div>
                    <div className="text-[10px] font-arabic text-muted-foreground">الكل</div>
                  </button>
                  <button onClick={() => setDiagFilter('missing_meaning')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'missing_meaning' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.missingMeaning}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">بدون معنى</div>
                  </button>
                  <button onClick={() => setDiagFilter('duplicate')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'duplicate' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : ''}`}>
                    <div className="text-lg font-bold text-amber-600">{diagStats.duplicates}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">مكررة</div>
                  </button>
                  <button onClick={() => setDiagFilter('empty_word')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'empty_word' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.emptyWords}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">نص فارغ</div>
                  </button>
                  <button onClick={() => setDiagFilter('invalid_page')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'invalid_page' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.invalidPage + diagStats.invalidSurah}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">بيانات خاطئة</div>
                  </button>
                  <button onClick={() => setDiagFilter('short_meaning')}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'short_meaning' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : ''}`}>
                    <div className="text-lg font-bold text-amber-600">{diagStats.shortMeaning}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">معنى قصير</div>
                  </button>
                </div>

                {/* Health score */}
                <div className={`p-3 border rounded-lg flex items-center gap-3 ${
                  diagStats.total === 0 ? 'border-green-300 bg-green-50 dark:bg-green-950'
                  : diagStats.errors > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950'
                  : 'border-amber-300 bg-amber-50 dark:bg-amber-950'
                }`}>
                  {diagStats.total === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : diagStats.errors > 0 ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-arabic text-sm">
                    {diagStats.total === 0
                      ? 'لا توجد مشكلات! البيانات سليمة ✓'
                      : `${diagStats.errors} خطأ و ${diagStats.warnings} تحذير من أصل ${resolvedWords.length.toLocaleString()} كلمة`}
                  </span>
                  <Button size="sm" variant="ghost" className="mr-auto font-arabic text-xs"
                    onClick={() => { setDiagRunning(false); setDiagFilter('all'); }}>
                    إعادة الفحص
                  </Button>
                </div>

                {/* Issues List */}
                {filteredDiagIssues.length > 0 && (
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="font-arabic text-right w-14">النوع</TableHead>
                          <TableHead className="font-arabic text-right">الوصف</TableHead>
                          <TableHead className="font-arabic text-right w-14">ص</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDiagIssues.slice(0, 200).map((issue, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {issue.severity === 'error' ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-arabic text-sm">{issue.message}</TableCell>
                            <TableCell className="text-sm">{issue.word.pageNumber}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-7 text-xs font-arabic"
                                onClick={() => handleFixIssue(issue)}>
                                إصلاح
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredDiagIssues.length > 200 && (
                      <p className="text-xs text-muted-foreground text-center py-2 font-arabic">
                        يُعرض أول 200 مشكلة من {filteredDiagIssues.length}
                      </p>
                    )}
                  </ScrollArea>
                )}
              </>
            )}
          </TabsContent>

          {/* Import/Export Tab */}
          <TabsContent value="io" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-arabic font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" /> تصدير
                </h4>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleExportJSON} variant="outline" className="font-arabic gap-1">
                    <FileJson className="w-4 h-4" /> تصدير JSON
                  </Button>
                  <Button onClick={handleExportCSV} variant="outline" className="font-arabic gap-1">
                    <FileSpreadsheet className="w-4 h-4" /> تصدير CSV
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-arabic font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4" /> استيراد
                </h4>
                <Button onClick={handleImportFile} variant="outline" className="font-arabic gap-1 w-full">
                  <Upload className="w-4 h-4" /> استيراد من ملف
                </Button>
              </div>
            </div>
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-arabic font-semibold">استيراد من نص</h4>
              <Textarea value={importText} onChange={e => setImportText(e.target.value)}
                placeholder='{"overrides": [...]}' className="font-mono text-sm h-24" dir="ltr" />
              <Button onClick={handleImportText} className="w-full font-arabic gap-1">
                <Upload className="w-4 h-4" /> استيراد
              </Button>
            </div>
            <div className="p-4 border rounded-lg border-destructive/30 bg-destructive/5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-arabic font-semibold text-destructive">إعادة تعيين</h4>
                  <p className="text-xs font-arabic text-muted-foreground">حذف جميع التعديلات نهائياً</p>
                </div>
                <Button onClick={handleResetAll} variant="destructive" className="font-arabic gap-1">
                  <Trash2 className="w-4 h-4" /> إعادة تعيين
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Override Modal */}
        {editingOverride && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
              <h3 className="font-arabic font-bold flex items-center gap-2">
                <Edit3 className="w-4 h-4" /> تعديل البيانات
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="font-arabic text-xs">الكلمة</Label>
                  <Input value={editingOverride.wordText || ''} onChange={e => setEditingOverride(o => o ? { ...o, wordText: e.target.value } : null)}
                    className="font-arabic" dir="rtl" />
                </div>
                <div>
                  <Label className="font-arabic text-xs">المعنى</Label>
                  <Textarea value={editingOverride.meaning || ''} onChange={e => setEditingOverride(o => o ? { ...o, meaning: e.target.value } : null)}
                    className="font-arabic min-h-[80px]" dir="rtl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الصفحة</Label>
                    <Input type="number" min={1} max={604} value={editingOverride.pageNumber || ''}
                      onChange={e => setEditingOverride(o => o ? { ...o, pageNumber: parseInt(e.target.value) || undefined } : null)} />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">السورة</Label>
                    <Input type="number" min={1} max={114} value={editingOverride.surahNumber || ''}
                      onChange={e => setEditingOverride(o => o ? { ...o, surahNumber: parseInt(e.target.value) || undefined } : null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الآية</Label>
                    <Input type="number" min={1} value={editingOverride.verseNumber || ''}
                      onChange={e => setEditingOverride(o => o ? { ...o, verseNumber: parseInt(e.target.value) || undefined } : null)} />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الترتيب</Label>
                    <Input type="number" min={0} value={editingOverride.wordIndex || ''}
                      onChange={e => setEditingOverride(o => o ? { ...o, wordIndex: parseInt(e.target.value) || undefined } : null)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} className="flex-1 font-arabic gap-1">
                  <Check className="w-4 h-4" /> حفظ
                </Button>
                <Button onClick={() => setEditingOverride(null)} variant="outline" className="flex-1 font-arabic gap-1">
                  <X className="w-4 h-4" /> إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
