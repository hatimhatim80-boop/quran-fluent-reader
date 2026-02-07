import React, { useRef } from 'react';
import { Upload, FileText, Check } from 'lucide-react';

interface FileUploaderProps {
  onPagesUpload: (file: File) => void;
  onGhareebUpload: (file: File) => void;
  pagesLoaded: boolean;
  ghareebLoaded: boolean;
}

export function FileUploader({
  onPagesUpload,
  onGhareebUpload,
  pagesLoaded,
  ghareebLoaded,
}: FileUploaderProps) {
  const pagesInputRef = useRef<HTMLInputElement>(null);
  const ghareebInputRef = useRef<HTMLInputElement>(null);

  const handlePagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPagesUpload(file);
  };

  const handleGhareebChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGhareebUpload(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background" dir="rtl">
      <div className="page-frame p-8 max-w-xl w-full">
        <h1 className="text-3xl font-bold text-center mb-2 font-arabic text-foreground">
          تطبيق القرآن الكريم
        </h1>
        <p className="text-center text-muted-foreground mb-8 font-arabic">
          مع تفسير الكلمات الغريبة
        </p>

        <div className="space-y-4">
          {/* Pages CSV Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              pagesLoaded
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
            onClick={() => pagesInputRef.current?.click()}
          >
            <input
              ref={pagesInputRef}
              type="file"
              accept=".csv"
              onChange={handlePagesChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {pagesLoaded ? (
                <Check className="w-10 h-10 text-primary" />
              ) : (
                <FileText className="w-10 h-10 text-muted-foreground" />
              )}
              <div>
                <p className="font-arabic font-semibold text-foreground">
                  {pagesLoaded ? 'تم تحميل صفحات المصحف' : 'ملف صفحات المصحف'}
                </p>
                <p className="text-sm text-muted-foreground font-arabic">
                  quran_pages.csv
                </p>
              </div>
            </div>
          </div>

          {/* Ghareeb Words CSV Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              ghareebLoaded
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
            onClick={() => ghareebInputRef.current?.click()}
          >
            <input
              ref={ghareebInputRef}
              type="file"
              accept=".csv"
              onChange={handleGhareebChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {ghareebLoaded ? (
                <Check className="w-10 h-10 text-primary" />
              ) : (
                <Upload className="w-10 h-10 text-muted-foreground" />
              )}
              <div>
                <p className="font-arabic font-semibold text-foreground">
                  {ghareebLoaded ? 'تم تحميل الكلمات الغريبة' : 'ملف الكلمات الغريبة'}
                </p>
                <p className="text-sm text-muted-foreground font-arabic">
                  ghareeb_words_ordered.csv
                </p>
              </div>
            </div>
          </div>
        </div>

        {pagesLoaded && ghareebLoaded && (
          <p className="text-center text-primary mt-6 font-arabic animate-fade-in">
            ✓ جاهز للبدء
          </p>
        )}
      </div>
    </div>
  );
}
