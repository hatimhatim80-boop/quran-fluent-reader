import React, { useEffect, useState } from 'react';
import { getMadinahPage, getMadinahParseResult, MadinahPage, normalizeBismillah } from '@/services/madinahPageLines';

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

/** Check if the primary mushaf font loaded */
function useFontCheck() {
  const [fontLoaded, setFontLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    const checkFont = async () => {
      try {
        const loaded = await document.fonts.ready;
        const hasFontA = loaded.check('16px "KFGQPC HAFS Uthmanic Script"');
        const hasFontB = loaded.check('16px "UthmanicHafs"');
        const hasFontC = loaded.check('16px "Amiri"');
        setFontLoaded(hasFontA || hasFontB || hasFontC);
        if (!hasFontA && !hasFontB && !hasFontC) {
          console.warn('[MadinahPageView] ⚠️ No mushaf font detected — text may render incorrectly');
        }
      } catch {
        setFontLoaded(null);
      }
    };
    checkFont();
  }, []);

  return fontLoaded;
}

export function MadinahPageView({ pageNumber }: MadinahPageViewProps) {
  const [pageData, setPageData] = useState<MadinahPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const fontLoaded = useFontCheck();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getMadinahPage(pageNumber),
      getMadinahParseResult(),
    ]).then(([data, parseResult]) => {
      if (cancelled) return;
      setGlobalErrors(parseResult.errors);
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
          {globalErrors.length > 0 && (
            <div className="mt-3 text-xs text-destructive/70 font-arabic space-y-1">
              {globalErrors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mushafPage">
      {/* Font warning */}
      {fontLoaded === false && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400/50 rounded p-2 mb-2 text-center">
          <p className="text-xs font-arabic text-yellow-800 dark:text-yellow-200">
            ⚠️ لم يتم تحميل خط المصحف — قد يظهر النص بشكل مختلف
          </p>
        </div>
      )}

      {/* Global parse warnings */}
      {globalErrors.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300/50 rounded p-2 mb-2 text-center">
          <p className="text-[10px] font-arabic text-orange-700 dark:text-orange-300">
            {globalErrors[0]}
          </p>
        </div>
      )}

      {/* Page line count warning */}
      {pageData.warnings && pageData.warnings.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300/50 rounded p-1 mb-2 text-center">
          {pageData.warnings.map((w, i) => (
            <p key={i} className="text-[10px] font-arabic text-orange-600 dark:text-orange-400">⚠️ {w}</p>
          ))}
        </div>
      )}

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
                <span>{line}</span>
              </div>
            );
          }

          if (isBismillahLine(line)) {
            return (
              <div key={idx} className="mushafLine mushafBismillah">
                <span>{normalizeBismillah(line)}</span>
              </div>
            );
          }

          return (
            <div key={idx} className="mushafLine">
              <span>{line}</span>
            </div>
          );
        })}
      </div>

      {/* Line count debug info */}
      <div className="text-center mt-1">
        <span className="text-[9px] text-muted-foreground/40 font-mono">
          {pageData.lines.length} lines
        </span>
      </div>
    </div>
  );
}
