import React, { useEffect, useState } from 'react';
import { getMadinahPage, getMadinahParseResult, MadinahPage, normalizeBismillah } from '@/services/madinahPageLines';

interface MadinahPageViewProps {
  pageNumber: number;
  hidePageBadge?: boolean;
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

export function MadinahPageView({ pageNumber, hidePageBadge }: MadinahPageViewProps) {
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
      {/* Page header - surah name + page number */}
      {!hidePageBadge && (
        <div className="w-full flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid hsl(var(--ornament) / 0.15)' }}>
          <span className="text-[10px] text-muted-foreground font-arabic">
            صفحة {pageNumber}
          </span>
          {pageData.meta?.surah && (
            <span className="text-[10px] text-muted-foreground font-arabic">
              {pageData.meta.surah}
            </span>
          )}
        </div>
      )}

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

      {/* Font warning - minimal */}
      {fontLoaded === false && (
        <div className="w-full px-2 py-1 text-center">
          <p className="text-[9px] text-muted-foreground">⚠️ خط المصحف غير محمّل</p>
        </div>
      )}
    </div>
  );
}
