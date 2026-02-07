import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Eye,
  ArrowLeftRight,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

interface PageEditorDialogProps {
  children: React.ReactNode;
  currentPage?: number;
  pageWords?: GhareebWord[];
  onNavigateToPage?: (page: number) => void;
  onHighlightWord?: (index: number) => void;
}

export function PageEditorDialog({
  children,
  currentPage = 1,
  pageWords = [],
  onNavigateToPage,
  onHighlightWord,
}: PageEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(currentPage);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWord, setEditingWord] = useState<GhareebWord | null>(null);
  const [editForm, setEditForm] = useState({
    wordText: '',
    meaning: '',
    pageNumber: 1,
    surahNumber: 1,
    verseNumber: 1,
    wordIndex: 0,
  });

  const { addWordOverride, userOverrides } = useDataStore();

  // Update page when currentPage changes
  useEffect(() => {
    setPage(currentPage);
  }, [currentPage]);

  // Filter words for current page
  const filteredWords = useMemo(() => {
    let words = pageWords.filter((w) => w.pageNumber === page);
    
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      words = words.filter(
        (w) =>
          w.wordText.includes(query) ||
          w.meaning.includes(query) ||
          w.surahName.toLowerCase().includes(query)
      );
    }
    
    // Sort by order
    return words.sort((a, b) => a.order - b.order);
  }, [pageWords, page, searchQuery]);

  const handleEdit = (word: GhareebWord) => {
    setEditingWord(word);
    setEditForm({
      wordText: word.wordText,
      meaning: word.meaning,
      pageNumber: word.pageNumber,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex,
    });
  };

  const handleSaveEdit = () => {
    if (!editingWord) return;
    
    addWordOverride({
      key: editingWord.uniqueKey,
      operation: 'edit',
      wordText: editForm.wordText,
      meaning: editForm.meaning,
      pageNumber: editForm.pageNumber,
      surahNumber: editForm.surahNumber,
      verseNumber: editForm.verseNumber,
      wordIndex: editForm.wordIndex,
      surahName: editingWord.surahName,
    });
    
    setEditingWord(null);
    toast.success('تم حفظ التعديل');
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

  const handleMovePage = (word: GhareebWord, newPage: number) => {
    addWordOverride({
      key: word.uniqueKey,
      operation: 'edit',
      pageNumber: newPage,
      wordText: word.wordText,
      meaning: word.meaning,
      surahNumber: word.surahNumber,
      verseNumber: word.verseNumber,
      wordIndex: word.wordIndex,
      surahName: word.surahName,
    });
    toast.success(`تم نقل الكلمة إلى صفحة ${newPage}`);
  };

  const handlePreview = (word: GhareebWord, index: number) => {
    onNavigateToPage?.(word.pageNumber);
    setTimeout(() => {
      onHighlightWord?.(index);
    }, 300);
    setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <FileText className="w-5 h-5" />
            التعديل حسب الصفحات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Page Selector & Search */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Label className="font-arabic">الصفحة:</Label>
              <Input
                type="number"
                min={1}
                max={604}
                value={page}
                onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <Button
                onClick={() => onNavigateToPage?.(page)}
                variant="outline"
                size="sm"
                className="font-arabic"
              >
                انتقل
              </Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في كلمات الصفحة..."
                className="pr-10 font-arabic"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm font-arabic text-muted-foreground">
            <span>
              عدد الكلمات: <strong className="text-foreground">{filteredWords.length}</strong>
            </span>
            <span>
              التعديلات: <strong className="text-foreground">{userOverrides.filter(o => o.pageNumber === page).length}</strong>
            </span>
          </div>

          {/* Words Table */}
          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="font-arabic text-right w-12">#</TableHead>
                  <TableHead className="font-arabic text-right">الكلمة</TableHead>
                  <TableHead className="font-arabic text-right">المعنى</TableHead>
                  <TableHead className="font-arabic text-right">السورة</TableHead>
                  <TableHead className="font-arabic text-right">الآية</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWords.map((word, idx) => (
                  <TableRow key={word.uniqueKey}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
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
                          onClick={() => handlePreview(word, idx)}
                          title="معاينة"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
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
          </div>

          {filteredWords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground font-arabic">
              لا توجد كلمات غريبة في هذه الصفحة
            </div>
          )}

          {/* Add New Button */}
          <Button
            variant="outline"
            className="w-full font-arabic"
            onClick={() => {
              setEditingWord({
                pageNumber: page,
                wordText: '',
                meaning: '',
                surahNumber: 1,
                verseNumber: 1,
                wordIndex: 0,
                surahName: '',
                order: filteredWords.length,
                uniqueKey: '',
              });
              setEditForm({
                wordText: '',
                meaning: '',
                pageNumber: page,
                surahNumber: 1,
                verseNumber: 1,
                wordIndex: 0,
              });
            }}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة كلمة جديدة
          </Button>
        </div>

        {/* Edit Modal */}
        {editingWord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 space-y-4" dir="rtl">
              <h3 className="font-arabic font-bold">
                {editingWord.uniqueKey ? 'تعديل الكلمة' : 'إضافة كلمة جديدة'}
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
                  <Input
                    value={editForm.meaning}
                    onChange={(e) => setEditForm((f) => ({ ...f, meaning: e.target.value }))}
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
                      value={editForm.pageNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, pageNumber: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                    <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
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

                {/* Move to page shortcut */}
                {editingWord.uniqueKey && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-arabic text-muted-foreground">نقل سريع:</span>
                    <Select
                      value={editForm.pageNumber.toString()}
                      onValueChange={(v) => {
                        setEditForm((f) => ({ ...f, pageNumber: parseInt(v) }));
                      }}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[page - 2, page - 1, page, page + 1, page + 2]
                          .filter((p) => p >= 1 && p <= 604)
                          .map((p) => (
                            <SelectItem key={p} value={p.toString()}>
                              ص {p}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (editingWord.uniqueKey) {
                      handleSaveEdit();
                    } else {
                      // Add new
                      const newKey = `${editForm.surahNumber}_${editForm.verseNumber}_${editForm.wordIndex}`;
                      addWordOverride({
                        key: newKey,
                        operation: 'add',
                        ...editForm,
                        surahName: '',
                      });
                      setEditingWord(null);
                      toast.success('تمت إضافة الكلمة');
                    }
                  }}
                  className="flex-1 font-arabic"
                >
                  حفظ
                </Button>
                <Button
                  onClick={() => setEditingWord(null)}
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
