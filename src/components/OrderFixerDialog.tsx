import React, { useState, useEffect, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataStore, PageOrderOverride } from '@/stores/dataStore';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
  status: 'match' | 'off-by-one' | 'wrong' | 'missing';
  expectedMeaning?: string;
  actualMeaning?: string;
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
  const [currentDiagIndex, setCurrentDiagIndex] = useState(0);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const {
    pageOrderOverrides,
    addPageOrderOverride,
    getPageOrderOverride,
    deletePageOrderOverride,
  } = useDataStore();

  // Get existing override for current page
  const existingOverride = useMemo(() => getPageOrderOverride(page), [page, pageOrderOverrides, getPageOrderOverride]);

  // Run diagnostic on page
  const runDiagnostic = () => {
    setIsRunningDiagnostic(true);
    
    // Collect DOM words from the page
    setTimeout(() => {
      const wordElements = document.querySelectorAll('[data-ghareeb-index]');
      const words: DiagnosticWord[] = [];
      
      // Group by line (using offsetTop)
      const lineGroups = new Map<number, typeof wordElements[0][]>();
      
      wordElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const lineTop = Math.round(rect.top / 30) * 30; // Group by ~30px
        
        if (!lineGroups.has(lineTop)) {
          lineGroups.set(lineTop, []);
        }
        lineGroups.get(lineTop)?.push(el);
      });
      
      // Convert to array sorted by line
      const sortedLines = Array.from(lineGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([, els]) => els);
      
      let lineGroupIdx = 0;
      sortedLines.forEach((lineEls) => {
        lineEls.forEach((el, idx) => {
          const index = parseInt(el.getAttribute('data-ghareeb-index') || '0');
          const key = el.getAttribute('data-ghareeb-key') || '';
          const text = el.textContent || '';
          
          // Determine status (simplified - would need actual playlist comparison)
          const status: DiagnosticWord['status'] = 'match'; // Default to match
          
          words.push({
            index,
            text,
            key,
            lineGroup: lineGroupIdx,
            status,
          });
        });
        lineGroupIdx++;
      });
      
      setDiagnosticWords(words);
      setCurrentDiagIndex(0);
      setIsRunningDiagnostic(false);
      
      if (words.length === 0) {
        toast.error('لا توجد كلمات غريبة في هذه الصفحة');
      } else {
        toast.success(`تم تحليل ${words.length} كلمة في ${lineGroupIdx} سطر`);
      }
    }, 100);
  };

  // Navigate diagnostic
  const nextDiagWord = () => {
    if (currentDiagIndex < diagnosticWords.length - 1) {
      setCurrentDiagIndex((i) => i + 1);
      highlightWord(diagnosticWords[currentDiagIndex + 1].index);
    }
  };

  const prevDiagWord = () => {
    if (currentDiagIndex > 0) {
      setCurrentDiagIndex((i) => i - 1);
      highlightWord(diagnosticWords[currentDiagIndex - 1].index);
    }
  };

  const highlightWord = (index: number) => {
    const el = document.querySelector(`[data-ghareeb-index="${index}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Apply fixes
  const applyRebuildIndices = () => {
    addPageOrderOverride({
      pageNumber: page,
      scope,
      lineStart: scope === 'line_range' ? lineStart : undefined,
      lineEnd: scope === 'line_range' ? lineEnd : undefined,
      operation: 'rebuild_indices',
    });
    toast.success('تم إعادة بناء الفهارس');
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
    const orderedKeys = diagnosticWords.map((w) => w.key);
    
    addPageOrderOverride({
      pageNumber: page,
      scope: 'whole_page',
      operation: 'locked_order',
      orderedKeys,
    });
    toast.success('تم تثبيت الترتيب الحالي');
  };

  const clearOverride = () => {
    deletePageOrderOverride(page);
    toast.success('تم حذف تجاوز الترتيب');
  };

  // Line count estimate
  const lineCount = useMemo(() => {
    const groups = new Set(diagnosticWords.map((w) => w.lineGroup));
    return groups.size || 3;
  }, [diagnosticWords]);

  const currentWord = diagnosticWords[currentDiagIndex];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <ArrowDownUp className="w-5 h-5" />
            مصحح الترتيب
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
            <div className="flex items-center gap-3">
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
                  <div className="page-frame p-3 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {diagnosticWords.length}
                    </div>
                    <div className="text-xs font-arabic text-muted-foreground">كلمات DOM</div>
                  </div>
                  <div className="page-frame p-3 text-center">
                    <div className="text-2xl font-bold text-accent">{lineCount}</div>
                    <div className="text-xs font-arabic text-muted-foreground">أسطر</div>
                  </div>
                  <div className="page-frame p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {diagnosticWords.filter((w) => w.status === 'match').length}
                    </div>
                    <div className="text-xs font-arabic text-muted-foreground">مطابق</div>
                  </div>
                </div>

                {/* Current Word Preview */}
                {currentWord && (
                  <div className="page-frame p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-arabic text-muted-foreground">
                        الكلمة {currentDiagIndex + 1} / {diagnosticWords.length}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          currentWord.status === 'match'
                            ? 'bg-green-100 text-green-700'
                            : currentWord.status === 'off-by-one'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {currentWord.status === 'match' && <Check className="w-3 h-3 inline ml-1" />}
                        {currentWord.status === 'off-by-one' && (
                          <AlertCircle className="w-3 h-3 inline ml-1" />
                        )}
                        {currentWord.status === 'match'
                          ? 'مطابق'
                          : currentWord.status === 'off-by-one'
                          ? 'إزاحة ±1'
                          : 'خاطئ'}
                      </span>
                    </div>
                    <div className="text-2xl font-arabic font-bold text-center py-2">
                      {currentWord.text}
                    </div>
                    <div className="text-xs font-arabic text-muted-foreground text-center">
                      سطر {currentWord.lineGroup + 1} | فهرس {currentWord.index}
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
              <div className="text-center py-8 text-muted-foreground font-arabic">
                اضغط "تشغيل التشخيص" لتحليل الصفحة الحالية
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
                  <SelectItem value="whole_page">الصفحة كاملة</SelectItem>
                  <SelectItem value="line_range">نطاق أسطر</SelectItem>
                  <SelectItem value="custom_selection">تحديد مخصص</SelectItem>
                </SelectContent>
              </Select>

              {scope === 'line_range' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="font-arabic text-xs">من سطر</Label>
                    <Input
                      type="number"
                      min={1}
                      max={lineCount}
                      value={lineStart}
                      onChange={(e) => setLineStart(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="font-arabic text-xs">إلى سطر</Label>
                    <Input
                      type="number"
                      min={lineStart}
                      max={lineCount}
                      value={lineEnd}
                      onChange={(e) => setLineEnd(parseInt(e.target.value) || lineStart)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fix Tools */}
            <div className="space-y-3">
              <Label className="font-arabic font-bold">أدوات الإصلاح:</Label>
              
              {/* Rebuild Indices */}
              <div className="page-frame p-4 space-y-2">
                <h4 className="font-arabic font-semibold">إعادة بناء الفهارس</h4>
                <p className="text-xs font-arabic text-muted-foreground">
                  إعادة ترقيم الكلمات بالتسلسل الصحيح
                </p>
                <Button onClick={applyRebuildIndices} variant="outline" className="w-full font-arabic">
                  تطبيق
                </Button>
              </div>

              {/* Offset Shift */}
              <div className="page-frame p-4 space-y-2">
                <h4 className="font-arabic font-semibold">إزاحة المعاني</h4>
                <p className="text-xs font-arabic text-muted-foreground">
                  إزاحة ربط المعاني بمقدار +1 أو -1
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={offsetAmount}
                    onChange={(e) => setOffsetAmount(parseInt(e.target.value) || 0)}
                    className="w-20"
                    placeholder="0"
                  />
                  <Button onClick={applyOffsetShift} variant="outline" className="flex-1 font-arabic">
                    تطبيق الإزاحة
                  </Button>
                </div>
              </div>

              {/* Lock Order */}
              <div className="page-frame p-4 space-y-2">
                <h4 className="font-arabic font-semibold">تثبيت الترتيب</h4>
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
                  تثبيت الترتيب الحالي
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4 mt-4">
            {existingOverride ? (
              <div className="page-frame p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-arabic font-semibold">تجاوز الصفحة {page}</h4>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                    {existingOverride.operation === 'rebuild_indices'
                      ? 'إعادة بناء'
                      : existingOverride.operation === 'offset_shift'
                      ? `إزاحة ${existingOverride.offsetAmount}`
                      : existingOverride.operation === 'locked_order'
                      ? 'ترتيب مثبت'
                      : 'إعادة ترتيب'}
                  </span>
                </div>
                <div className="text-xs font-arabic text-muted-foreground">
                  النطاق:{' '}
                  {existingOverride.scope === 'whole_page'
                    ? 'الصفحة كاملة'
                    : existingOverride.scope === 'line_range'
                    ? `أسطر ${existingOverride.lineStart}-${existingOverride.lineEnd}`
                    : 'تحديد مخصص'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(existingOverride.createdAt).toLocaleString('ar-EG')}
                </div>
                <Button
                  onClick={clearOverride}
                  variant="destructive"
                  size="sm"
                  className="font-arabic"
                >
                  <RotateCcw className="w-3 h-3 ml-2" />
                  حذف التجاوز
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-arabic">
                لا يوجد تجاوز ترتيب لهذه الصفحة
              </div>
            )}

            {/* All overrides list */}
            {pageOrderOverrides.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-arabic font-semibold">جميع التجاوزات</h4>
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {pageOrderOverrides.map((override, idx) => (
                    <div
                      key={idx}
                      className="page-frame p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                      onClick={() => setPage(override.pageNumber)}
                    >
                      <span className="font-arabic">صفحة {override.pageNumber}</span>
                      <span className="text-xs text-muted-foreground">{override.operation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
