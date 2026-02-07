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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export function FileEditorDialog({ children, allWords = [] }: FileEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [activeTab, setActiveTab] = useState('sources');

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

  // Data sources info
  const sourcesInfo = useMemo(() => [
    {
      name: 'نص المصحف',
      file: 'quran-tanzil.txt',
      type: 'read-only',
      count: 6236, // verses
      description: 'نص المصحف العثماني من موقع Tanzil.net',
    },
    {
      name: 'الكلمات الغريبة',
      file: 'ghareeb-words.txt',
      type: 'read-only',
      count: allWords.length,
      description: 'كلمات غريب القرآن ومعانيها',
    },
    {
      name: 'تعديلات المستخدم',
      file: 'user-overrides',
      type: 'editable',
      count: userOverrides.length,
      description: 'طبقة التعديلات المحلية',
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
      pageNumber: pageFilter || 1,
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

  const handleExport = () => {
    const json = exportOverrides();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quran-user-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير التعديلات');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          const result = importOverrides(json);
          if (result.success) {
            toast.success(`تم استيراد ${result.count} تعديل`);
          } else {
            toast.error('فشل استيراد التعديلات');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من حذف جميع التعديلات؟')) {
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
            <FileText className="w-5 h-5" />
            محرر الملفات والبيانات
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources" className="gap-1 text-xs font-arabic">
              <Database className="w-4 h-4" />
              مصادر البيانات
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1 text-xs font-arabic">
              <Edit3 className="w-4 h-4" />
              تحرير البيانات
            </TabsTrigger>
            <TabsTrigger value="overrides" className="gap-1 text-xs font-arabic">
              <Layers className="w-4 h-4" />
              التعديلات
            </TabsTrigger>
          </TabsList>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4 mt-4">
            <div className="space-y-3">
              {sourcesInfo.map((source) => (
                <div
                  key={source.file}
                  className="p-4 border rounded-lg bg-card flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-arabic font-semibold">{source.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono">{source.file}</p>
                    <p className="text-sm text-muted-foreground font-arabic mt-1">
                      {source.description}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-bold">{source.count.toLocaleString()}</span>
                    <span className={`block text-xs ${source.type === 'editable' ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {source.type === 'editable' ? 'قابل للتعديل' : 'للقراءة فقط'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border rounded-lg bg-muted/30">
              <p className="font-arabic text-sm text-muted-foreground">
                <strong>ملاحظة:</strong> الملفات الأساسية للقراءة فقط. جميع التعديلات تُحفظ في طبقة منفصلة (User Overrides) تتجاوز البيانات الأصلية دون تغييرها.
              </p>
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
            </div>

            {/* Words Table */}
            <ScrollArea className="h-[350px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="font-arabic text-right w-16">الصفحة</TableHead>
                    <TableHead className="font-arabic text-right">الكلمة</TableHead>
                    <TableHead className="font-arabic text-right">المعنى</TableHead>
                    <TableHead className="font-arabic text-right">السورة</TableHead>
                    <TableHead className="font-arabic text-right w-16">الآية</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWords.slice(0, 100).map((word) => (
                    <TableRow key={word.uniqueKey}>
                      <TableCell className="text-muted-foreground">{word.pageNumber}</TableCell>
                      <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                      <TableCell className="font-arabic text-sm max-w-[200px] truncate">
                        {word.meaning}
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

            {filteredWords.length > 100 && (
              <p className="text-xs text-muted-foreground font-arabic text-center">
                يتم عرض أول 100 نتيجة. استخدم البحث أو تصفية الصفحة لتضييق النتائج.
              </p>
            )}
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExport} variant="outline" size="sm" className="gap-1 font-arabic">
                <Download className="w-4 h-4" />
                تصدير التعديلات
              </Button>
              <Button onClick={handleImport} variant="outline" size="sm" className="gap-1 font-arabic">
                <Upload className="w-4 h-4" />
                استيراد تعديلات
              </Button>
              <Button
                onClick={() => undo()}
                variant="outline"
                size="sm"
                disabled={!canUndo()}
                className="gap-1 font-arabic"
              >
                <RotateCcw className="w-4 h-4" />
                تراجع
              </Button>
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="gap-1 font-arabic text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
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
                  <p className="text-xs mt-1">عدّل أي كلمة من تبويب "تحرير البيانات" لإضافة تعديل</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="font-arabic text-right">نوع العملية</TableHead>
                      <TableHead className="font-arabic text-right">المفتاح</TableHead>
                      <TableHead className="font-arabic text-right">الكلمة</TableHead>
                      <TableHead className="font-arabic text-right">الصفحة</TableHead>
                      <TableHead className="font-arabic text-right">التاريخ</TableHead>
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
                            {override.operation === 'add'
                              ? 'إضافة'
                              : override.operation === 'edit'
                              ? 'تعديل'
                              : 'حذف'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{override.key}</TableCell>
                        <TableCell className="font-arabic">{override.wordText || '-'}</TableCell>
                        <TableCell>{override.pageNumber}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(override.updatedAt).toLocaleDateString('ar-EG')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              deleteWordOverride(override.id);
                              toast.success('تم حذف التعديل');
                            }}
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
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
              <h3 className="font-arabic font-bold text-lg">
                {editingEntry.isNew ? 'إضافة كلمة جديدة' : 'تعديل الكلمة'}
              </h3>

              <div className="space-y-3">
                <div>
                  <Label className="font-arabic text-xs">الكلمة</Label>
                  <Input
                    value={editingEntry.wordText}
                    onChange={(e) =>
                      setEditingEntry((prev) => prev && { ...prev, wordText: e.target.value })
                    }
                    className="font-arabic"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">المعنى</Label>
                  <Textarea
                    value={editingEntry.meaning}
                    onChange={(e) =>
                      setEditingEntry((prev) => prev && { ...prev, meaning: e.target.value })
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
                      value={editingEntry.pageNumber}
                      onChange={(e) =>
                        setEditingEntry((prev) =>
                          prev && { ...prev, pageNumber: parseInt(e.target.value) || 1 }
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">اسم السورة</Label>
                    <Input
                      value={editingEntry.surahName}
                      onChange={(e) =>
                        setEditingEntry((prev) => prev && { ...prev, surahName: e.target.value })
                      }
                      className="font-arabic"
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="font-arabic text-xs">رقم السورة</Label>
                    <Input
                      type="number"
                      min={1}
                      max={114}
                      value={editingEntry.surahNumber}
                      onChange={(e) =>
                        setEditingEntry((prev) =>
                          prev && { ...prev, surahNumber: parseInt(e.target.value) || 1 }
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">رقم الآية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingEntry.verseNumber}
                      onChange={(e) =>
                        setEditingEntry((prev) =>
                          prev && { ...prev, verseNumber: parseInt(e.target.value) || 1 }
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingEntry.wordIndex}
                      onChange={(e) =>
                        setEditingEntry((prev) =>
                          prev && { ...prev, wordIndex: parseInt(e.target.value) || 0 }
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1 font-arabic gap-1">
                  <Check className="w-4 h-4" />
                  حفظ
                </Button>
                <Button
                  onClick={() => setEditingEntry(null)}
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
