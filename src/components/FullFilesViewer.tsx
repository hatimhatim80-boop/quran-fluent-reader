import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuranPage, GhareebWord } from '@/types/quran';
import { useDataStore } from '@/stores/dataStore';
import { useCorrectionsStore } from '@/stores/correctionsStore';
import {
  Database,
  BookOpen,
  FileText,
  Layers,
  Download,
  Upload,
  Search,
  Copy,
  Check,
  Save,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// Key for mushaf overrides
const MUSHAF_OVERRIDES_KEY = 'quran-mushaf-overrides';

interface FullFilesViewerProps {
  children: React.ReactNode;
  pages: QuranPage[];
  allWords: GhareebWord[];
  onRefresh?: () => void;
}

export function FullFilesViewer({ children, pages, allWords, onRefresh }: FullFilesViewerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('quran');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Editing states
  const [editingQuran, setEditingQuran] = useState(false);
  const [quranFullText, setQuranFullText] = useState('');
  
  const [editingMeanings, setEditingMeanings] = useState(false);
  const [meaningsFullText, setMeaningsFullText] = useState('');

  const { userOverrides, exportOverrides, importOverrides, resetAll } = useDataStore();
  const { corrections, exportCorrections } = useCorrectionsStore();

  // Load mushaf overrides from localStorage
  const mushafOverrides = useMemo(() => {
    try {
      const stored = localStorage.getItem(MUSHAF_OVERRIDES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, [open]);

  // Generate full Quran text (all pages)
  const fullQuranText = useMemo(() => {
    const lines: string[] = [];
    
    for (let pageNum = 1; pageNum <= 604; pageNum++) {
      const pageData = pages.find(p => p.pageNumber === pageNum);
      const overrideText = mushafOverrides[pageNum];
      const text = overrideText || pageData?.text || '';
      
      lines.push(`=== صفحة ${pageNum} ===`);
      if (pageData?.surahName) {
        lines.push(`[${pageData.surahName}]`);
      }
      lines.push(text);
      lines.push('');
    }
    
    return lines.join('\n');
  }, [pages, mushafOverrides]);

  // Generate full meanings text
  const fullMeaningsText = useMemo(() => {
    const lines: string[] = [];
    let currentPage = 0;
    
    // Sort by page number
    const sorted = [...allWords].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.order - b.order;
    });
    
    for (const word of sorted) {
      if (word.pageNumber !== currentPage) {
        currentPage = word.pageNumber;
        lines.push('');
        lines.push(`=== صفحة ${currentPage} ===`);
      }
      
      lines.push(`${word.wordText} | ${word.meaning} | ${word.surahNumber}:${word.verseNumber}:${word.wordIndex}`);
    }
    
    return lines.join('\n');
  }, [allWords]);

  // Generate overrides text
  const overridesText = useMemo(() => {
    return JSON.stringify({
      userOverrides,
      corrections,
      mushafOverrides,
    }, null, 2);
  }, [userOverrides, corrections, mushafOverrides]);

  // Filter content based on search
  const filteredQuranText = useMemo(() => {
    if (!searchQuery.trim()) return fullQuranText;
    
    const query = searchQuery.trim();
    const lines = fullQuranText.split('\n');
    const filtered: string[] = [];
    let includeNextLines = false;
    
    for (const line of lines) {
      if (line.startsWith('=== صفحة')) {
        includeNextLines = false;
      }
      if (line.includes(query)) {
        includeNextLines = true;
      }
      if (includeNextLines || line.includes(query)) {
        filtered.push(line);
      }
    }
    
    return filtered.join('\n');
  }, [fullQuranText, searchQuery]);

  const filteredMeaningsText = useMemo(() => {
    if (!searchQuery.trim()) return fullMeaningsText;
    
    const query = searchQuery.trim();
    return fullMeaningsText
      .split('\n')
      .filter(line => line.includes(query) || line.startsWith('==='))
      .join('\n');
  }, [fullMeaningsText, searchQuery]);

  // Copy to clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`تم نسخ ${label}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export file
  const handleExport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${filename}`);
  };

  // Start editing Quran
  const handleStartEditQuran = () => {
    setQuranFullText(fullQuranText);
    setEditingQuran(true);
  };

  // Save Quran edits
  const handleSaveQuranEdits = () => {
    try {
      const newOverrides: Record<number, string> = {};
      const sections = quranFullText.split(/=== صفحة (\d+) ===/);
      
      for (let i = 1; i < sections.length; i += 2) {
        const pageNum = parseInt(sections[i]);
        let text = sections[i + 1] || '';
        
        // Remove surah name line if exists
        text = text.replace(/^\s*\[[^\]]+\]\s*\n/, '').trim();
        
        // Only save if different from original
        const originalPage = pages.find(p => p.pageNumber === pageNum);
        if (text && text !== originalPage?.text) {
          newOverrides[pageNum] = text;
        }
      }
      
      // Merge with existing overrides
      const existing = { ...mushafOverrides, ...newOverrides };
      localStorage.setItem(MUSHAF_OVERRIDES_KEY, JSON.stringify(existing));
      
      toast.success(`تم حفظ التعديلات (${Object.keys(newOverrides).length} صفحة)`);
      setEditingQuran(false);
      
      // Refresh the app
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('خطأ في الحفظ');
    }
  };

  // Start editing meanings
  const handleStartEditMeanings = () => {
    setMeaningsFullText(fullMeaningsText);
    setEditingMeanings(true);
  };

  // Save meanings edits
  const handleSaveMeaningsEdits = () => {
    try {
      const lines = meaningsFullText.split('\n').filter(l => l.trim() && !l.startsWith('==='));
      let currentPage = 1;
      let added = 0;
      
      for (const line of lines) {
        // Parse: word | meaning | surah:ayah:wordIndex
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const wordText = parts[0];
          const meaning = parts[1];
          let surahNumber = 1, verseNumber = 1, wordIndex = 0;
          
          if (parts[2]) {
            const location = parts[2].split(':').map(n => parseInt(n) || 1);
            surahNumber = location[0] || 1;
            verseNumber = location[1] || 1;
            wordIndex = location[2] || 0;
          }
          
          // Add as override
          const key = `${surahNumber}_${verseNumber}_${wordIndex}`;
          useDataStore.getState().addWordOverride({
            key,
            operation: 'add',
            pageNumber: currentPage,
            wordText,
            meaning,
            surahNumber,
            verseNumber,
            wordIndex,
            surahName: '',
          });
          added++;
        }
      }
      
      toast.success(`تم استيراد ${added} كلمة`);
      setEditingMeanings(false);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('خطأ في الاستيراد');
    }
  };

  // Import from file
  const handleImportFile = (type: 'quran' | 'meanings') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          if (type === 'quran') {
            setQuranFullText(content);
            setEditingQuran(true);
          } else {
            setMeaningsFullText(content);
            setEditingMeanings(true);
          }
          toast.success(`تم تحميل ${file.name}`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Stats
  const stats = {
    totalPages: pages.length || 604,
    totalWords: allWords.length,
    totalOverrides: userOverrides.length,
    totalCorrections: corrections.length,
    mushafOverrides: Object.keys(mushafOverrides).length,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <Database className="w-5 h-5" />
            مدير البيانات - عرض الملفات الكاملة
          </DialogTitle>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex gap-4 text-xs font-arabic text-muted-foreground border-b pb-2">
          <span>📄 {stats.totalPages} صفحة</span>
          <span>📝 {stats.totalWords.toLocaleString()} كلمة</span>
          <span>✏️ {stats.totalOverrides} تعديل</span>
          <span>🔧 {stats.mushafOverrides} صفحة معدلة</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quran" className="font-arabic text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              ملف القرآن الكامل
            </TabsTrigger>
            <TabsTrigger value="meanings" className="font-arabic text-xs gap-1">
              <FileText className="w-3 h-3" />
              ملف المعاني الكامل
            </TabsTrigger>
            <TabsTrigger value="overrides" className="font-arabic text-xs gap-1">
              <Layers className="w-3 h-3" />
              ملف التعديلات
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الملف..."
                className="pr-10 font-arabic"
              />
            </div>
          </div>

          {/* Quran File Tab */}
          <TabsContent value="quran" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
            <div className="flex gap-2 flex-wrap">
              {!editingQuran ? (
                <>
                  <Button onClick={handleStartEditQuran} variant="outline" size="sm" className="font-arabic gap-1">
                    <FileText className="w-3 h-3" />
                    تحرير الملف
                  </Button>
                  <Button onClick={() => handleImportFile('quran')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Upload className="w-3 h-3" />
                    استيراد
                  </Button>
                  <Button onClick={() => handleExport(fullQuranText, 'quran-full.txt')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Download className="w-3 h-3" />
                    تصدير
                  </Button>
                  <Button onClick={() => handleCopy(fullQuranText, 'ملف القرآن')} variant="outline" size="sm" className="font-arabic gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    نسخ
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleSaveQuranEdits} size="sm" className="font-arabic gap-1">
                    <Save className="w-3 h-3" />
                    حفظ التعديلات
                  </Button>
                  <Button onClick={() => setEditingQuran(false)} variant="outline" size="sm" className="font-arabic gap-1">
                    إلغاء
                  </Button>
                </>
              )}
            </div>
            
            <ScrollArea className="flex-1 border rounded-lg min-h-[400px]">
              {editingQuran ? (
                <Textarea
                  value={quranFullText}
                  onChange={(e) => setQuranFullText(e.target.value)}
                  className="min-h-[500px] font-arabic text-lg leading-loose p-4 border-0 resize-none"
                  dir="rtl"
                />
              ) : (
                <pre className="p-4 font-arabic text-lg leading-loose whitespace-pre-wrap" dir="rtl">
                  {filteredQuranText || 'لا توجد بيانات'}
                </pre>
              )}
            </ScrollArea>
            
            <div className="text-xs text-muted-foreground font-arabic">
              {editingQuran 
                ? '💡 عدّل النص ثم اضغط "حفظ التعديلات". التنسيق: === صفحة X === ثم النص'
                : `إجمالي: ${fullQuranText.split('\n').length.toLocaleString()} سطر`
              }
            </div>
          </TabsContent>

          {/* Meanings File Tab */}
          <TabsContent value="meanings" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
            <div className="flex gap-2 flex-wrap">
              {!editingMeanings ? (
                <>
                  <Button onClick={handleStartEditMeanings} variant="outline" size="sm" className="font-arabic gap-1">
                    <FileText className="w-3 h-3" />
                    تحرير الملف
                  </Button>
                  <Button onClick={() => handleImportFile('meanings')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Upload className="w-3 h-3" />
                    استيراد
                  </Button>
                  <Button onClick={() => handleExport(fullMeaningsText, 'meanings-full.txt')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Download className="w-3 h-3" />
                    تصدير
                  </Button>
                  <Button onClick={() => handleCopy(fullMeaningsText, 'ملف المعاني')} variant="outline" size="sm" className="font-arabic gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    نسخ
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleSaveMeaningsEdits} size="sm" className="font-arabic gap-1">
                    <Save className="w-3 h-3" />
                    حفظ التعديلات
                  </Button>
                  <Button onClick={() => setEditingMeanings(false)} variant="outline" size="sm" className="font-arabic gap-1">
                    إلغاء
                  </Button>
                </>
              )}
            </div>
            
            <ScrollArea className="flex-1 border rounded-lg min-h-[400px]">
              {editingMeanings ? (
                <Textarea
                  value={meaningsFullText}
                  onChange={(e) => setMeaningsFullText(e.target.value)}
                  className="min-h-[500px] font-arabic text-sm leading-relaxed p-4 border-0 resize-none"
                  dir="rtl"
                />
              ) : (
                <pre className="p-4 font-arabic text-sm leading-relaxed whitespace-pre-wrap" dir="rtl">
                  {filteredMeaningsText || 'لا توجد بيانات'}
                </pre>
              )}
            </ScrollArea>
            
            <div className="text-xs text-muted-foreground font-arabic">
              {editingMeanings 
                ? '💡 التنسيق: الكلمة | المعنى | السورة:الآية:الترتيب'
                : `إجمالي: ${allWords.length.toLocaleString()} كلمة`
              }
            </div>
          </TabsContent>

          {/* Overrides File Tab */}
          <TabsContent value="overrides" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => handleExport(overridesText, 'overrides-full.json')} variant="outline" size="sm" className="font-arabic gap-1">
                <Download className="w-3 h-3" />
                تصدير JSON
              </Button>
              <Button onClick={() => handleCopy(overridesText, 'ملف التعديلات')} variant="outline" size="sm" className="font-arabic gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                نسخ
              </Button>
              <Button 
                onClick={() => {
                  if (confirm('هل تريد حذف جميع التعديلات؟')) {
                    resetAll();
                    localStorage.removeItem(MUSHAF_OVERRIDES_KEY);
                    toast.success('تم إعادة التعيين');
                    if (onRefresh) setTimeout(onRefresh, 500);
                  }
                }} 
                variant="destructive" 
                size="sm" 
                className="font-arabic gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                إعادة تعيين الكل
              </Button>
            </div>
            
            <ScrollArea className="flex-1 border rounded-lg min-h-[400px]">
              <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap" dir="ltr">
                {overridesText}
              </pre>
            </ScrollArea>
            
            <div className="text-xs text-muted-foreground font-arabic">
              إجمالي: {stats.totalOverrides} تعديل كلمات + {stats.mushafOverrides} صفحة معدلة + {stats.totalCorrections} تصحيح
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
