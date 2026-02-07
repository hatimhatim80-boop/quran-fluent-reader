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
import { useDataStore } from '@/stores/dataStore';
import { GhareebWord } from '@/types/quran';
import {
  FileText,
  Search,
  Edit3,
  Trash2,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Check,
  X,
  Database,
  Layers,
  FilePlus,
  FileUp,
  BookOpen,
  Eye,
  Copy,
  FileJson,
  FileSpreadsheet,
  File,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileEditorDialogProps {
  children: React.ReactNode;
  allWords?: GhareebWord[];
}

interface EditingEntry {
  key: string;
  wordText: string;
  meaning: string;
  pageNumber: number;
  surahNumber: number;
  verseNumber: number;
  wordIndex: number;
  surahName: string;
  isNew?: boolean;
}

type ImportFormat = 'json' | 'csv' | 'txt';

export function FileEditorDialog({ children, allWords = [] }: FileEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [activeTab, setActiveTab] = useState('sources');
  
  // Mushaf text editor state
  const [mushafPage, setMushafPage] = useState(1);
  const [mushafText, setMushafText] = useState('');
  const [isMushafDirty, setIsMushafDirty] = useState(false);
  
  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>('json');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importContent, setImportContent] = useState('');
  const [importPageTarget, setImportPageTarget] = useState<number | null>(null);

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

  // Get resolved data (base + overrides)
  const resolvedWords = useMemo(() => {
    return applyOverrides(allWords);
  }, [allWords, applyOverrides]);

  // Filter words
  const filteredWords = useMemo(() => {
    let words = resolvedWords;

    if (pageFilter) {
      words = words.filter((w) => w.pageNumber === pageFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      words = words.filter(
        (w) =>
          w.wordText.includes(query) ||
          w.meaning.includes(query) ||
          w.surahName.toLowerCase().includes(query)
      );
    }

    return words.sort((a, b) => a.pageNumber - b.pageNumber || a.order - b.order);
  }, [resolvedWords, pageFilter, searchQuery]);

  // Get page-specific words
  const pageWords = useMemo(() => {
    return resolvedWords.filter((w) => w.pageNumber === mushafPage)
      .sort((a, b) => a.order - b.order);
  }, [resolvedWords, mushafPage]);

  // Data sources info
  const sourcesInfo = useMemo(() => [
    {
      name: 'نص المصحف',
      file: 'quran-tanzil.txt',
      type: 'read-only',
      count: 6236,
      description: 'نص المصحف العثماني من موقع Tanzil.net',
      icon: BookOpen,
    },
    {
      name: 'الكلمات الغريبة',
      file: 'ghareeb-words.txt',
      type: 'read-only',
      count: allWords.length,
      description: 'كلمات غريب القرآن ومعانيها',
      icon: FileText,
    },
    {
      name: 'تعديلات المستخدم',
      file: 'user-overrides.json',
      type: 'editable',
      count: userOverrides.length,
      description: 'طبقة التعديلات المحلية (localStorage)',
      icon: Layers,
    },
  ], [allWords.length, userOverrides.length]);

  const handleEdit = (word: GhareebWord) => {
    setEditingEntry({
      key: word.uniqueKey,
      wordText: word.wordText,
      meaning: word.meaning,
      pageNumber: word.pageNumber,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex,
      surahName: word.surahName,
    });
  };

  const handleAddNew = () => {
    setEditingEntry({
      key: '',
      wordText: '',
      meaning: '',
      pageNumber: pageFilter || mushafPage || 1,
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: 0,
      surahName: '',
      isNew: true,
    });
  };

  const handleSave = () => {
    if (!editingEntry) return;

    const key = editingEntry.isNew
      ? `${editingEntry.surahNumber}_${editingEntry.verseNumber}_${editingEntry.wordIndex}`
      : editingEntry.key;

    addWordOverride({
      key,
      operation: editingEntry.isNew ? 'add' : 'edit',
      wordText: editingEntry.wordText,
      meaning: editingEntry.meaning,
      pageNumber: editingEntry.pageNumber,
      surahNumber: editingEntry.surahNumber,
      verseNumber: editingEntry.verseNumber,
      wordIndex: editingEntry.wordIndex,
      surahName: editingEntry.surahName,
    });

    toast.success(editingEntry.isNew ? 'تمت إضافة الكلمة' : 'تم حفظ التعديل');
    setEditingEntry(null);
  };

  const handleDelete = (word: GhareebWord) => {
    if (confirm(`هل تريد حذف "${word.wordText}"؟`)) {
      addWordOverride({
        key: word.uniqueKey,
        operation: 'delete',
        pageNumber: word.pageNumber,
      });
      toast.success('تم الحذف');
    }
  };

  const handleDuplicate = (word: GhareebWord) => {
    const newKey = `${word.surahNumber}_${word.verseNumber}_${word.wordIndex + 100}`;
    addWordOverride({
      key: newKey,
      operation: 'add',
      pageNumber: word.pageNumber,
      wordText: word.wordText,
      meaning: word.meaning,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex + 100,
      surahName: word.surahName,
    });
    toast.success('تم نسخ الكلمة');
  };

  // Export functions
  const handleExportJSON = () => {
    const json = exportOverrides();
    downloadFile(json, 'quran-user-overrides.json', 'application/json');
    toast.success('تم تصدير التعديلات JSON');
  };

  const handleExportCSV = () => {
    const csv = generateCSV(userOverrides);
    downloadFile(csv, 'quran-user-overrides.csv', 'text/csv;charset=utf-8');
    toast.success('تم تصدير التعديلات CSV');
  };

  const handleExportFullData = () => {
    const fullData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalWords: resolvedWords.length,
      words: resolvedWords.map((w) => ({
        page: w.pageNumber,
        surah: w.surahNumber,
        ayah: w.verseNumber,
        wordIndex: w.wordIndex,
        word: w.wordText,
        meaning: w.meaning,
        surahName: w.surahName,
      })),
    };
    downloadFile(JSON.stringify(fullData, null, 2), 'quran-full-data.json', 'application/json');
    toast.success('تم تصدير البيانات الكاملة');
  };

  const generateCSV = (data: typeof userOverrides) => {
    const header = 'operation,page,surah,ayah,wordIndex,word,meaning,surahName,key\n';
    const rows = data.map((o) => 
      `${o.operation},${o.pageNumber || ''},${o.surahNumber || ''},${o.verseNumber || ''},${o.wordIndex || ''},"${o.wordText || ''}","${o.meaning || ''}","${o.surahName || ''}",${o.key}`
    ).join('\n');
    return header + rows;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import functions
  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setImportContent(content);
          
          // Auto-detect format
          if (file.name.endsWith('.json')) {
            setImportFormat('json');
          } else if (file.name.endsWith('.csv')) {
            setImportFormat('csv');
          } else {
            setImportFormat('txt');
          }
          
          setShowImportDialog(true);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const processImport = () => {
    try {
      if (importFormat === 'json') {
        const result = importOverrides(importContent);
        if (result.success) {
          toast.success(`تم استيراد ${result.count} تعديل`);
        } else {
          toast.error('فشل استيراد التعديلات');
        }
      } else if (importFormat === 'csv') {
        const lines = importContent.trim().split('\n');
        const header = lines[0].split(',');
        let imported = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length >= 6) {
            addWordOverride({
              key: `${values[2]}_${values[3]}_${values[4]}`,
              operation: (values[0] as 'add' | 'edit' | 'delete') || 'add',
              pageNumber: parseInt(values[1]) || (importPageTarget || 1),
              surahNumber: parseInt(values[2]) || 1,
              verseNumber: parseInt(values[3]) || 1,
              wordIndex: parseInt(values[4]) || 0,
              wordText: values[5]?.replace(/"/g, '') || '',
              meaning: values[6]?.replace(/"/g, '') || '',
              surahName: values[7]?.replace(/"/g, '') || '',
            });
            imported++;
          }
        }
        toast.success(`تم استيراد ${imported} كلمة`);
      } else {
        // TXT format: word|meaning|surah|ayah|wordIndex per line
        const lines = importContent.trim().split('\n');
        let imported = 0;
        
        for (const line of lines) {
          const parts = line.split('|').map((p) => p.trim());
          if (parts.length >= 2) {
            const [word, meaning, surah, ayah, idx] = parts;
            addWordOverride({
              key: `${surah || 1}_${ayah || 1}_${idx || 0}`,
              operation: 'add',
              pageNumber: importPageTarget || 1,
              surahNumber: parseInt(surah) || 1,
              verseNumber: parseInt(ayah) || 1,
              wordIndex: parseInt(idx) || 0,
              wordText: word,
              meaning: meaning,
              surahName: '',
            });
            imported++;
          }
        }
        toast.success(`تم استيراد ${imported} كلمة`);
      }
      
      setShowImportDialog(false);
      setImportContent('');
    } catch (err) {
      console.error('Import error:', err);
      toast.error('حدث خطأ أثناء الاستيراد');
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من حذف جميع التعديلات؟ سيتم استعادة البيانات الأصلية.')) {
      resetAll();
      toast.success('تم إعادة تعيين التعديلات');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <Database className="w-5 h-5" />
            محرر الملفات والبيانات
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sources" className="gap-1 text-xs font-arabic">
              <Database className="w-4 h-4" />
              المصادر
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1 text-xs font-arabic">
              <Edit3 className="w-4 h-4" />
              تحرير
            </TabsTrigger>
            <TabsTrigger value="page" className="gap-1 text-xs font-arabic">
              <BookOpen className="w-4 h-4" />
              الصفحات
            </TabsTrigger>
            <TabsTrigger value="overrides" className="gap-1 text-xs font-arabic">
              <Layers className="w-4 h-4" />
              التعديلات
            </TabsTrigger>
          </TabsList>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4 mt-4">
            <div className="space-y-3">
              {sourcesInfo.map((source) => {
                const Icon = source.icon;
                return (
                  <div
                    key={source.file}
                    className="p-4 border rounded-lg bg-card flex items-center justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-arabic font-semibold">{source.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{source.file}</p>
                        <p className="text-sm text-muted-foreground font-arabic mt-1">
                          {source.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-lg font-bold">{source.count.toLocaleString()}</span>
                      <span className={`block text-xs ${source.type === 'editable' ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {source.type === 'editable' ? 'قابل للتعديل' : 'للقراءة فقط'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border rounded-lg bg-muted/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="font-arabic text-sm text-muted-foreground">
                <strong>ملاحظة:</strong> الملفات الأساسية للقراءة فقط لحمايتها من التغيير العرضي. 
                جميع التعديلات تُحفظ في طبقة منفصلة (User Overrides) تتجاوز البيانات الأصلية دون تغييرها.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExportFullData} variant="outline" size="sm" className="gap-2 font-arabic">
                <FileJson className="w-4 h-4" />
                تصدير كامل
              </Button>
              <Button onClick={handleImportFile} variant="outline" size="sm" className="gap-2 font-arabic">
                <FileUp className="w-4 h-4" />
                استيراد ملف
              </Button>
            </div>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-4 mt-4">
            {/* Search & Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في الكلمات..."
                  className="pr-10 font-arabic"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-arabic text-sm">الصفحة:</Label>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={pageFilter || ''}
                  onChange={(e) => setPageFilter(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="الكل"
                  className="w-20"
                />
              </div>
              <Button onClick={handleAddNew} variant="outline" className="gap-1 font-arabic">
                <Plus className="w-4 h-4" />
                إضافة
              </Button>
            </div>

            {/* Stats */}
            <div className="text-sm font-arabic text-muted-foreground">
              عدد النتائج: <strong className="text-foreground">{filteredWords.length}</strong>
              {pageFilter && <span className="mr-3">| الصفحة: {pageFilter}</span>}
            </div>

            {/* Words Table */}
            <ScrollArea className="h-[350px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="font-arabic text-right w-16">الصفحة</TableHead>
                    <TableHead className="font-arabic text-right">الكلمة</TableHead>
                    <TableHead className="font-arabic text-right">المعنى</TableHead>
                    <TableHead className="font-arabic text-right">السورة</TableHead>
                    <TableHead className="font-arabic text-right w-16">الآية</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWords.slice(0, 150).map((word) => (
                    <TableRow key={word.uniqueKey}>
                      <TableCell className="text-muted-foreground">{word.pageNumber}</TableCell>
                      <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                      <TableCell className="font-arabic text-sm max-w-[200px] truncate">
                        {word.meaning || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="font-arabic text-sm">{word.surahName}</TableCell>
                      <TableCell>{word.verseNumber}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEdit(word)}
                            title="تعديل"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDuplicate(word)}
                            title="نسخ"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(word)}
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {filteredWords.length > 150 && (
              <p className="text-xs text-muted-foreground font-arabic text-center">
                يتم عرض أول 150 نتيجة. استخدم البحث أو تصفية الصفحة لتضييق النتائج.
              </p>
            )}
          </TabsContent>

          {/* Page Tab */}
          <TabsContent value="page" className="space-y-4 mt-4">
            {/* Page Selector */}
            <div className="flex items-center gap-3">
              <Label className="font-arabic">رقم الصفحة:</Label>
              <Input
                type="number"
                min={1}
                max={604}
                value={mushafPage}
                onChange={(e) => setMushafPage(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <span className="text-sm font-arabic text-muted-foreground">
                ({pageWords.length} كلمة غريبة)
              </span>
            </div>

            {/* Page Words */}
            <div className="border rounded-lg p-4 bg-card">
              <h4 className="font-arabic font-bold mb-3">كلمات الصفحة {mushafPage}</h4>
              <ScrollArea className="h-[250px]">
                {pageWords.length > 0 ? (
                  <div className="space-y-2">
                    {pageWords.map((word, idx) => (
                      <div
                        key={word.uniqueKey}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-arabic font-semibold">{word.wordText}</span>
                          <span className="text-sm text-muted-foreground font-arabic">
                            → {word.meaning || 'بدون معنى'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEdit(word)}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(word)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground font-arabic">
                    لا توجد كلمات غريبة في هذه الصفحة
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Add New Word to Page */}
            <Button
              onClick={() => {
                setEditingEntry({
                  key: '',
                  wordText: '',
                  meaning: '',
                  pageNumber: mushafPage,
                  surahNumber: 1,
                  verseNumber: 1,
                  wordIndex: pageWords.length,
                  surahName: '',
                  isNew: true,
                });
              }}
              variant="outline"
              className="w-full font-arabic"
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة كلمة للصفحة {mushafPage}
            </Button>
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExportJSON} variant="outline" size="sm" className="gap-2 font-arabic">
                <FileJson className="w-4 h-4" />
                JSON
              </Button>
              <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2 font-arabic">
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </Button>
              <Button onClick={handleImportFile} variant="outline" size="sm" className="gap-2 font-arabic">
                <Upload className="w-4 h-4" />
                استيراد
              </Button>
              <div className="h-8 w-px bg-border mx-1" />
              <Button
                onClick={() => undo()}
                variant="outline"
                size="sm"
                disabled={!canUndo()}
                className="gap-2 font-arabic"
              >
                <RotateCcw className="w-4 h-4" />
                تراجع
              </Button>
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="gap-2 font-arabic text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                مسح الكل
              </Button>
            </div>

            {/* Overrides List */}
            <div className="text-sm font-arabic text-muted-foreground mb-2">
              عدد التعديلات: <strong className="text-foreground">{userOverrides.length}</strong>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              {userOverrides.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-arabic">
                  <FilePlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد تعديلات بعد</p>
                  <p className="text-xs mt-1">عدّل أي كلمة من تبويب "تحرير" لإضافة تعديل</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="font-arabic text-right w-20">العملية</TableHead>
                      <TableHead className="font-arabic text-right">الكلمة</TableHead>
                      <TableHead className="font-arabic text-right">المعنى</TableHead>
                      <TableHead className="font-arabic text-right w-16">الصفحة</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userOverrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-arabic ${
                              override.operation === 'add'
                                ? 'bg-green-100 text-green-700'
                                : override.operation === 'edit'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {override.operation === 'add' ? 'إضافة' : override.operation === 'edit' ? 'تعديل' : 'حذف'}
                          </span>
                        </TableCell>
                        <TableCell className="font-arabic">{override.wordText || '—'}</TableCell>
                        <TableCell className="font-arabic text-sm max-w-[150px] truncate">
                          {override.meaning || '—'}
                        </TableCell>
                        <TableCell>{override.pageNumber}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteWordOverride(override.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Edit Modal */}
        {editingEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4 shadow-xl" dir="rtl">
              <h3 className="font-arabic font-bold text-lg">
                {editingEntry.isNew ? '➕ إضافة كلمة جديدة' : '✏️ تعديل الكلمة'}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label className="font-arabic text-sm">الكلمة *</Label>
                  <Input
                    value={editingEntry.wordText}
                    onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, wordText: e.target.value } : null)}
                    className="font-arabic text-lg"
                    dir="rtl"
                    placeholder="الكلمة الغريبة..."
                  />
                </div>
                <div>
                  <Label className="font-arabic text-sm">المعنى *</Label>
                  <Textarea
                    value={editingEntry.meaning}
                    onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, meaning: e.target.value } : null)}
                    className="font-arabic min-h-[80px]"
                    dir="rtl"
                    placeholder="معنى الكلمة..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الصفحة</Label>
                    <Input
                      type="number"
                      min={1}
                      max={604}
                      value={editingEntry.pageNumber}
                      onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, pageNumber: parseInt(e.target.value) || 1 } : null)}
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">السورة</Label>
                    <Input
                      type="number"
                      min={1}
                      max={114}
                      value={editingEntry.surahNumber}
                      onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, surahNumber: parseInt(e.target.value) || 1 } : null)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الآية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingEntry.verseNumber}
                      onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, verseNumber: parseInt(e.target.value) || 1 } : null)}
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingEntry.wordIndex}
                      onChange={(e) => setEditingEntry((prev) => prev ? { ...prev, wordIndex: parseInt(e.target.value) || 0 } : null)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1 font-arabic">
                  <Check className="w-4 h-4 ml-2" />
                  حفظ
                </Button>
                <Button onClick={() => setEditingEntry(null)} variant="outline" className="flex-1 font-arabic">
                  <X className="w-4 h-4 ml-2" />
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-lg w-full mx-4 space-y-4 shadow-xl" dir="rtl">
              <h3 className="font-arabic font-bold text-lg flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                استيراد البيانات
              </h3>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="font-arabic text-sm">التنسيق</Label>
                    <Select value={importFormat} onValueChange={(v) => setImportFormat(v as ImportFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="txt">TXT (word|meaning)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="font-arabic text-sm">الوضع</Label>
                    <Select value={importMode} onValueChange={(v) => setImportMode(v as 'merge' | 'replace')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merge">دمج</SelectItem>
                        <SelectItem value="replace">استبدال</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {importFormat !== 'json' && (
                  <div>
                    <Label className="font-arabic text-sm">الصفحة الافتراضية (اختياري)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={604}
                      value={importPageTarget || ''}
                      onChange={(e) => setImportPageTarget(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="إذا لم يُحدد في الملف"
                    />
                  </div>
                )}

                <div>
                  <Label className="font-arabic text-sm">معاينة المحتوى</Label>
                  <Textarea
                    value={importContent.slice(0, 500) + (importContent.length > 500 ? '...' : '')}
                    readOnly
                    className="font-mono text-xs h-32"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button onClick={processImport} className="flex-1 font-arabic">
                  <Check className="w-4 h-4 ml-2" />
                  استيراد
                </Button>
                <Button onClick={() => setShowImportDialog(false)} variant="outline" className="flex-1 font-arabic">
                  <X className="w-4 h-4 ml-2" />
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
