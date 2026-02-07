import React, { useState, useMemo, useEffect } from 'react';
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
import { useDataStore, PageOrderOverride } from '@/stores/dataStore';
import { GhareebWord } from '@/types/quran';
import {
  ArrowDownUp,
  Check,
  AlertCircle,
  Play,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  Layers,
  Move,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderFixerDialogProps {
  children: React.ReactNode;
  currentPage?: number;
  onNavigateToPage?: (page: number) => void;
}

interface DiagnosticWord {
  index: number;
  text: string;
  key: string;
  lineGroup: number;
  yPosition: number;
  xPosition: number;
  status: 'match' | 'off-by-one' | 'wrong' | 'missing';
  expectedMeaning?: string;
  actualMeaning?: string;
}

interface LineGroup {
  lineIdx: number;
  yPosition: number;
  words: DiagnosticWord[];
}

export function OrderFixerDialog({
  children,
  currentPage = 1,
  onNavigateToPage,
}: OrderFixerDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diagnostic');
  const [page, setPage] = useState(currentPage);
  const [scope, setScope] = useState<'whole_page' | 'line_range' | 'custom_selection'>('whole_page');
  const [lineStart, setLineStart] = useState(1);
  const [lineEnd, setLineEnd] = useState(1);
  const [offsetAmount, setOffsetAmount] = useState(0);
  
  // Diagnostic state
  const [diagnosticWords, setDiagnosticWords] = useState<DiagnosticWord[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [currentDiagIndex, setCurrentDiagIndex] = useState(0);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const {
    pageOrderOverrides,
    addPageOrderOverride,
    getPageOrderOverride,
    deletePageOrderOverride,
  } = useDataStore();

  // Update page when currentPage prop changes
  useEffect(() => {
    setPage(currentPage);
  }, [currentPage]);

  // Get existing override for current page
  const existingOverride = useMemo(
    () => getPageOrderOverride(page), 
    [page, pageOrderOverrides, getPageOrderOverride]
  );

  // Run diagnostic on page
  const runDiagnostic = () => {
    setIsRunningDiagnostic(true);
    
    // Navigate to page first
    onNavigateToPage?.(page);
    
    // Collect DOM words after a delay
    setTimeout(() => {
      const wordElements = document.querySelectorAll('[data-ghareeb-index]');
      const words: DiagnosticWord[] = [];
      
      // Collect positions and group by line
      const lineGroupMap = new Map<number, DiagnosticWord[]>();
      const LINE_THRESHOLD = 25; // pixels threshold for same line
      
      wordElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const index = parseInt(el.getAttribute('data-ghareeb-index') || '0');
        const key = el.getAttribute('data-ghareeb-key') || '';
        const text = el.textContent || '';
        
        // Find or create line group
        let lineY = -1;
        lineGroupMap.forEach((_, y) => {
          if (Math.abs(rect.top - y) < LINE_THRESHOLD) {
            lineY = y;
          }
        });
        
        if (lineY === -1) {
          lineY = Math.round(rect.top);
          lineGroupMap.set(lineY, []);
        }
        
        const word: DiagnosticWord = {
          index,
          text,
          key,
          lineGroup: 0, // Will be set later
          yPosition: rect.top,
          xPosition: rect.right, // RTL: right position for sorting
          status: 'match',
        };
        
        lineGroupMap.get(lineY)?.push(word);
      });
      
      // Sort lines by Y position and words within each line by X (RTL: descending)
      const sortedLineYs = Array.from(lineGroupMap.keys()).sort((a, b) => a - b);
      const groups: LineGroup[] = [];
      
      sortedLineYs.forEach((y, lineIdx) => {
        const lineWords = lineGroupMap.get(y) || [];
        // Sort by X position (RTL: rightmost first)
        lineWords.sort((a, b) => b.xPosition - a.xPosition);
        // Assign line group
        lineWords.forEach(w => { w.lineGroup = lineIdx; });
        
        groups.push({
          lineIdx,
          yPosition: y,
          words: lineWords,
        });
        
        words.push(...lineWords);
      });
      
      // Re-index sequentially after sorting
      words.forEach((w, i) => { w.index = i; });
      
      setDiagnosticWords(words);
      setLineGroups(groups);
      setCurrentDiagIndex(0);
      setIsRunningDiagnostic(false);
      setLineEnd(groups.length);
      
      if (words.length === 0) {
        toast.error('لا توجد كلمات غريبة في هذه الصفحة');
      } else {
        toast.success(`تم تحليل ${words.length} كلمة في ${groups.length} سطر`);
      }
    }, 500);
  };

  // Navigate diagnostic
  const nextDiagWord = () => {
    if (currentDiagIndex < diagnosticWords.length - 1) {
      setCurrentDiagIndex((i) => i + 1);
      highlightWord(currentDiagIndex + 1);
    }
  };

  const prevDiagWord = () => {
    if (currentDiagIndex > 0) {
      setCurrentDiagIndex((i) => i - 1);
      highlightWord(currentDiagIndex - 1);
    }
  };

  const highlightWord = (index: number) => {
    const el = document.querySelector(`[data-ghareeb-index="${index}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Add temporary highlight
    el?.classList.add('order-fixer-highlight');
    setTimeout(() => {
      el?.classList.remove('order-fixer-highlight');
    }, 2000);
  };

  // Apply fixes
  const applyRebuildIndices = () => {
    const selectedWords = getSelectedWords();
    if (selectedWords.length === 0) {
      toast.error('لا توجد كلمات في النطاق المحدد');
      return;
    }
    
    addPageOrderOverride({
      pageNumber: page,
      scope,
      lineStart: scope === 'line_range' ? lineStart : undefined,
      lineEnd: scope === 'line_range' ? lineEnd : undefined,
      operation: 'rebuild_indices',
    });
    toast.success(`تم إعادة بناء الفهارس لـ ${selectedWords.length} كلمة`);
  };

  const applyOffsetShift = () => {
    if (offsetAmount === 0) {
      toast.error('يرجى تحديد مقدار الإزاحة');
      return;
    }
    
    addPageOrderOverride({
      pageNumber: page,
      scope,
      lineStart: scope === 'line_range' ? lineStart : undefined,
      lineEnd: scope === 'line_range' ? lineEnd : undefined,
      operation: 'offset_shift',
      offsetAmount,
    });
    toast.success(`تم تطبيق إزاحة ${offsetAmount > 0 ? '+' : ''}${offsetAmount}`);
  };

  const lockCurrentOrder = () => {
    const selectedWords = getSelectedWords();
    if (selectedWords.length === 0) {
      toast.error('لا توجد كلمات في النطاق المحدد');
      return;
    }
    
    const orderedKeys = selectedWords.map((w) => w.key);
    
    addPageOrderOverride({
      pageNumber: page,
      scope,
      lineStart: scope === 'line_range' ? lineStart : undefined,
      lineEnd: scope === 'line_range' ? lineEnd : undefined,
      operation: 'locked_order',
      orderedKeys,
    });
    toast.success(`تم تثبيت ترتيب ${orderedKeys.length} كلمة`);
  };

  const clearOverride = () => {
    deletePageOrderOverride(page);
    toast.success('تم حذف تجاوز الترتيب');
  };

  // Get words in selected scope
  const getSelectedWords = (): DiagnosticWord[] => {
    if (scope === 'whole_page') {
      return diagnosticWords;
    } else if (scope === 'line_range') {
      return diagnosticWords.filter(
        w => w.lineGroup >= lineStart - 1 && w.lineGroup <= lineEnd - 1
      );
    }
    return diagnosticWords;
  };

  const currentWord = diagnosticWords[currentDiagIndex];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <ArrowDownUp className="w-5 h-5" />
            مصحح الترتيب المتقدم
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="diagnostic" className="font-arabic text-xs">
              <Play className="w-3 h-3 ml-1" />
              التشخيص
            </TabsTrigger>
            <TabsTrigger value="fix" className="font-arabic text-xs">
              <Move className="w-3 h-3 ml-1" />
              الإصلاح
            </TabsTrigger>
            <TabsTrigger value="overrides" className="font-arabic text-xs">
              <Layers className="w-3 h-3 ml-1" />
              التجاوزات
            </TabsTrigger>
          </TabsList>

          {/* Diagnostic Tab */}
          <TabsContent value="diagnostic" className="space-y-4 mt-4">
            {/* Page Selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="font-arabic">الصفحة:</Label>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={page}
                  onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
              </div>
              <Button
                onClick={() => onNavigateToPage?.(page)}
                variant="outline"
                size="sm"
                className="font-arabic"
              >
                <Eye className="w-4 h-4 ml-1" />
                انتقل
              </Button>
              <Button
                onClick={runDiagnostic}
                disabled={isRunningDiagnostic}
                className="font-arabic"
              >
                <Play className="w-4 h-4 ml-2" />
                تشغيل التشخيص
              </Button>
            </div>

            {/* Diagnostic Results */}
            {diagnosticWords.length > 0 && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <div className="text-2xl font-bold text-primary">
                      {diagnosticWords.length}
                    </div>
                    <div className="text-xs font-arabic text-muted-foreground">كلمات DOM</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <div className="text-2xl font-bold text-amber-600">{lineGroups.length}</div>
                    <div className="text-xs font-arabic text-muted-foreground">أسطر</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {diagnosticWords.filter((w) => w.status === 'match').length}
                    </div>
                    <div className="text-xs font-arabic text-muted-foreground">مطابق</div>
                  </div>
                </div>

                {/* Line Groups View */}
                <div className="space-y-2">
                  <Label className="font-arabic font-bold">الأسطر والكلمات:</Label>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    {lineGroups.map((group) => (
                      <div key={group.lineIdx} className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-arabic">
                            سطر {group.lineIdx + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({group.words.length} كلمة)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.words.map((word, idx) => (
                            <button
                              key={word.key}
                              onClick={() => {
                                const globalIdx = diagnosticWords.findIndex(w => w.key === word.key);
                                setCurrentDiagIndex(globalIdx);
                                highlightWord(globalIdx);
                              }}
                              className={`px-2 py-1 rounded text-sm font-arabic transition-colors ${
                                currentDiagIndex === diagnosticWords.findIndex(w => w.key === word.key)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted hover:bg-muted/80'
                              }`}
                            >
                              {idx + 1}. {word.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                {/* Current Word Preview */}
                {currentWord && (
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-arabic text-muted-foreground">
                        الكلمة {currentDiagIndex + 1} / {diagnosticWords.length}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        سطر {currentWord.lineGroup + 1}
                      </span>
                    </div>
                    <div className="text-2xl font-arabic font-bold text-center py-2">
                      {currentWord.text}
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={prevDiagWord}
                        disabled={currentDiagIndex === 0}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={nextDiagWord}
                        disabled={currentDiagIndex >= diagnosticWords.length - 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {diagnosticWords.length === 0 && !isRunningDiagnostic && (
              <div className="text-center py-8 text-muted-foreground font-arabic border rounded-lg">
                <ArrowDownUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>اضغط "تشغيل التشخيص" لتحليل الصفحة الحالية</p>
                <p className="text-xs mt-1">سيتم جمع الكلمات وتحليل مواقعها في الأسطر</p>
              </div>
            )}
          </TabsContent>

          {/* Fix Tab */}
          <TabsContent value="fix" className="space-y-4 mt-4">
            {/* Scope Selection */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">نطاق الإصلاح:</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as typeof scope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole_page">الصفحة كاملة ({diagnosticWords.length} كلمة)</SelectItem>
                  <SelectItem value="line_range">نطاق أسطر محدد</SelectItem>
                  <SelectItem value="custom_selection">تحديد مخصص</SelectItem>
                </SelectContent>
              </Select>

              {scope === 'line_range' && lineGroups.length > 0 && (
                <div className="flex gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <Label className="font-arabic text-xs">من سطر</Label>
                    <Select
                      value={String(lineStart)}
                      onValueChange={(v) => setLineStart(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {lineGroups.map((g) => (
                          <SelectItem key={g.lineIdx} value={String(g.lineIdx + 1)}>
                            سطر {g.lineIdx + 1} ({g.words.length} كلمة)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="font-arabic text-xs">إلى سطر</Label>
                    <Select
                      value={String(lineEnd)}
                      onValueChange={(v) => setLineEnd(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {lineGroups.filter(g => g.lineIdx + 1 >= lineStart).map((g) => (
                          <SelectItem key={g.lineIdx} value={String(g.lineIdx + 1)}>
                            سطر {g.lineIdx + 1} ({g.words.length} كلمة)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Fix Tools */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">أدوات الإصلاح:</Label>
              
              {/* Rebuild Indices */}
              <div className="p-4 rounded-lg border bg-card space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  <h4 className="font-arabic font-semibold">إعادة بناء الفهارس</h4>
                </div>
                <p className="text-xs font-arabic text-muted-foreground">
                  إعادة ترقيم الكلمات بالتسلسل الصحيح حسب موقعها في DOM
                </p>
                <Button 
                  onClick={applyRebuildIndices} 
                  variant="outline" 
                  className="w-full font-arabic"
                  disabled={diagnosticWords.length === 0}
                >
                  تطبيق
                </Button>
              </div>

              {/* Offset Shift */}
              <div className="p-4 rounded-lg border bg-card space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-primary" />
                  <h4 className="font-arabic font-semibold">إزاحة المعاني</h4>
                </div>
                <p className="text-xs font-arabic text-muted-foreground">
                  إزاحة ربط المعاني بمقدار +1 أو -1 لتصحيح التأخر أو التقدم
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetAmount(o => o - 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                    -1
                  </Button>
                  <Input
                    type="number"
                    value={offsetAmount}
                    onChange={(e) => setOffsetAmount(parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                    placeholder="0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetAmount(o => o + 1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                    +1
                  </Button>
                  <Button 
                    onClick={applyOffsetShift} 
                    variant="default" 
                    className="flex-1 font-arabic"
                    disabled={offsetAmount === 0}
                  >
                    تطبيق الإزاحة
                  </Button>
                </div>
              </div>

              {/* Lock Order */}
              <div className="p-4 rounded-lg border bg-card space-y-2">
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4 text-primary" />
                  <h4 className="font-arabic font-semibold">تثبيت الترتيب</h4>
                </div>
                <p className="text-xs font-arabic text-muted-foreground">
                  حفظ الترتيب الحالي ليتبعه التشغيل التلقائي دائماً
                </p>
                <Button
                  onClick={lockCurrentOrder}
                  variant="outline"
                  className="w-full font-arabic"
                  disabled={diagnosticWords.length === 0}
                >
                  <Save className="w-4 h-4 ml-2" />
                  تثبيت ترتيب {getSelectedWords().length} كلمة
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {existingOverride ? (
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-arabic font-semibold">تجاوز الصفحة {page}</h4>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {existingOverride.operation === 'rebuild_indices'
                      ? 'إعادة بناء'
                      : existingOverride.operation === 'offset_shift'
                      ? `إزاحة ${existingOverride.offsetAmount}`
                      : existingOverride.operation === 'locked_order'
                      ? 'ترتيب مثبت'
                      : existingOverride.operation}
                  </span>
                </div>
                <div className="text-sm font-arabic text-muted-foreground">
                  النطاق: {existingOverride.scope === 'whole_page' ? 'الصفحة كاملة' : 
                    existingOverride.scope === 'line_range' ? `الأسطر ${existingOverride.lineStart} - ${existingOverride.lineEnd}` :
                    'تحديد مخصص'}
                </div>
                {existingOverride.orderedKeys && (
                  <div className="text-xs font-arabic text-muted-foreground">
                    عدد الكلمات المثبتة: {existingOverride.orderedKeys.length}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  تاريخ الإنشاء: {new Date(existingOverride.createdAt).toLocaleDateString('ar-EG')}
                </div>
                <Button
                  onClick={clearOverride}
                  variant="destructive"
                  size="sm"
                  className="w-full font-arabic"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف التجاوز
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-arabic border rounded-lg">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>لا يوجد تجاوز ترتيب لهذه الصفحة</p>
                <p className="text-xs mt-1">استخدم أدوات الإصلاح لإنشاء تجاوز</p>
              </div>
            )}

            {/* All Page Overrides */}
            {pageOrderOverrides.length > 0 && (
              <div className="space-y-2">
                <Label className="font-arabic font-bold">جميع تجاوزات الترتيب:</Label>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-arabic text-right">الصفحة</TableHead>
                        <TableHead className="font-arabic text-right">العملية</TableHead>
                        <TableHead className="font-arabic text-right">النطاق</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageOrderOverrides.map((override) => (
                        <TableRow key={`${override.pageNumber}-${override.scope}`}>
                          <TableCell className="font-bold">{override.pageNumber}</TableCell>
                          <TableCell className="font-arabic text-sm">
                            {override.operation === 'rebuild_indices' ? 'إعادة بناء' :
                             override.operation === 'offset_shift' ? `إزاحة ${override.offsetAmount}` :
                             override.operation === 'locked_order' ? 'ترتيب مثبت' : override.operation}
                          </TableCell>
                          <TableCell className="font-arabic text-sm">
                            {override.scope === 'whole_page' ? 'كاملة' : 
                             override.scope === 'line_range' ? `${override.lineStart}-${override.lineEnd}` : 'مخصص'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deletePageOrderOverride(override.pageNumber)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
