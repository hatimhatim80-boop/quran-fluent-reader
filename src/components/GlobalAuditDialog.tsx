import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Loader2,
  FileJson,
} from 'lucide-react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';
import {
  runGlobalAudit,
  GlobalAuditResult,
  AuditIssue,
  getAuditSummary,
  exportAuditResults,
} from '@/utils/globalAudit';
import { toast } from 'sonner';

interface GlobalAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: QuranPage[];
  ghareebPageMap: Map<number, GhareebWord[]>;
  onNavigateToPage?: (pageNumber: number) => void;
}

const SEVERITY_ICONS = {
  error: <XCircle className="w-4 h-4 text-destructive" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  PLAIN_TEXT_FALLBACK: 'رجوع للنص العادي',
  ZERO_TOKENS: 'صفر tokens',
  UNMATCHED_GHAREEB: 'غريب غير مطابق',
  MISSING_MEANING: 'معنى مفقود',
  EMPTY_NORMALIZED: 'تطبيع فارغ',
  HIGHLIGHT_NO_MEANING: 'تلوين بلا معنى',
  STALE_OVERRIDE: 'تعديل قديم',
  STOPWORD_HIGHLIGHTED: 'حرف/أداة ملونة',
};

export function GlobalAuditDialog({
  open,
  onOpenChange,
  pages,
  ghareebPageMap,
  onNavigateToPage,
}: GlobalAuditDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<GlobalAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'issues' | 'pages'>('summary');
  
  const overrides = useHighlightOverrideStore((s) => s.overrides);
  
  const handleRunAudit = useCallback(async () => {
    setIsRunning(true);
    setProgress({ current: 0, total: pages.length });
    setResult(null);
    
    try {
      const auditResult = await runGlobalAudit(
        pages,
        (pageNum) => ghareebPageMap.get(pageNum) || [],
        (pageNum) => ghareebPageMap.get(pageNum) || [], // For now, use same as ghareeb
        overrides,
        (current, total) => setProgress({ current, total })
      );
      
      setResult(auditResult);
      
      const summary = getAuditSummary(auditResult);
      if (summary.criticalIssues > 0) {
        toast.warning(`تم العثور على ${summary.criticalIssues} مشكلة حرجة`, {
          description: `إجمالي المشاكل: ${auditResult.totalIssues}`,
        });
      } else if (auditResult.totalIssues > 0) {
        toast.info(`تم العثور على ${auditResult.totalIssues} ملاحظة`);
      } else {
        toast.success('لا توجد مشاكل! ✨');
      }
    } catch (error) {
      console.error('Audit failed:', error);
      toast.error('فشل تشغيل الفحص');
    } finally {
      setIsRunning(false);
    }
  }, [pages, ghareebPageMap, overrides]);
  
  const handleExport = useCallback(() => {
    if (!result) return;
    
    const json = exportAuditResults(result);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quran-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    toast.success('تم تصدير التقرير');
  }, [result]);
  
  const summary = result ? getAuditSummary(result) : null;
  
  // Flatten all issues for the issues tab
  const allIssues = result?.pageResults.flatMap(pr => pr.issues) || [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Global Audit (DEV-only)
          </DialogTitle>
          <DialogDescription>
            فحص شامل لجميع صفحات المصحف للكشف عن المشاكل
          </DialogDescription>
        </DialogHeader>
        
        {/* Controls */}
        <div className="flex items-center gap-2 py-2 border-b">
          <Button
            onClick={handleRunAudit}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'جاري الفحص...' : 'تشغيل الفحص'}
          </Button>
          
          {result && (
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              تصدير JSON
            </Button>
          )}
          
          {isRunning && (
            <div className="flex-1 flex items-center gap-2">
              <Progress value={(progress.current / progress.total) * 100} className="flex-1" />
              <span className="text-sm text-muted-foreground">
                {progress.current}/{progress.total}
              </span>
            </div>
          )}
        </div>
        
        {/* Results */}
        {result && summary && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="summary">الملخص</TabsTrigger>
              <TabsTrigger value="issues">
                المشاكل ({result.totalIssues})
              </TabsTrigger>
              <TabsTrigger value="pages">
                الصفحات ({result.pagesWithIssues.length})
              </TabsTrigger>
            </TabsList>
            
            {/* Summary Tab */}
            <TabsContent value="summary" className="flex-1 space-y-4">
              {/* Health Score */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 p-4 rounded-lg bg-muted text-center">
                  <div className={`text-4xl font-bold ${
                    summary.healthScore >= 80 ? 'text-primary' :
                    summary.healthScore >= 50 ? 'text-yellow-500' : 'text-destructive'
                  }`}>
                    {summary.healthScore}%
                  </div>
                  <div className="text-sm text-muted-foreground">Health Score</div>
                </div>
                
                <div className="p-4 rounded-lg bg-destructive/10 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {summary.criticalIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">حرجة</div>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {summary.warningIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">تحذيرات</div>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.infoIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">معلومات</div>
                </div>
              </div>
              
              {/* Top Issues */}
              {summary.topIssueTypes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">أكثر المشاكل شيوعاً:</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.topIssueTypes.map(({ type, count }) => (
                      <Badge key={type} variant="outline" className="gap-1">
                        {ISSUE_TYPE_LABELS[type] || type}
                        <span className="font-bold">{count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Issue Type Breakdown */}
              <div className="space-y-2">
                <h4 className="font-semibold">تفصيل حسب النوع:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(result.issuesByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-2 rounded bg-muted">
                      <span>{ISSUE_TYPE_LABELS[type] || type}</span>
                      <Badge variant={count > 0 ? 'default' : 'secondary'}>{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Scan Info */}
              <div className="text-xs text-muted-foreground border-t pt-2">
                <div>تم فحص: {result.scannedPages} من {result.totalPages} صفحة</div>
                <div>وقت الفحص: {new Date(result.timestamp).toLocaleString('ar-EG')}</div>
              </div>
            </TabsContent>
            
            {/* Issues Tab */}
            <TabsContent value="issues" className="flex-1 min-h-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">!</TableHead>
                      <TableHead className="w-16">صفحة</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الكلمة</TableHead>
                      <TableHead>الوصف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allIssues.slice(0, 100).map((issue, idx) => (
                      <TableRow 
                        key={idx}
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          onNavigateToPage?.(issue.pageNumber);
                          onOpenChange(false);
                        }}
                      >
                        <TableCell>{SEVERITY_ICONS[issue.severity]}</TableCell>
                        <TableCell>{issue.pageNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-arabic" dir="rtl">
                          {issue.wordText || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {issue.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {allIssues.length > 100 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    يتم عرض أول 100 مشكلة فقط. قم بتصدير JSON للقائمة الكاملة.
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            {/* Pages Tab */}
            <TabsContent value="pages" className="flex-1 min-h-0">
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-10 gap-2 p-2">
                  {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const pageResult = result.pageResults.find(pr => pr.pageNumber === pageNum);
                    const hasIssues = pageResult && pageResult.issues.length > 0;
                    const hasCritical = pageResult?.issues.some(i => i.severity === 'error');
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={hasCritical ? 'destructive' : hasIssues ? 'outline' : 'ghost'}
                        size="sm"
                        className={`h-8 text-xs ${
                          hasCritical ? '' : 
                          hasIssues ? 'border-yellow-500 text-yellow-600' : 
                          'text-muted-foreground'
                        }`}
                        onClick={() => {
                          onNavigateToPage?.(pageNum);
                          onOpenChange(false);
                        }}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Empty State */}
        {!result && !isRunning && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground">
            <FileJson className="w-12 h-12" />
            <p>اضغط "تشغيل الفحص" لبدء فحص شامل لجميع الصفحات</p>
            <p className="text-sm">سيتم فحص {pages.length} صفحة</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
