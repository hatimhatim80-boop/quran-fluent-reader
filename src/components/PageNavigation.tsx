import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
}

export function PageNavigation({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onGoToPage,
}: PageNavigationProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onGoToPage(page);
      setInputValue('');
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap" dir="rtl">
      {/* Previous (appears on right in RTL) */}
      <button
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        className="nav-button w-10 h-10 sm:w-12 sm:h-12 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        title="الصفحة السابقة"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Page Jump */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`${currentPage}`}
          className="w-16 sm:w-20 h-10 sm:h-12 text-center rounded-lg border-2 border-border bg-card text-foreground font-arabic focus:border-primary focus:outline-none transition-colors"
        />
        <span className="text-muted-foreground font-arabic text-sm">
          / {totalPages}
        </span>
      </form>

      {/* Next (appears on left in RTL) */}
      <button
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        className="nav-button w-10 h-10 sm:w-12 sm:h-12 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        title="الصفحة التالية"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
    </div>
  );
}
