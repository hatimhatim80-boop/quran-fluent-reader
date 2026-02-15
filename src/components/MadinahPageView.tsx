import React, { useEffect, useState, useRef } from 'react';
import { getMadinahPage, getMadinahParseResult, MadinahPage, normalizeBismillah } from '@/services/madinahPageLines';
import { Loader2 } from 'lucide-react';

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

/** PNG image URL from quran.i8x.net API */
function getPngUrl(page: number): string {
  return `https://quran.i8x.net/data/quran_image/${page}.png`;
}

export function MadinahPageView({ pageNumber, hidePageBadge }: MadinahPageViewProps) {
  const [pageData, setPageData] = useState<MadinahPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);

  // Reset image state on page change
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    setShowTextFallback(false);
  }, [pageNumber]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getMadinahPage(pageNumber),
      getMadinahParseResult(),
    ]).then(([data, parseResult]) => {
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
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="font-arabic text-muted-foreground text-sm">جاري تحميل الصفحة...</p>
        </div>
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

  const pngUrl = getPngUrl(pageNumber);

  return (
    <div className="mushafPage mushafHybrid">
      {/* Page header */}
      {!hidePageBadge && (
        <div className="mushafHybridHeader">
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

      {/* Hybrid container: PNG background + text overlay */}
      <div className="mushafHybridContainer">
        {/* PNG Image Layer */}
        {!imgError && (
          <img
            src={pngUrl}
            alt={`صفحة ${pageNumber}`}
            className={`mushafPngLayer ${imgLoaded ? 'mushafPngLoaded' : ''}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setShowTextFallback(true);
            }}
            loading="eager"
            draggable={false}
          />
        )}

        {/* Loading spinner while PNG loads */}
        {!imgLoaded && !imgError && (
          <div className="mushafPngSpinner">
            <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
          </div>
        )}

        {/* Text Overlay Layer - transparent, interactive */}
        {!showTextFallback && (
          <div className={`mushafTextOverlay ${imgLoaded ? 'mushafOverlayReady' : ''}`}>
            <div className="mushafLinesContainer">
              {pageData.lines.map((line, idx) => {
                if (isSurahHeader(line)) {
                  return (
                    <div key={idx} className="mushafSurahHeader mushafOverlayLine">
                      <span>{line}</span>
                    </div>
                  );
                }
                if (isBismillahLine(line)) {
                  return (
                    <div key={idx} className="mushafLine mushafBismillah mushafOverlayLine">
                      <span>{normalizeBismillah(line)}</span>
                    </div>
                  );
                }
                const words = line.split(/\s+/).filter(Boolean);
                const isShort = words.length <= 3;
                return (
                  <div key={idx} className={`mushafLine mushafOverlayLine${isShort ? ' mushafLine--short' : ''}`}>
                    {words.map((w, wi) => (
                      <span key={wi}>{w}</span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback: show text directly if PNG fails */}
        {showTextFallback && (
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
              const words = line.split(/\s+/).filter(Boolean);
              const isShort = words.length <= 3;
              return (
                <div key={idx} className={`mushafLine${isShort ? ' mushafLine--short' : ''}`}>
                  {words.map((w, wi) => (
                    <span key={wi}>{w}</span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
