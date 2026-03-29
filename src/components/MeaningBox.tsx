import React from "react";
import { X, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHighlightOverrideStore } from "@/stores/highlightOverrideStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface MeaningBoxProps {
  positionKey: string | null;
  identityKey?: string;
  defaultMeaning?: string;
  wordText?: string;
  surahName?: string;
  verseNumber?: number;
  onClose: () => void;
}

export function MeaningBox({ positionKey, identityKey, defaultMeaning, wordText, surahName, verseNumber, onClose }: MeaningBoxProps) {
  const getEffectiveMeaning = useHighlightOverrideStore((s) => s.getEffectiveMeaning);
  const { settings } = useSettingsStore();
  const colors = settings.colors;
  const popover = settings.popover || { width: 200, padding: 12, borderRadius: 12, shadow: 'medium', opacity: 100 };
  const mb = settings.meaningBox || { wordFontSize: 1.4, meaningFontSize: 1.1 };
  const wordColor = colors.popoverWordColor || colors.popoverText || '25 30% 18%';
  const meaningColor = colors.popoverMeaningColor || colors.popoverText || '25 20% 35%';

  const meaningInfo = positionKey
    ? getEffectiveMeaning(positionKey, identityKey || "", defaultMeaning || "")
    : null;

  const hasMeaning = meaningInfo && meaningInfo.hasMeaning;

  return (
    <AnimatePresence>
      {hasMeaning && wordText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="meaning-panel"
          dir="rtl"
          style={{
            background: `hsl(${colors.popoverBackground})`,
            borderColor: `hsl(${colors.popoverBorder})`,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: `${popover.borderRadius}px`,
            padding: `${popover.padding}px`,
            opacity: (popover.opacity ?? 100) / 100,
            boxShadow: popover.shadow === 'none' ? 'none'
              : popover.shadow === 'soft' ? '0 2px 8px hsl(var(--foreground) / 0.08)'
              : popover.shadow === 'strong' ? '0 8px 30px hsl(var(--foreground) / 0.18)'
              : '0 4px 16px hsl(var(--foreground) / 0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-arabic">معنى الكلمة</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Word and Location */}
          <div className="mb-4">
            <h3 className="font-bold font-arabic" style={{ color: `hsl(${wordColor})`, fontSize: `${mb.wordFontSize}rem` }}>{wordText}</h3>
            {surahName && verseNumber && (
              <div className="inline-flex items-center gap-1.5 bg-primary/8 text-primary px-2.5 py-1 rounded-full text-xs font-arabic mt-2">
                <span>{surahName}</span>
                <span className="opacity-50">•</span>
                <span>آية {verseNumber}</span>
              </div>
            )}
          </div>

          {/* Meaning */}
          <div className="rounded-xl p-4 border border-border/50" style={{ background: `hsl(${colors.popoverBackground})` }}>
            <p className="font-arabic leading-relaxed" style={{ color: `hsl(${meaningColor})`, fontSize: `${mb.meaningFontSize}rem` }}>{meaningInfo.meaning}</p>
          </div>
        </motion.div>
      )}

      {/* في حال لم يوجد معنى */}
      {!hasMeaning && positionKey && (
        <motion.div className="p-5 text-red-600 font-bold text-center">
          ⚠️ لا يوجد معنى للكلمة ذات المفتاح: {positionKey}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
