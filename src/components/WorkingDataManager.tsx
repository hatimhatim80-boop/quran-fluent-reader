import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkingDataManagerProps {
  children: React.ReactNode;
  allWords?: GhareebWord[];
}

export function WorkingDataManager({ children, allWords = [] }: WorkingDataManagerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<string>('all');
  
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

  // Filtered overrides
  const filteredOverrides = useMemo(() => {
    let result = [...userOverrides];
    
    if (pageFilter !== 'all') {
      result = result.filter((o) => o.pageNumber === parseInt(pageFilter));
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.wordText?.includes(query) ||
          o.meaning?.includes(query) ||
          o.key.includes(query)
      );
    }
    
    return result.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [userOverrides, pageFilter, searchQuery]);

  // Filtered base words (for browsing)
  const filteredBaseWords = useMemo(() => {
    let result = resolvedWords;
    
    if (pageFilter !== 'all') {
      result = result.filter((w) => w.pageNumber === parseInt(pageFilter));
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (w) =>
          w.wordText.includes(query) ||
          w.meaning.includes(query) ||
          w.surahName.toLowerCase().includes(query)
      );
    }
    
    return result.slice(0, 100); // Limit for performance
  }, [resolvedWords, pageFilter, searchQuery]);

  // Add new entry
  const handleAddEntry = () => {
    if (!newEntryForm.wordText.trim() || !newEntryForm.meaning.trim()) {
      toast.error('أدخل الكلمة والمعنى');
      return;
    }
    
    const key = `${newEntryForm.surahNumber}_${newEntryForm.verseNumber}_${newEntryForm.wordIndex}`;
    addWordOverride({
      key,
      operation: 'add',
      ...newEntryForm,
    });
    
    setNewEntryForm({
      pageNumber: parseInt(pageFilter) || 1,
      wordText: '',
      meaning: '',
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: 0,
      surahName: '',
    });
    
    toast.success('تمت إضافة الكلمة');
  };

  // Save edit
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

  // Delete override
  const handleDeleteOverride = (id: string) => {
    if (confirm('هل تريد حذف هذا التعديل؟')) {
      deleteWordOverride(id);
      toast.success('تم الحذف');
    }
  };

  // Edit base word (creates override)
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
    
    // Find the just-added override and edit it
    const lastOverride = userOverrides[userOverrides.length - 1];
    if (lastOverride) {
      setEditingOverride({...lastOverride, wordText: word.wordText, meaning: word.meaning});
    }
    
    setActiveTab('overrides');
    toast.info('تم إنشاء تعديل - يمكنك الآن تحريره');
  };

  // Delete base word (creates delete override)
  const handleDeleteBaseWord = (word: GhareebWord) => {
    if (confirm(`هل تريد حذف "${word.wordText}"؟`)) {
      addWordOverride({
        key: word.uniqueKey,
        operation: 'delete',
        pageNumber: word.pageNumber,
      });
      toast.success('تم الحذف');
    }
  };

  // Duplicate word
  const handleDuplicateWord = (word: GhareebWord) => {
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

  // Export
  const handleExportJSON = () => {
    const dataExport = exportOverrides();
    const correctionsExport = exportCorrections();
    
    const combined = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      dataOverrides: JSON.parse(dataExport),
      corrections: JSON.parse(correctionsExport),
      stats: {
        totalOverrides: userOverrides.length,
        totalCorrections: corrections.length,
      }
    };
    
    downloadFile(JSON.stringify(combined, null, 2), 'quran-app-backup.json', 'application/json');
    toast.success('تم تصدير البيانات');
  };

  const handleExportCSV = () => {
    const header = 'العملية,الصفحة,السورة,الآية,الترتيب,الكلمة,المعنى,المفتاح\n';
    const rows = userOverrides.map((o) => 
      `${o.operation},${o.pageNumber || ''},${o.surahNumber || ''},${o.verseNumber || ''},${o.wordIndex || ''},"${o.wordText || ''}","${o.meaning || ''}",${o.key}`
    ).join('\n');
    
    downloadFile(header + rows, 'quran-overrides.csv', 'text/csv;charset=utf-8');
    toast.success('تم تصدير CSV');
  };

  // Import
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
          } catch (err) {
            console.error('Import error:', err);
            toast.error('فشل قراءة الملف');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleImportText = () => {
    if (!importText.trim()) {
      toast.error('أدخل البيانات');
      return;
    }
    
    try {
      const result = importOverrides(importText);
      if (result.success) {
        toast.success(`تم استيراد ${result.count} تعديل`);
        setImportText('');
      } else {
        toast.error('فشل الاستيراد - تحقق من صيغة البيانات');
      }
    } catch {
      toast.error('خطأ في تحليل البيانات');
    }
  };

  // Reset
  const handleResetAll = () => {
    if (confirm('هل أنت متأكد من حذف جميع التعديلات؟ لا يمكن التراجع!')) {
      resetAll();
      toast.success('تم إعادة التعيين');
    }
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

  // Stats
  const stats = {
    totalPages: 604,
    totalBaseWords: allWords.length,
    totalResolved: resolvedWords.length,
    totalOverrides: userOverrides.length,
    addedWords: userOverrides.filter((o) => o.operation === 'add').length,
    editedWords: userOverrides.filter((o) => o.operation === 'edit').length,
    deletedWords: userOverrides.filter((o) => o.operation === 'delete').length,
    corrections: corrections.length,
  };

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="font-arabic text-xs gap-1">
              <FileText className="w-3 h-3" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="browse" className="font-arabic text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              تصفح وتحرير
            </TabsTrigger>
            <TabsTrigger value="overrides" className="font-arabic text-xs gap-1">
              <Layers className="w-3 h-3" />
              التعديلات ({stats.totalOverrides})
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
                جميع التعديلات تُحفظ في طبقة منفصلة (localStorage) ولا تغيّر الملفات الأصلية.
                يمكنك تصدير التعديلات واستيرادها لاحقاً.
              </p>
            </div>
          </TabsContent>

          {/* Browse & Edit Tab */}
          <TabsContent value="browse" className="space-y-4 mt-4">
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
              <Select value={pageFilter} onValueChange={setPageFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="الصفحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Array.from({ length: 20 }, (_, i) => (i + 1) * 30).map((p) => (
                    <SelectItem key={p} value={p.toString()}>
                      ص {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add New */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-arabic font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                إضافة كلمة جديدة
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الصفحة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={604}
                    value={newEntryForm.pageNumber}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">السورة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={114}
                    value={newEntryForm.surahNumber}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">الآية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newEntryForm.verseNumber}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">الترتيب</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newEntryForm.wordIndex}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الكلمة</Label>
                  <Input
                    value={newEntryForm.wordText}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, wordText: e.target.value }))}
                    className="font-arabic"
                    placeholder="الكلمة القرآنية"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">المعنى</Label>
                  <Input
                    value={newEntryForm.meaning}
                    onChange={(e) => setNewEntryForm((f) => ({ ...f, meaning: e.target.value }))}
                    className="font-arabic"
                    placeholder="معنى الكلمة"
                    dir="rtl"
                  />
                </div>
              </div>
              <Button onClick={handleAddEntry} className="w-full font-arabic gap-1">
                <Plus className="w-4 h-4" />
                إضافة
              </Button>
            </div>

            {/* Words Table */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="font-arabic text-right">الصفحة</TableHead>
                    <TableHead className="font-arabic text-right">الكلمة</TableHead>
                    <TableHead className="font-arabic text-right">المعنى</TableHead>
                    <TableHead className="font-arabic text-right">الموقع</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBaseWords.map((word) => (
                    <TableRow key={word.uniqueKey}>
                      <TableCell>{word.pageNumber}</TableCell>
                      <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                      <TableCell className="font-arabic text-sm max-w-[200px] truncate">
                        {word.meaning}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {word.surahNumber}:{word.verseNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditBaseWord(word)}
                            title="تعديل"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDuplicateWord(word)}
                            title="نسخ"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteBaseWord(word)}
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
            {filteredBaseWords.length === 100 && (
              <p className="text-xs text-muted-foreground font-arabic text-center">
                يُعرض أول 100 نتيجة. استخدم البحث لتضييق النتائج.
              </p>
            )}
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {filteredOverrides.length > 0 ? (
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="font-arabic text-right">العملية</TableHead>
                      <TableHead className="font-arabic text-right">الكلمة</TableHead>
                      <TableHead className="font-arabic text-right">المعنى</TableHead>
                      <TableHead className="font-arabic text-right">الصفحة</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded font-arabic ${
                              override.operation === 'add'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : override.operation === 'edit'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}
                          >
                            {override.operation === 'add' ? 'إضافة' : override.operation === 'edit' ? 'تعديل' : 'حذف'}
                          </span>
                        </TableCell>
                        <TableCell className="font-arabic font-semibold">{override.wordText || '-'}</TableCell>
                        <TableCell className="font-arabic text-sm max-w-[150px] truncate">
                          {override.meaning || '-'}
                        </TableCell>
                        <TableCell>{override.pageNumber || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingOverride(override)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteOverride(override.id)}
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
            ) : (
              <div className="text-center py-12 text-muted-foreground font-arabic">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>لا توجد تعديلات بعد</p>
                <p className="text-xs mt-2">أضف تعديلات من تبويب "تصفح وتحرير"</p>
              </div>
            )}

            {canUndo() && (
              <Button onClick={undo} variant="ghost" className="w-full font-arabic gap-1">
                <RotateCcw className="w-4 h-4" />
                تراجع عن آخر تغيير
              </Button>
            )}
          </TabsContent>

          {/* Import/Export Tab */}
          <TabsContent value="io" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-arabic font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  تصدير
                </h4>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleExportJSON} variant="outline" className="font-arabic gap-1">
                    <FileJson className="w-4 h-4" />
                    تصدير JSON
                  </Button>
                  <Button onClick={handleExportCSV} variant="outline" className="font-arabic gap-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    تصدير CSV
                  </Button>
                </div>
              </div>

              {/* Import */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-arabic font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  استيراد
                </h4>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleImportFile} variant="outline" className="font-arabic gap-1">
                    <Upload className="w-4 h-4" />
                    استيراد من ملف
                  </Button>
                </div>
              </div>
            </div>

            {/* Text Import */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-arabic font-semibold">استيراد من نص</h4>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"overrides": [...]}'
                className="font-mono text-sm h-32"
                dir="ltr"
              />
              <Button onClick={handleImportText} className="w-full font-arabic gap-1">
                <Upload className="w-4 h-4" />
                استيراد
              </Button>
            </div>

            {/* Reset */}
            <div className="p-4 border rounded-lg border-destructive/30 bg-destructive/5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-arabic font-semibold text-destructive">إعادة تعيين</h4>
                  <p className="text-xs font-arabic text-muted-foreground">حذف جميع التعديلات نهائياً</p>
                </div>
                <Button onClick={handleResetAll} variant="destructive" className="font-arabic gap-1">
                  <Trash2 className="w-4 h-4" />
                  إعادة تعيين
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
                <Edit3 className="w-4 h-4" />
                تعديل البيانات
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="font-arabic text-xs">الكلمة</Label>
                  <Input
                    value={editingOverride.wordText || ''}
                    onChange={(e) =>
                      setEditingOverride((o) => (o ? { ...o, wordText: e.target.value } : null))
                    }
                    className="font-arabic"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">المعنى</Label>
                  <Textarea
                    value={editingOverride.meaning || ''}
                    onChange={(e) =>
                      setEditingOverride((o) => (o ? { ...o, meaning: e.target.value } : null))
                    }
                    className="font-arabic min-h-[80px]"
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
                      value={editingOverride.pageNumber || ''}
                      onChange={(e) =>
                        setEditingOverride((o) =>
                          o ? { ...o, pageNumber: parseInt(e.target.value) || undefined } : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">السورة</Label>
                    <Input
                      type="number"
                      min={1}
                      max={114}
                      value={editingOverride.surahNumber || ''}
                      onChange={(e) =>
                        setEditingOverride((o) =>
                          o ? { ...o, surahNumber: parseInt(e.target.value) || undefined } : null
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">الآية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingOverride.verseNumber || ''}
                      onChange={(e) =>
                        setEditingOverride((o) =>
                          o ? { ...o, verseNumber: parseInt(e.target.value) || undefined } : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">الترتيب</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingOverride.wordIndex || ''}
                      onChange={(e) =>
                        setEditingOverride((o) =>
                          o ? { ...o, wordIndex: parseInt(e.target.value) || undefined } : null
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} className="flex-1 font-arabic gap-1">
                  <Check className="w-4 h-4" />
                  حفظ
                </Button>
                <Button
                  onClick={() => setEditingOverride(null)}
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
