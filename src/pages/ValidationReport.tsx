import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { loadGhareebData } from '@/utils/ghareebLoader';
import { parseMushafText } from '@/utils/quranParser';
import { validateMatching, exportReportAsJSON, exportReportAsCSV, MatchingReport, MismatchEntry, MismatchReason } from '@/utils/matchingValidator';
import { GhareebWord } from '@/types/quran';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REASON_LABELS: Record<MismatchReason, string> = {
  not_found_in_page: 'غير موجودة',
  diacritic_mismatch: 'اختلاف تشكيل',
  page_number_off: 'صفحة مختلفة',
  duplicate_match: 'مكررة',
  partial_match: 'تطابق جزئي',
  unknown: 'غير معروف',
};

export default function ValidationReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<MismatchReason | 'all'>('all');

  useEffect(() => {
    async function runValidation() {
      try {
        setLoading(true);
        
        // تحميل البيانات
        const [ghareebMap, mushafResponse] = await Promise.all([
          loadGhareebData(),
          fetch('/data/mushaf.txt').then((r) => r.text()),
        ]);
        
        const pages = parseMushafText(mushafResponse);
        
        // تشغيل التحقق
        const result = validateMatching(ghareebMap, pages);
        setReport(result);
      } catch (err) {
        console.error('Validation error:', err);
        setError('حدث خطأ أثناء التحقق من البيانات');
      } finally {
        setLoading(false);
      }
    }
    
    runValidation();
  }, []);

  const filteredMismatches = useMemo(() => {
    if (!report) return [];
    if (filterReason === 'all') return report.mismatches;
    return report.mismatches.filter((m) => m.reason === filterReason);
  }, [report, filterReason]);

  const handleExportJSON = () => {
    if (!report) return;
    const json = exportReportAsJSON(report);
    downloadFile(json, 'matching-report.json', 'application/json');
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csv = exportReportAsCSV(report);
    downloadFile(csv, 'matching-report.csv', 'text/csv;charset=utf-8');
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

  const goToPage = (pageNumber: number) => {
    // حفظ رقم الصفحة في localStorage ثم الانتقال
    localStorage.setItem('quran_current_page', pageNumber.toString());
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="font-arabic text-muted-foreground">جاري التحقق من جميع الكلمات...</p>
          <p className="font-arabic text-sm text-muted-foreground/70">قد يستغرق هذا بضع ثوانٍ</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="page-frame p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="font-arabic text-destructive">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            العودة للقراءة
          </Button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const reasonCounts = report.mismatches.reduce((acc, m) => {
    acc[m.reason] = (acc[m.reason] || 0) + 1;
    return acc;
  }, {} as Record<MismatchReason, number>);

  return (
    <div className="min-h-screen bg-background py-6 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-arabic">العودة للقراءة</span>
          </button>
          <h1 className="text-xl font-bold font-arabic">تقرير التحقق من المطابقة</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-primary">{report.totalGhareebWords.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">إجمالي الكلمات</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-accent">{report.matchedCount.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">مطابقة</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{report.unmatchedCount.toLocaleString('ar-EG')}</div>
            <div className="text-sm font-arabic text-muted-foreground">غير مطابقة</div>
          </div>
          <div className="page-frame p-4 text-center">
            <div className="text-2xl font-bold text-primary">{report.coveragePercent}%</div>
            <div className="text-sm font-arabic text-muted-foreground">نسبة التغطية</div>
          </div>
        </div>

        {/* Reason Breakdown */}
        {Object.keys(reasonCounts).length > 0 && (
          <div className="page-frame p-4">
            <h2 className="font-arabic font-bold mb-3">أسباب عدم المطابقة</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(reasonCounts).map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-3 py-1 rounded-full bg-muted text-sm font-arabic"
                >
                  {REASON_LABELS[reason as MismatchReason]}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Export Buttons */}
        <div className="flex gap-3">
          <Button onClick={handleExportJSON} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير JSON</span>
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="font-arabic">تصدير CSV</span>
          </Button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="font-arabic text-sm">تصفية حسب السبب:</span>
          <Select value={filterReason} onValueChange={(v) => setFilterReason(v as MismatchReason | 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({report.mismatches.length})</SelectItem>
              {Object.entries(reasonCounts).map(([reason, count]) => (
                <SelectItem key={reason} value={reason}>
                  {REASON_LABELS[reason as MismatchReason]} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mismatches List */}
        {filteredMismatches.length === 0 ? (
          <div className="page-frame p-8 text-center">
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <p className="font-arabic text-lg">جميع الكلمات مطابقة!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-arabic font-bold">
              قائمة غير المطابق ({filteredMismatches.length})
            </h2>
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {filteredMismatches.slice(0, 200).map((m, idx) => (
                <div
                  key={`${m.word.uniqueKey}-${idx}`}
                  className="page-frame p-3 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-arabic text-lg font-bold">{m.word.wordText}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">
                        {REASON_LABELS[m.reason]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-arabic mt-1">
                      {m.word.surahName} - آية {m.word.verseNumber} - ص{m.word.pageNumber}
                    </div>
                    <div className="text-xs text-muted-foreground/80 font-arabic mt-1">
                      {m.detail}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => goToPage(m.word.pageNumber)}
                    className="shrink-0"
                  >
                    انتقل
                  </Button>
                </div>
              ))}
              {filteredMismatches.length > 200 && (
                <p className="text-center text-sm text-muted-foreground font-arabic py-4">
                  يُعرض أول 200 نتيجة. صدّر الملف للحصول على القائمة الكاملة.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground/60 font-arabic">
          تم التحقق في: {new Date(report.generatedAt).toLocaleString('ar-EG')}
        </div>
      </div>
    </div>
  );
}
