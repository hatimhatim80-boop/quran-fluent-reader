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
import {
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Database,
  FileText,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface DataManagerDialogProps {
  children: React.ReactNode;
}

export function DataManagerDialog({ children }: DataManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<string>('all');
  
  // Edit form state
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

  const {
    userOverrides,
    addWordOverride,
    updateWordOverride,
    deleteWordOverride,
    exportOverrides,
    importOverrides,
    undo,
    canUndo,
    resetAll,
  } = useDataStore();

  const { corrections, exportCorrections, importCorrections } = useCorrectionsStore();

  // Filtered overrides
  const filteredOverrides = useMemo(() => {
    let result = userOverrides;
    
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
    
    return result;
  }, [userOverrides, pageFilter, searchQuery]);

  const handleExportAll = () => {
    const dataExport = exportOverrides();
    const correctionsExport = exportCorrections();
    
    const combined = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: JSON.parse(dataExport),
      corrections: JSON.parse(correctionsExport),
    };
    
    downloadFile(JSON.stringify(combined, null, 2), 'quran-app-backup.json', 'application/json');
    toast.success('تم تصدير جميع البيانات');
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
            
            // Import data overrides
            if (data.data?.overrides) {
              const result = importOverrides(JSON.stringify({ overrides: data.data.overrides }));
              if (result.success) imported += result.count;
            } else if (data.overrides) {
              const result = importOverrides(json);
              if (result.success) imported += result.count;
            }
            
            // Import corrections
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

  const handleAddEntry = () => {
    const key = `${newEntryForm.surahNumber}_${newEntryForm.verseNumber}_${newEntryForm.wordIndex}`;
    addWordOverride({
      key,
      operation: 'add',
      ...newEntryForm,
    });
    
    setNewEntryForm({
      pageNumber: 1,
      wordText: '',
      meaning: '',
      surahNumber: 1,
      verseNumber: 1,
      wordIndex: 0,
      surahName: '',
    });
    
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

  const handleDelete = (id: string) => {
    deleteWordOverride(id);
    toast.success('تم الحذف');
  };

  const handleResetAll = () => {
    if (confirm('هل أنت متأكد من حذف جميع التعديلات؟')) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <Database className="w-5 h-5" />
            مدير البيانات
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="sources" className="font-arabic text-xs">
              <FileText className="w-3 h-3 ml-1" />
              المصادر
            </TabsTrigger>
            <TabsTrigger value="edit" className="font-arabic text-xs">
              <Edit3 className="w-3 h-3 ml-1" />
              التعديل
            </TabsTrigger>
            <TabsTrigger value="import" className="font-arabic text-xs">
              <Upload className="w-3 h-3 ml-1" />
              استيراد
            </TabsTrigger>
            <TabsTrigger value="export" className="font-arabic text-xs">
              <Download className="w-3 h-3 ml-1" />
              تصدير
            </TabsTrigger>
          </TabsList>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="page-frame p-4 text-center">
                <div className="text-3xl font-bold text-primary">604</div>
                <div className="text-sm font-arabic text-muted-foreground">صفحة المصحف</div>
              </div>
              <div className="page-frame p-4 text-center">
                <div className="text-3xl font-bold text-accent">{userOverrides.length}</div>
                <div className="text-sm font-arabic text-muted-foreground">تعديلات المستخدم</div>
              </div>
              <div className="page-frame p-4 text-center">
                <div className="text-3xl font-bold text-primary">{corrections.length}</div>
                <div className="text-sm font-arabic text-muted-foreground">التصحيحات</div>
              </div>
              <div className="page-frame p-4 text-center">
                <div className="text-3xl font-bold text-accent">11,364</div>
                <div className="text-sm font-arabic text-muted-foreground">كلمات الغريب</div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-arabic text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                البيانات الأساسية للقراءة فقط. جميع التعديلات تُحفظ في طبقة منفصلة.
              </div>
            </div>
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="space-y-4 mt-4 max-h-[50vh] overflow-y-auto">
            {/* Search & Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث..."
                  className="pr-10 font-arabic"
                />
              </div>
              <Select value={pageFilter} onValueChange={setPageFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="الصفحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Array.from({ length: 604 }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={p.toString()}>
                      ص {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add New Entry */}
            <div className="page-frame p-4 space-y-3">
              <h3 className="font-arabic font-bold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                إضافة كلمة جديدة
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="font-arabic text-xs">الصفحة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={604}
                    value={newEntryForm.pageNumber}
                    onChange={(e) =>
                      setNewEntryForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">السورة</Label>
                  <Input
                    type="number"
                    min={1}
                    max={114}
                    value={newEntryForm.surahNumber}
                    onChange={(e) =>
                      setNewEntryForm((f) => ({ ...f, surahNumber: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">الآية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newEntryForm.verseNumber}
                    onChange={(e) =>
                      setNewEntryForm((f) => ({ ...f, verseNumber: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newEntryForm.wordIndex}
                    onChange={(e) =>
                      setNewEntryForm((f) => ({ ...f, wordIndex: parseInt(e.target.value) || 0 }))
                    }
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
              <Button onClick={handleAddEntry} className="w-full font-arabic">
                <Plus className="w-4 h-4 ml-2" />
                إضافة
              </Button>
            </div>

            {/* Overrides List */}
            {filteredOverrides.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-arabic text-right">الكلمة</TableHead>
                      <TableHead className="font-arabic text-right">المعنى</TableHead>
                      <TableHead className="font-arabic text-right">الصفحة</TableHead>
                      <TableHead className="font-arabic text-right">العملية</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverrides.slice(0, 50).map((override) => (
                      <TableRow key={override.id}>
                        <TableCell className="font-arabic">{override.wordText || '-'}</TableCell>
                        <TableCell className="font-arabic text-sm max-w-[150px] truncate">
                          {override.meaning || '-'}
                        </TableCell>
                        <TableCell>{override.pageNumber || '-'}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
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
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingOverride(override)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(override.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredOverrides.length === 0 && (
              <div className="text-center py-8 text-muted-foreground font-arabic">
                لا توجد تعديلات
              </div>
            )}
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="page-frame p-6 text-center space-y-4">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="font-arabic font-bold">استيراد البيانات</h3>
              <p className="font-arabic text-sm text-muted-foreground">
                استيراد ملف JSON يحتوي على التعديلات والتصحيحات
              </p>
              <Button onClick={handleImportFile} className="font-arabic">
                <Upload className="w-4 h-4 ml-2" />
                اختيار ملف
              </Button>
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="page-frame p-4 text-center space-y-3">
                <Download className="w-8 h-8 mx-auto text-primary" />
                <h3 className="font-arabic font-bold">تصدير كامل</h3>
                <p className="font-arabic text-xs text-muted-foreground">
                  جميع التعديلات والتصحيحات
                </p>
                <Button onClick={handleExportAll} variant="outline" className="font-arabic">
                  تصدير
                </Button>
              </div>
              <div className="page-frame p-4 text-center space-y-3">
                <RotateCcw className="w-8 h-8 mx-auto text-destructive" />
                <h3 className="font-arabic font-bold">إعادة تعيين</h3>
                <p className="font-arabic text-xs text-muted-foreground">
                  حذف جميع التعديلات
                </p>
                <Button onClick={handleResetAll} variant="destructive" className="font-arabic">
                  إعادة تعيين
                </Button>
              </div>
            </div>

            {canUndo() && (
              <Button onClick={undo} variant="ghost" className="w-full font-arabic">
                <RotateCcw className="w-4 h-4 ml-2" />
                تراجع عن آخر تغيير
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        {editingOverride && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
              <h3 className="font-arabic font-bold">تعديل البيانات</h3>
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
                  <Input
                    value={editingOverride.meaning || ''}
                    onChange={(e) =>
                      setEditingOverride((o) => (o ? { ...o, meaning: e.target.value } : null))
                    }
                    className="font-arabic"
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
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} className="flex-1 font-arabic">
                  حفظ
                </Button>
                <Button
                  onClick={() => setEditingOverride(null)}
                  variant="outline"
                  className="flex-1 font-arabic"
                >
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
