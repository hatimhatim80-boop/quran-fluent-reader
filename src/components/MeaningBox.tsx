import React from 'react';
import { GhareebWord } from '@/types/quran';
import { X } from 'lucide-react';

interface MeaningBoxProps {
  word: GhareebWord | null;
  onClose: () => void;
}

export function MeaningBox({ word, onClose }: MeaningBoxProps) {
  if (!word) return null;

  return (
    <div className="meaning-box p-4 sm:p-6 animate-fade-in" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold font-arabic text-primary">
              {word.word_text}
            </span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-arabic">
              كلمة غريبة
            </span>
          </div>
          <p className="font-arabic text-lg text-foreground leading-relaxed">
            {word.meaning}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
