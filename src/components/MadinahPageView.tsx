import React, { useEffect, useState } from 'react';
import { getMadinahPage, MadinahPage, normalizeBismillah } from '@/services/madinahPageLines';

interface MadinahPageViewProps {
  pageNumber: number;
}

const BISMILLAH_REGEX = /بِسمِ|بِسۡمِ/;

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillahLine(line: string): boolean {
  return BISMILLAH_REGEX.test(line);
}

export function MadinahPageView({ pageNumber }: MadinahPageViewProps) {
  const [pageData, setPageData] = useState<MadinahPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getMadinahPage(pageNumber).then((data) => {
      if (cancelled) return;
      if (!data) {
        setError(`لا توجد بيانات سطور لهذه الصفحة رقم ${pageNumber}`);
        setPageData(null);
      } else {
        setPageData(data);
      }
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setError(`خطأ في تحميل الصفحة ${pageNumber}: ${e?.message || e}`);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [pageNumber]);

  if (loading) {
    return (
      <div className="mushafPage text-center py-8">
        <p className="font-arabic text-muted-foreground">جاري تحميل الصفحة...</p>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="mushafPage text-center py-8">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="font-arabic text-destructive text-lg font-bold">⚠️ خطأ</p>
          <p className="font-arabic text-destructive/80 text-sm mt-2">
            {error || `لا توجد بيانات سطور لهذه الصفحة رقم ${pageNumber}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mushafPage">
      {/* Page number header */}
      <div className="text-center mb-2">
        <span className="text-xs text-muted-foreground font-arabic">
          {pageData.meta?.surah && <span className="ml-3">{pageData.meta.surah}</span>}
          صفحة {pageNumber}
        </span>
      </div>

      {/* Fixed lines */}
      <div className="mushafLinesContainer">
        {pageData.lines.map((line, idx) => {
          if (isSurahHeader(line)) {
            return (
              <div key={idx} className="mushafSurahHeader">
                <span className="font-arabic">{line}</span>
              </div>
            );
          }

          if (isBismillahLine(line)) {
            return (
              <div key={idx} className="mushafLine mushafBismillah">
                <span className="font-arabic">{normalizeBismillah(line)}</span>
              </div>
            );
          }

          return (
            <div key={idx} className="mushafLine">
              <span className="font-arabic">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
