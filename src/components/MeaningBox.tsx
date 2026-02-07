import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { GhareebWord } from '@/types/quran';
import { motion, AnimatePresence } from 'framer-motion';

interface MeaningBoxProps {
  word: GhareebWord | null;
  onClose: () => void;
}

export function MeaningBox({ word, onClose }: MeaningBoxProps) {
  return (
    <AnimatePresence>
      {word && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="meaning-panel p-5 sm:p-6"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-arabic">
                معنى الكلمة
              </span>
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
            <h3 className="text-2xl font-bold font-arabic text-foreground mb-2">
              {word.wordText}
            </h3>
            <div className="inline-flex items-center gap-1.5 bg-primary/8 text-primary px-2.5 py-1 rounded-full text-xs font-arabic">
              <span>{word.surahName}</span>
              <span className="opacity-50">•</span>
              <span>آية {word.verseNumber}</span>
            </div>
          </div>

          {/* Meaning */}
          <div className="bg-card rounded-xl p-4 border border-border/50">
            <p className="font-arabic text-lg text-foreground leading-relaxed">
              {word.meaning}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
