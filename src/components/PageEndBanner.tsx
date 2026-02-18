import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RotateCcw, Eye, Square } from 'lucide-react';

interface PageEndBannerProps {
  visible: boolean;
  onRepeat: () => void;
  onNextPage: () => void;
  onRevealAll: () => void;
  onStop: () => void;
  isLastPage?: boolean;
}

export function PageEndBanner({
  visible,
  onRepeat,
  onNextPage,
  onRevealAll,
  onStop,
  isLastPage = false,
}: PageEndBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="page-end-banner"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50"
          dir="rtl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Backdrop blur overlay at bottom */}
          <div className="bg-background/95 backdrop-blur-md border-t border-border shadow-2xl">
            <div className="max-w-2xl mx-auto px-4 py-4">
              {/* Label */}
              <div className="text-center mb-3">
                <span className="text-xs font-arabic text-muted-foreground">
                  {isLastPage ? 'انتهت الصفحات في هذا النطاق' : 'انتهت الكلمات في هذه الصفحة'}
                </span>
              </div>

              {/* Buttons row */}
              <div className="flex items-center justify-center gap-2">
                {/* إيقاف */}
                <button
                  onClick={onStop}
                  className="nav-button flex items-center gap-1.5 px-3 h-10 rounded-lg font-arabic text-sm"
                >
                  <Square className="w-4 h-4" />
                  إيقاف
                </button>

                {/* كشف الكل */}
                <button
                  onClick={onRevealAll}
                  className="nav-button flex items-center gap-1.5 px-3 h-10 rounded-lg font-arabic text-sm"
                >
                  <Eye className="w-4 h-4" />
                  كشف الكل
                </button>

                {/* الصفحة التالية */}
                {!isLastPage && (
                  <button
                    onClick={onNextPage}
                    className="control-button flex items-center gap-1.5 px-4 h-10 rounded-lg font-arabic text-sm font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    الصفحة التالية
                  </button>
                )}

                {/* إعادة */}
                <button
                  onClick={onRepeat}
                  className="nav-button flex items-center gap-1.5 px-3 h-10 rounded-lg font-arabic text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
