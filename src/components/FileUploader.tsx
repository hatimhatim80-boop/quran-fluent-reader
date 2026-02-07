import React, { useRef, useState } from 'react';
import { Upload, FileText, Check, Loader2 } from 'lucide-react';
import { parseQuranPagesDocx, parseGhareebWordsDocx } from '@/utils/docxParser';
import { QuranPage, GhareebWord } from '@/types/quran';

interface FileUploaderProps {
  onPagesUpload: (file: File) => void;
  onGhareebUpload: (file: File) => void;
  onPagesData?: (pages: QuranPage[]) => void;
  onGhareebData?: (words: GhareebWord[]) => void;
  pagesLoaded: boolean;
  ghareebLoaded: boolean;
}

export function FileUploader({
  onPagesUpload,
  onGhareebUpload,
  onPagesData,
  onGhareebData,
  pagesLoaded,
  ghareebLoaded,
}: FileUploaderProps) {
  const pagesInputRef = useRef<HTMLInputElement>(null);
  const ghareebInputRef = useRef<HTMLInputElement>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingGhareeb, setLoadingGhareeb] = useState(false);

  const handlePagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (isDocx && onPagesData) {
      setLoadingPages(true);
      try {
        const pages = await parseQuranPagesDocx(file);
        onPagesData(pages);
      } catch (error) {
        console.error('Error parsing Word file:', error);
      } finally {
        setLoadingPages(false);
      }
    } else {
      onPagesUpload(file);
    }
  };

  const handleGhareebChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (isDocx && onGhareebData) {
      setLoadingGhareeb(true);
      try {
        const words = await parseGhareebWordsDocx(file);
        onGhareebData(words);
      } catch (error) {
        console.error('Error parsing Word file:', error);
      } finally {
        setLoadingGhareeb(false);
      }
    } else {
      onGhareebUpload(file);
    }
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
          {/* Pages Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              pagesLoaded
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            } ${loadingPages ? 'pointer-events-none opacity-70' : ''}`}
            onClick={() => pagesInputRef.current?.click()}
          >
            <input
              ref={pagesInputRef}
              type="file"
              accept=".csv,.docx"
              onChange={handlePagesChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {loadingPages ? (
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              ) : pagesLoaded ? (
                <Check className="w-10 h-10 text-primary" />
              ) : (
                <FileText className="w-10 h-10 text-muted-foreground" />
              )}
              <div>
                <p className="font-arabic font-semibold text-foreground">
                  {loadingPages ? 'جاري التحميل...' : pagesLoaded ? 'تم تحميل صفحات المصحف' : 'ملف صفحات المصحف'}
                </p>
                <p className="text-sm text-muted-foreground font-arabic">
                  CSV أو Word (.docx)
                </p>
              </div>
            </div>
          </div>

          {/* Ghareeb Words Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              ghareebLoaded
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            } ${loadingGhareeb ? 'pointer-events-none opacity-70' : ''}`}
            onClick={() => ghareebInputRef.current?.click()}
          >
            <input
              ref={ghareebInputRef}
              type="file"
              accept=".csv,.docx"
              onChange={handleGhareebChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {loadingGhareeb ? (
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              ) : ghareebLoaded ? (
                <Check className="w-10 h-10 text-primary" />
              ) : (
                <Upload className="w-10 h-10 text-muted-foreground" />
              )}
              <div>
                <p className="font-arabic font-semibold text-foreground">
                  {loadingGhareeb ? 'جاري التحميل...' : ghareebLoaded ? 'تم تحميل الكلمات الغريبة' : 'ملف الكلمات الغريبة'}
                </p>
                <p className="text-sm text-muted-foreground font-arabic">
                  CSV أو Word (.docx)
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

        {/* Format Instructions */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-arabic font-semibold text-foreground text-sm mb-2">صيغة ملفات Word:</h3>
          <div className="text-xs text-muted-foreground font-arabic space-y-2">
            <p><strong>صفحات المصحف:</strong> ضع رقم الصفحة في سطر منفصل (مثال: "1" أو "صفحة 1") ثم نص الصفحة في السطور التالية.</p>
            <p><strong>الكلمات الغريبة:</strong> ضع رقم الصفحة في سطر منفصل، ثم الكلمات بصيغة "الكلمة: المعنى" أو "الكلمة - المعنى".</p>
          </div>
        </div>
      </div>
    </div>
  );
}
