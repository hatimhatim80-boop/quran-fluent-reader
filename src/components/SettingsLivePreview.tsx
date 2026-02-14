import React, { useMemo } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { redistributeLines, shouldRedistribute } from '@/utils/lineRedistributor';
import { Eye, EyeOff } from 'lucide-react';

// Sample Quran text (Al-Fatiha - first 7 lines from mushaf)
const SAMPLE_TEXT = `سُورَةُ ٱلفَاتِحَةِ
بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ ١
ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَـٰلَمِينَ ٢
ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ ٣ مَـٰلِكِ يَوۡمِ ٱلدِّينِ ٤
إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ ٥ ٱهۡدِنَا
ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ ٦ صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ
عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ
وَلَا ٱلضَّآلِّينَ ٧`;

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

interface SettingsLivePreviewProps {
  visible: boolean;
  onToggle: () => void;
}

export function SettingsLivePreview({ visible, onToggle }: SettingsLivePreviewProps) {
  const { settings } = useSettingsStore();
  const { fonts, display, colors } = settings;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const targetLines = isMobile ? (display?.mobileLinesPerPage || 15) : (display?.desktopLinesPerPage || 15);
  const minWords = display?.minWordsPerLine || 5;
  const textAlign = display?.textAlign || 'justify';
  const isLines15 = display?.mode === 'lines15';
  const pageBackgroundColor = (colors as any).pageBackgroundColor || '';

  const previewLines = useMemo(() => {
    const originalLines = SAMPLE_TEXT.split('\n');
    if (!isLines15 || !shouldRedistribute(display?.mobileLinesPerPage || 15, display?.desktopLinesPerPage || 15)) {
      return originalLines;
    }
    return redistributeLines(originalLines, targetLines, minWords);
  }, [isLines15, targetLines, minWords, display?.mobileLinesPerPage, display?.desktopLinesPerPage]);

  const renderedLines = useMemo(() => {
    return previewLines.map((line, idx) => {
      if (isSurahHeader(line)) {
        return (
          <div key={idx} className="text-center py-1 border-b border-primary/20 mb-1">
            <span className="text-primary font-bold font-arabic" style={{ fontSize: '0.7em' }}>{line}</span>
          </div>
        );
      }
      if (isBismillah(line)) {
        return (
          <div key={idx} className="text-center font-arabic" style={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>
            {line}
          </div>
        );
      }

      // Check for verse numbers and highlight one word as example
      const tokens = line.split(/(\s+)/);
      const elements = tokens.map((t, ti) => {
        const isSpace = /^\s+$/.test(t);
        if (isSpace) return <span key={ti}>{t}</span>;
        const clean = t.replace(/[﴿﴾()[\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '').trim();
        const isVN = /^[٠-٩0-9۰-۹]+$/.test(clean);
        if (isVN) {
          return <span key={ti} className="verse-number">{t}</span>;
        }
        // Highlight "ٱلرَّحۡمَـٰنِ" as example
        if (t === 'ٱلرَّحۡمَـٰنِ' && idx === 1) {
          const highlightStyle = (colors as any).highlightStyle === 'text-only'
            ? { color: `hsl(${colors.highlightColor})`, fontWeight: 700 }
            : { backgroundColor: `hsl(${colors.highlightColor} / 0.5)`, borderRadius: '2px' };
          return <span key={ti} style={highlightStyle}>{t}</span>;
        }
        return <span key={ti}>{t}</span>;
      });

      if (isLines15) {
        return (
          <div
            key={idx}
            className="quran-line"
            style={{
              textAlign: textAlign as any,
              textAlignLast: textAlign === 'justify' ? 'justify' : undefined,
            }}
          >
            {elements}
          </div>
        );
      }
      return <span key={idx}>{elements}{' '}</span>;
    });
  }, [previewLines, isLines15, textAlign, colors]);

  return (
    <div className="border-t pt-3 mt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-arabic text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span className="font-bold">{visible ? 'إخفاء المعاينة' : 'معاينة مباشرة'}</span>
      </button>

      {visible && (
        <div
          className="mt-3 rounded-lg border overflow-hidden"
          style={{
            background: pageBackgroundColor ? `hsl(${pageBackgroundColor})` : undefined,
          }}
        >
          <div
            className="p-3 sm:p-4 font-arabic"
            dir="rtl"
            style={{
              fontFamily: 'var(--quran-font-family)',
              fontSize: `${fonts.quranFontSize * 0.65}rem`,
              lineHeight: fonts.lineHeight,
              fontWeight: fonts.fontWeight,
            }}
          >
            <div className={isLines15 ? 'quran-lines-container' : 'inline'}>
              {renderedLines}
            </div>
          </div>
          <div className="bg-muted/50 px-3 py-1.5 text-center">
            <span className="text-[10px] font-arabic text-muted-foreground">
              معاينة · {previewLines.filter(l => !isSurahHeader(l)).length} أسطر · {minWords} كلمات/سطر كحد أدنى
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
