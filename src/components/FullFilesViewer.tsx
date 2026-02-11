import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Loader2,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

const MUSHAF_OVERRIDES_KEY = 'quran-mushaf-overrides';
const ITEMS_PER_PAGE = 50;

const surahNumberToName: Record<number, string> = {
  1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',
  11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',
  21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
  31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبإ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',
  41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',
  51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
  61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',
  71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبإ',79:'النازعات',80:'عبس',
  81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
  91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',
  101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',
  111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس',
};

// Surah start pages for filtering Quran text by surah
const surahStartPage: Record<number, number> = {
  1:1,2:2,3:50,4:77,5:106,6:128,7:151,8:177,9:187,10:208,
  11:221,12:235,13:249,14:255,15:262,16:267,17:282,18:293,19:305,20:312,
  21:322,22:332,23:342,24:350,25:359,26:367,27:377,28:385,29:396,30:404,
  31:411,32:415,33:418,34:428,35:434,36:440,37:446,38:453,39:458,40:467,
  41:477,42:483,43:489,44:496,45:499,46:502,47:507,48:511,49:515,50:518,
  51:520,52:523,53:526,54:528,55:531,56:534,57:537,58:542,59:545,60:549,
  61:551,62:553,63:554,64:556,65:558,66:560,67:562,68:564,69:566,70:568,
  71:570,72:572,73:574,74:575,75:577,76:578,77:580,78:582,79:583,80:585,
  81:586,82:587,83:587,84:589,85:590,86:591,87:591,88:592,89:593,90:594,
  91:595,92:595,93:596,94:596,95:597,96:597,97:598,98:598,99:599,100:599,
  101:600,102:600,103:601,104:601,105:601,106:602,107:602,108:602,109:603,110:603,
  111:603,112:604,113:604,114:604,
};
const surahEndPage: Record<number, number> = {
  1:1,2:49,3:76,4:106,5:127,6:150,7:176,8:186,9:207,10:221,
  11:235,12:248,13:255,14:261,15:267,16:281,17:293,18:304,19:312,20:321,
  21:331,22:341,23:349,24:359,25:366,26:376,27:385,28:396,29:404,30:410,
  31:414,32:417,33:427,34:434,35:440,36:445,37:452,38:458,39:467,40:476,
  41:482,42:489,43:495,44:498,45:502,46:506,47:510,48:515,49:517,50:520,
  51:523,52:525,53:528,54:531,55:534,56:537,57:541,58:545,59:549,60:551,
  61:552,62:554,63:556,64:558,65:559,66:561,67:564,68:566,69:568,70:570,
  71:571,72:573,73:575,74:577,75:578,76:580,77:581,78:583,79:584,80:585,
  81:586,82:587,83:589,84:589,85:590,86:591,87:591,88:592,89:594,90:594,
  91:595,92:596,93:596,94:596,95:597,96:597,97:598,98:599,99:599,100:600,
  101:600,102:600,103:601,104:601,105:601,106:602,107:602,108:602,109:603,110:603,
  111:603,112:604,113:604,114:604,
};

interface DiagnosticIssue {
  type: 'missing_meaning' | 'duplicate' | 'empty_word' | 'invalid_surah' | 'invalid_page' | 'short_meaning';
  severity: 'error' | 'warning';
  word: GhareebWord;
  message: string;
}

interface FullFilesViewerProps {
  children: React.ReactNode;
  pages: QuranPage[];
  allWords: GhareebWord[];
  onRefresh?: () => void;
}

export function FullFilesViewer({ children, pages, allWords, onRefresh }: FullFilesViewerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('quran');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [singlePage, setSinglePage] = useState('');
  const [verseFilter, setVerseFilter] = useState('');
  const [surahFilter, setSurahFilter] = useState<string>('all');
  const [browsePage, setBrowsePage] = useState(1);
  const [copied, setCopied] = useState(false);

  // Editing states
  const [editingQuran, setEditingQuran] = useState(false);
  const [quranFullText, setQuranFullText] = useState('');
  const [editingMeanings, setEditingMeanings] = useState(false);
  const [meaningsFullText, setMeaningsFullText] = useState('');

  // Raw file
  const [rawMeaningsFile, setRawMeaningsFile] = useState<string>('');
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);

  // Diagnostics
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagFilter, setDiagFilter] = useState<string>('all');
  const [diagPage, setDiagPage] = useState(1);
  const [importedDiagData, setImportedDiagData] = useState<any>(null);

  const { userOverrides, addWordOverride, exportOverrides, resetAll } = useDataStore();
  const { corrections, exportCorrections } = useCorrectionsStore();

  // Listen for cross-dialog navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setOpen(true);
        if (detail.tab) setActiveTab(detail.tab);
        if (detail.search) { setSearchQuery(detail.search); }
        if (detail.surah) { setSurahFilter(String(detail.surah)); }
        if (detail.verse) { setVerseFilter(String(detail.verse)); }
        if (detail.page) { setSinglePage(String(detail.page)); setPageFrom(''); setPageTo(''); }
        setBrowsePage(1);
      }
    };
    window.addEventListener('navigate-to-full-viewer', handler);
    return () => window.removeEventListener('navigate-to-full-viewer', handler);
  }, []);

  useEffect(() => {
    if (open && !rawMeaningsFile) {
      setIsLoadingRaw(true);
      fetch('/data/ghareeb-words.txt')
        .then(res => res.text())
        .then(text => { setRawMeaningsFile(text); setIsLoadingRaw(false); })
        .catch(() => setIsLoadingRaw(false));
    }
  }, [open, rawMeaningsFile]);

  const mushafOverrides = useMemo(() => {
    try {
      const stored = localStorage.getItem(MUSHAF_OVERRIDES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }, [open]);

  // ---- Full texts ----
  const fullQuranText = useMemo(() => {
    const lines: string[] = [];
    for (let pageNum = 1; pageNum <= 604; pageNum++) {
      const pageData = pages.find(p => p.pageNumber === pageNum);
      const text = mushafOverrides[pageNum] || pageData?.text || '';
      lines.push(`=== صفحة ${pageNum} ===`);
      if (pageData?.surahName) lines.push(`[${pageData.surahName}]`);
      lines.push(text);
      lines.push('');
    }
    return lines.join('\n');
  }, [pages, mushafOverrides]);

  const fullMeaningsText = useMemo(() => {
    if (rawMeaningsFile) return rawMeaningsFile;
    if (allWords.length === 0) return 'جاري تحميل الملف...';
    const lines: string[] = [];
    let currentPage = 0;
    const sorted = [...allWords].sort((a, b) => a.pageNumber !== b.pageNumber ? a.pageNumber - b.pageNumber : a.order - b.order);
    for (const word of sorted) {
      if (word.pageNumber !== currentPage) { currentPage = word.pageNumber; lines.push('', `=== صفحة ${currentPage} ===`); }
      lines.push(`${word.wordText} | ${word.meaning} | ${word.surahNumber}:${word.verseNumber}:${word.wordIndex}`);
    }
    return lines.join('\n');
  }, [allWords, rawMeaningsFile]);

  const overridesText = useMemo(() => JSON.stringify({ userOverrides, corrections, mushafOverrides }, null, 2), [userOverrides, corrections, mushafOverrides]);

  // ---- Flexible search for Quran text (page-based) ----
  const filteredQuranLines = useMemo(() => {
    const lines = fullQuranText.split('\n');
    let pFrom = pageFrom ? parseInt(pageFrom) : null;
    let pTo = pageTo ? parseInt(pageTo) : null;
    const query = searchQuery.trim();

    // Single page takes priority
    if (singlePage) {
      const sp = parseInt(singlePage);
      if (sp >= 1 && sp <= 604) { pFrom = sp; pTo = sp; }
    }

    // Apply surah filter by mapping to page range
    if (surahFilter !== 'all') {
      const sNum = parseInt(surahFilter);
      const sStart = surahStartPage[sNum];
      const sEnd = surahEndPage[sNum];
      if (sStart && sEnd) {
        pFrom = pFrom ? Math.max(pFrom, sStart) : sStart;
        pTo = pTo ? Math.min(pTo, sEnd) : sEnd;
      }
    }

    if (!pFrom && !pTo && !query) return lines;

    const filtered: string[] = [];
    let currentPageNum = 0;
    let includeCurrentPage = false;

    for (const line of lines) {
      const pageMatch = line.match(/^=== صفحة (\d+) ===$/);
      if (pageMatch) {
        currentPageNum = parseInt(pageMatch[1]);
        let pageInRange = true;
        if (pFrom && pTo) pageInRange = currentPageNum >= pFrom && currentPageNum <= pTo;
        else if (pFrom) pageInRange = currentPageNum === pFrom;
        else if (pTo) pageInRange = currentPageNum <= pTo;

        includeCurrentPage = pageInRange;
        if (includeCurrentPage && !query) { filtered.push(line); }
        continue;
      }

      if (!includeCurrentPage) continue;
      if (query) {
        if (line.includes(query)) filtered.push(`=== صفحة ${currentPageNum} ===`, line);
      } else {
        filtered.push(line);
      }
    }
    return filtered;
  }, [fullQuranText, pageFrom, pageTo, singlePage, searchQuery, surahFilter]);

  const quranResultCount = useMemo(() => {
    return filteredQuranLines.filter(l => !l.startsWith('=== صفحة') && l.trim()).length;
  }, [filteredQuranLines]);

  // ---- Flexible search for meanings (structured) ----
  const filteredMeaningsWords = useMemo(() => {
    let result = [...allWords];
    let pFrom = pageFrom ? parseInt(pageFrom) : null;
    let pTo = pageTo ? parseInt(pageTo) : null;

    // Single page takes priority
    if (singlePage) {
      const sp = parseInt(singlePage);
      if (sp >= 1 && sp <= 604) { pFrom = sp; pTo = sp; }
    }

    // Surah filter: use surah number directly on words (not page range)
    if (surahFilter !== 'all') {
      const sNum = parseInt(surahFilter);
      result = result.filter(w => w.surahNumber === sNum);
    }

    if (pFrom && pTo) result = result.filter(w => w.pageNumber >= pFrom! && w.pageNumber <= pTo!);
    else if (pFrom) result = result.filter(w => w.pageNumber === pFrom);
    else if (pTo) result = result.filter(w => w.pageNumber <= pTo!);

    // Verse filter (works with or without surah)
    if (verseFilter.trim()) {
      const vNum = parseInt(verseFilter);
      if (!isNaN(vNum)) result = result.filter(w => w.verseNumber === vNum);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter(w =>
        w.wordText.includes(q) || w.meaning.includes(q) || w.surahName.includes(q) || `${w.surahNumber}:${w.verseNumber}`.includes(q)
      );
    }

    return result.sort((a, b) => a.pageNumber !== b.pageNumber ? a.pageNumber - b.pageNumber : a.order - b.order);
  }, [allWords, pageFrom, pageTo, singlePage, surahFilter, verseFilter, searchQuery]);

  const totalMeaningsPages = Math.max(1, Math.ceil(filteredMeaningsWords.length / ITEMS_PER_PAGE));
  const paginatedMeaningsWords = useMemo(() => {
    const start = (browsePage - 1) * ITEMS_PER_PAGE;
    return filteredMeaningsWords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMeaningsWords, browsePage]);

  const handleSearchChange = useCallback((val: string) => { setSearchQuery(val); setBrowsePage(1); }, []);
  const clearFilters = useCallback(() => { setSearchQuery(''); setPageFrom(''); setPageTo(''); setSinglePage(''); setVerseFilter(''); setSurahFilter('all'); setBrowsePage(1); }, []);

  // ---- Diagnostics ----
  const diagnosticIssues = useMemo((): DiagnosticIssue[] => {
    if (!diagRunning) return [];
    const issues: DiagnosticIssue[] = [];
    const seenKeys = new Map<string, GhareebWord>();
    for (const word of allWords) {
      if (!word.meaning || word.meaning.trim().length === 0)
        issues.push({ type: 'missing_meaning', severity: 'error', word, message: `كلمة "${word.wordText}" بدون معنى` });
      if (word.meaning && word.meaning.trim().length > 0 && word.meaning.trim().length < 3)
        issues.push({ type: 'short_meaning', severity: 'warning', word, message: `معنى قصير جداً: "${word.meaning}"` });
      if (!word.wordText || word.wordText.trim().length === 0)
        issues.push({ type: 'empty_word', severity: 'error', word, message: `نص الكلمة فارغ (${word.uniqueKey})` });
      if (word.surahNumber < 1 || word.surahNumber > 114)
        issues.push({ type: 'invalid_surah', severity: 'error', word, message: `رقم سورة غير صحيح: ${word.surahNumber}` });
      if (word.pageNumber < 1 || word.pageNumber > 604)
        issues.push({ type: 'invalid_page', severity: 'error', word, message: `رقم صفحة غير صحيح: ${word.pageNumber}` });
      const dupKey = `${word.surahNumber}_${word.verseNumber}_${word.wordText}`;
      if (seenKeys.has(dupKey)) {
        const existing = seenKeys.get(dupKey)!;
        if (existing.uniqueKey !== word.uniqueKey)
          issues.push({ type: 'duplicate', severity: 'warning', word, message: `تكرار: "${word.wordText}" في ${word.surahNumber}:${word.verseNumber}` });
      } else { seenKeys.set(dupKey, word); }
    }
    return issues;
  }, [allWords, diagRunning]);

  const filteredDiagIssues = useMemo(() => {
    const filtered = diagFilter === 'all' ? diagnosticIssues : diagnosticIssues.filter(i => i.type === diagFilter);
    return filtered;
  }, [diagnosticIssues, diagFilter]);

  const totalDiagPages = Math.max(1, Math.ceil(filteredDiagIssues.length / ITEMS_PER_PAGE));
  const paginatedDiagIssues = useMemo(() => {
    const start = (diagPage - 1) * ITEMS_PER_PAGE;
    return filteredDiagIssues.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDiagIssues, diagPage]);

  const diagStats = useMemo(() => ({
    total: diagnosticIssues.length,
    errors: diagnosticIssues.filter(i => i.severity === 'error').length,
    warnings: diagnosticIssues.filter(i => i.severity === 'warning').length,
    missingMeaning: diagnosticIssues.filter(i => i.type === 'missing_meaning').length,
    duplicates: diagnosticIssues.filter(i => i.type === 'duplicate').length,
    emptyWords: diagnosticIssues.filter(i => i.type === 'empty_word').length,
    invalidSurah: diagnosticIssues.filter(i => i.type === 'invalid_surah').length,
    invalidPage: diagnosticIssues.filter(i => i.type === 'invalid_page').length,
    shortMeaning: diagnosticIssues.filter(i => i.type === 'short_meaning').length,
  }), [diagnosticIssues]);

  const handleFixIssue = (issue: DiagnosticIssue) => {
    addWordOverride({
      key: issue.word.uniqueKey, operation: 'edit', pageNumber: issue.word.pageNumber,
      wordText: issue.word.wordText, meaning: issue.word.meaning,
      surahNumber: issue.word.surahNumber, verseNumber: issue.word.verseNumber,
      wordIndex: issue.word.wordIndex, surahName: issue.word.surahName,
    });
    toast.info('تم إنشاء تعديل — يمكنك تحريره من تبويب التعديلات في مدير البيانات');
  };

  // ---- Handlers ----
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`تم نسخ ${label}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${filename}`);
  };

  const handleStartEditQuran = () => { 
    setQuranFullText(hasFilters ? filteredQuranLines.join('\n') : fullQuranText); 
    setEditingQuran(true); 
  };

  const handleSaveQuranEdits = () => {
    try {
      const newOverrides: Record<number, string> = {};
      const sections = quranFullText.split(/=== صفحة (\d+) ===/);
      for (let i = 1; i < sections.length; i += 2) {
        const pageNum = parseInt(sections[i]);
        let text = sections[i + 1] || '';
        text = text.replace(/^\s*\[[^\]]+\]\s*\n/, '').trim();
        const originalPage = pages.find(p => p.pageNumber === pageNum);
        if (text && text !== originalPage?.text) newOverrides[pageNum] = text;
      }
      const existing = { ...mushafOverrides, ...newOverrides };
      localStorage.setItem(MUSHAF_OVERRIDES_KEY, JSON.stringify(existing));
      toast.success(`تم حفظ التعديلات (${Object.keys(newOverrides).length} صفحة)`);
      setEditingQuran(false);
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) { console.error('Save error:', err); toast.error('خطأ في الحفظ'); }
  };

  const handleStartEditMeanings = () => { 
    if (hasFilters && filteredMeaningsWords.length > 0) {
      const lines = filteredMeaningsWords.map(w => `${w.wordText} | ${w.meaning} | ${w.surahNumber}:${w.verseNumber}:${w.wordIndex}`);
      setMeaningsFullText(lines.join('\n'));
    } else {
      setMeaningsFullText(fullMeaningsText); 
    }
    setEditingMeanings(true); 
  };

  const handleSaveMeaningsEdits = () => {
    try {
      const lines = meaningsFullText.split('\n').filter(l => l.trim() && !l.startsWith('==='));
      let added = 0;
      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const wordText = parts[0], meaning = parts[1];
          let surahNumber = 1, verseNumber = 1, wordIndex = 0;
          if (parts[2]) { const loc = parts[2].split(':').map(n => parseInt(n) || 1); surahNumber = loc[0] || 1; verseNumber = loc[1] || 1; wordIndex = loc[2] || 0; }
          useDataStore.getState().addWordOverride({ key: `${surahNumber}_${verseNumber}_${wordIndex}`, operation: 'add', pageNumber: 1, wordText, meaning, surahNumber, verseNumber, wordIndex, surahName: '' });
          added++;
        }
      }
      toast.success(`تم استيراد ${added} كلمة`);
      setEditingMeanings(false);
    } catch { toast.error('خطأ في الاستيراد'); }
  };

  const handleImportFile = (type: 'quran' | 'meanings') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.txt,.json,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          if (type === 'quran') { setQuranFullText(content); setEditingQuran(true); }
          else { setMeaningsFullText(content); setEditingMeanings(true); }
          toast.success(`تم تحميل ${file.name}`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const hasFilters = searchQuery || pageFrom || pageTo || singlePage || verseFilter || surahFilter !== 'all';
  const rawLinesCount = rawMeaningsFile ? rawMeaningsFile.split('\n').filter(l => l.trim() && !l.startsWith('#')).length : 0;

  const stats = {
    totalPages: pages.length || 604,
    totalWords: rawLinesCount || allWords.length,
    totalOverrides: userOverrides.length,
    totalCorrections: corrections.length,
    mushafOverrides: Object.keys(mushafOverrides).length,
  };

  // ---- Search Bar JSX (inline, not a component) ----
  const searchBarJSX = (
    <div className="space-y-1">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="بحث بالكلمة أو المعنى..." className="pr-10 font-arabic h-8 text-sm" />
        </div>
        <Input type="number" min={1} max={604} value={singlePage}
          onChange={e => { setSinglePage(e.target.value); setPageFrom(''); setPageTo(''); setBrowsePage(1); }}
          placeholder="صفحة" className="w-[70px] text-center h-8 text-sm" />
        <div className="flex gap-1 items-center">
          <Input type="number" min={1} max={604} value={pageFrom}
            onChange={e => { setPageFrom(e.target.value); setSinglePage(''); setBrowsePage(1); }}
            placeholder="من ص" className="w-[70px] text-center h-8 text-sm" />
          <span className="text-muted-foreground text-xs">–</span>
          <Input type="number" min={1} max={604} value={pageTo}
            onChange={e => { setPageTo(e.target.value); setSinglePage(''); setBrowsePage(1); }}
            placeholder="إلى ص" className="w-[70px] text-center h-8 text-sm" />
        </div>
        <Select value={surahFilter} onValueChange={v => { setSurahFilter(v); setVerseFilter(''); setSinglePage(''); setPageFrom(''); setPageTo(''); setBrowsePage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="السورة" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] z-[9999] bg-popover">
            <SelectItem value="all">كل السور</SelectItem>
            {Object.entries(surahNumberToName).map(([num, name]) => (
              <SelectItem key={num} value={num}>{num}. {name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" min={1} max={286} value={verseFilter}
          onChange={e => { setVerseFilter(e.target.value); setBrowsePage(1); }}
          placeholder="آية" className="w-[70px] text-center h-8 text-sm" />
        {hasFilters && (
          <>
            <span className="text-xs text-muted-foreground font-arabic">
              {activeTab === 'meanings' ? `${filteredMeaningsWords.length.toLocaleString()} نتيجة` :
               activeTab === 'quran' ? `${quranResultCount.toLocaleString()} سطر` : ''}
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs font-arabic" onClick={clearFilters}>
              مسح الفلاتر
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // ---- Pagination ----
  const PaginationBar = ({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={current <= 1} onClick={() => onChange(current - 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-xs font-arabic text-muted-foreground">{current} / {total}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={current >= total} onClick={() => onChange(current + 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[95vw] !top-[2vh] !translate-y-0 max-h-[96vh] flex flex-col overflow-hidden p-4" dir="rtl">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quran" className="font-arabic text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              ملف القرآن
            </TabsTrigger>
            <TabsTrigger value="meanings" className="font-arabic text-xs gap-1">
              <FileText className="w-3 h-3" />
              ملف المعاني
            </TabsTrigger>
            <TabsTrigger value="overrides" className="font-arabic text-xs gap-1">
              <Layers className="w-3 h-3" />
              التعديلات
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="font-arabic text-xs gap-1">
              <Stethoscope className="w-3 h-3" />
              تشخيص
            </TabsTrigger>
          </TabsList>

          {/* Search Bar (shared across quran & meanings) */}
          {(activeTab === 'quran' || activeTab === 'meanings') && (
            <div className="mt-1">
              {searchBarJSX}
            </div>
          )}

          {/* Quran File Tab */}
          <TabsContent value="quran" className="flex-1 flex flex-col gap-2 mt-1 min-h-0 overflow-auto">
            <div className="flex gap-2 flex-wrap">
              {!editingQuran ? (
                <>
                  <Button onClick={handleStartEditQuran} variant="outline" size="sm" className="font-arabic gap-1">
                    <FileText className="w-3 h-3" /> تحرير الملف
                  </Button>
                  <Button onClick={() => handleImportFile('quran')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Upload className="w-3 h-3" /> استيراد
                  </Button>
                  <Button onClick={() => handleExport(fullQuranText, 'quran-full.txt')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Download className="w-3 h-3" /> تصدير
                  </Button>
                  <Button onClick={() => handleCopy(fullQuranText, 'ملف القرآن')} variant="outline" size="sm" className="font-arabic gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleSaveQuranEdits} size="sm" className="font-arabic gap-1">
                    <Save className="w-3 h-3" /> حفظ التعديلات
                  </Button>
                  <Button onClick={() => setEditingQuran(false)} variant="outline" size="sm" className="font-arabic gap-1">إلغاء</Button>
                </>
              )}
            </div>
            <ScrollArea className="flex-1 border rounded-lg min-h-[500px]">
              {editingQuran ? (
                <Textarea value={quranFullText} onChange={(e) => setQuranFullText(e.target.value)}
                  className="min-h-[600px] w-full font-arabic text-lg leading-loose p-6 border-0 resize-y" dir="rtl" />
              ) : (
                <pre className="p-6 font-arabic text-lg leading-loose whitespace-pre-wrap" dir="rtl">
                  {filteredQuranLines.join('\n') || 'لا توجد بيانات'}
                </pre>
              )}
            </ScrollArea>
            <div className="text-xs text-muted-foreground font-arabic">
              {editingQuran ? (hasFilters ? '💡 يتم عرض المحتوى المفلتر فقط — عدّل ثم اضغط "حفظ التعديلات"' : '💡 عدّل النص ثم اضغط "حفظ التعديلات". التنسيق: === صفحة X === ثم النص')
                : `إجمالي: ${fullQuranText.split('\n').length.toLocaleString()} سطر`}
            </div>
          </TabsContent>

          {/* Meanings File Tab — structured table with pagination */}
          <TabsContent value="meanings" className="flex-1 flex flex-col gap-2 mt-1 min-h-0 overflow-auto">
            <div className="flex gap-2 flex-wrap">
              {!editingMeanings ? (
                <>
                  <Button onClick={handleStartEditMeanings} variant="outline" size="sm" className="font-arabic gap-1">
                    <FileText className="w-3 h-3" /> تحرير الملف
                  </Button>
                  <Button onClick={() => handleImportFile('meanings')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Upload className="w-3 h-3" /> استيراد
                  </Button>
                  <Button onClick={() => handleExport(fullMeaningsText, 'meanings-full.txt')} variant="outline" size="sm" className="font-arabic gap-1">
                    <Download className="w-3 h-3" /> تصدير
                  </Button>
                  <Button onClick={() => handleCopy(fullMeaningsText, 'ملف المعاني')} variant="outline" size="sm" className="font-arabic gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleSaveMeaningsEdits} size="sm" className="font-arabic gap-1">
                    <Save className="w-3 h-3" /> حفظ التعديلات
                  </Button>
                  <Button onClick={() => setEditingMeanings(false)} variant="outline" size="sm" className="font-arabic gap-1">إلغاء</Button>
                </>
              )}
            </div>

            {editingMeanings ? (
              <ScrollArea className="flex-1 border rounded-lg min-h-[500px]">
                <Textarea value={meaningsFullText} onChange={(e) => setMeaningsFullText(e.target.value)}
                  className="min-h-[600px] w-full font-arabic text-sm leading-relaxed p-6 border-0 resize-y" dir="rtl" />
              </ScrollArea>
            ) : isLoadingRaw ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="mr-2 font-arabic">جاري تحميل الملف...</span>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 border rounded-lg min-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="font-arabic text-right w-14">ص</TableHead>
                        <TableHead className="font-arabic text-right">الكلمة</TableHead>
                        <TableHead className="font-arabic text-right min-w-[250px]">المعنى</TableHead>
                        <TableHead className="font-arabic text-right w-20">الموقع</TableHead>
                        <TableHead className="font-arabic text-right w-24">السورة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMeaningsWords.map((word, idx) => (
                        <TableRow key={`${word.uniqueKey}-${idx}`}>
                          <TableCell>
                            <button className="text-sm text-primary hover:underline cursor-pointer"
                              onClick={() => { setSinglePage(String(word.pageNumber)); setPageFrom(''); setPageTo(''); setBrowsePage(1); }}>
                              {word.pageNumber}
                            </button>
                          </TableCell>
                          <TableCell className="font-arabic font-semibold">{word.wordText}</TableCell>
                          <TableCell className="font-arabic text-sm">{word.meaning}</TableCell>
                          <TableCell>
                            <button className="text-xs text-primary hover:underline cursor-pointer"
                              onClick={() => { setSurahFilter(String(word.surahNumber)); setVerseFilter(String(word.verseNumber)); setSinglePage(''); setPageFrom(''); setPageTo(''); setBrowsePage(1); }}>
                              {word.surahNumber}:{word.verseNumber}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button className="font-arabic text-xs text-primary hover:underline cursor-pointer"
                              onClick={() => { setSurahFilter(String(word.surahNumber)); setVerseFilter(''); setSinglePage(''); setPageFrom(''); setPageTo(''); setSearchQuery(''); setBrowsePage(1); }}>
                              {word.surahName}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <PaginationBar current={browsePage} total={totalMeaningsPages} onChange={setBrowsePage} />
              </>
            )}

            <div className="text-xs text-muted-foreground font-arabic">
              {editingMeanings ? '💡 التنسيق: ﴿الكلمة﴾ TAB السورة TAB الآية TAB المعنى'
                : `إجمالي: ${filteredMeaningsWords.length.toLocaleString()} كلمة`}
            </div>
          </TabsContent>

          {/* Overrides Tab */}
          <TabsContent value="overrides" className="flex-1 flex flex-col gap-2 mt-1 min-h-0 overflow-auto">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => handleExport(overridesText, 'overrides-full.json')} variant="outline" size="sm" className="font-arabic gap-1">
                <Download className="w-3 h-3" /> تصدير JSON
              </Button>
              <Button onClick={() => handleCopy(overridesText, 'ملف التعديلات')} variant="outline" size="sm" className="font-arabic gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
              </Button>
              <Button onClick={() => {
                if (confirm('هل تريد حذف جميع التعديلات؟')) {
                  resetAll(); localStorage.removeItem(MUSHAF_OVERRIDES_KEY);
                  toast.success('تم إعادة التعيين');
                  if (onRefresh) setTimeout(onRefresh, 500);
                }
              }} variant="destructive" size="sm" className="font-arabic gap-1">
                <RefreshCw className="w-3 h-3" /> إعادة تعيين الكل
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg min-h-[400px]">
              <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap" dir="ltr">{overridesText}</pre>
            </ScrollArea>
            <div className="text-xs text-muted-foreground font-arabic">
              إجمالي: {stats.totalOverrides} تعديل كلمات + {stats.mushafOverrides} صفحة معدلة + {stats.totalCorrections} تصحيح
            </div>
          </TabsContent>

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" className="flex-1 flex flex-col gap-2 mt-1 min-h-0 overflow-auto">
            {!diagRunning ? (
              <div className="text-center py-6 space-y-3">
                <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <h3 className="font-arabic font-bold text-lg">فحص تشخيصي شامل للملفات</h3>
                <p className="font-arabic text-sm text-muted-foreground max-w-md mx-auto">
                  يفحص جميع الكلمات ({allWords.length.toLocaleString()}) للكشف عن: كلمات بدون معنى، تكرارات، نصوص فارغة، أرقام سور أو صفحات خاطئة، معانٍ قصيرة.
                </p>
                <Button onClick={() => { setDiagRunning(true); setDiagPage(1); setDiagFilter('all'); }} size="lg" className="font-arabic gap-2">
                  <Stethoscope className="w-5 h-5" /> بدء الفحص
                </Button>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <button onClick={() => { setDiagFilter('all'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'all' ? 'border-primary bg-primary/5' : ''}`}>
                    <div className={`text-lg font-bold ${diagStats.total === 0 ? 'text-green-600' : 'text-amber-600'}`}>{diagStats.total}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">الكل</div>
                  </button>
                  <button onClick={() => { setDiagFilter('missing_meaning'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'missing_meaning' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.missingMeaning}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">بدون معنى</div>
                  </button>
                  <button onClick={() => { setDiagFilter('duplicate'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'duplicate' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : ''}`}>
                    <div className="text-lg font-bold text-amber-600">{diagStats.duplicates}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">مكررة</div>
                  </button>
                  <button onClick={() => { setDiagFilter('empty_word'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'empty_word' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.emptyWords}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">نص فارغ</div>
                  </button>
                  <button onClick={() => { setDiagFilter('invalid_page'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'invalid_page' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                    <div className="text-lg font-bold text-red-600">{diagStats.invalidPage + diagStats.invalidSurah}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">بيانات خاطئة</div>
                  </button>
                  <button onClick={() => { setDiagFilter('short_meaning'); setDiagPage(1); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer transition-colors ${diagFilter === 'short_meaning' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : ''}`}>
                    <div className="text-lg font-bold text-amber-600">{diagStats.shortMeaning}</div>
                    <div className="text-[10px] font-arabic text-muted-foreground">معنى قصير</div>
                  </button>
                </div>

                {/* Health Score */}
                <div className={`p-2 border rounded-lg flex items-center gap-3 ${
                  diagStats.total === 0 ? 'border-green-300 bg-green-50 dark:bg-green-950'
                  : diagStats.errors > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950'
                  : 'border-amber-300 bg-amber-50 dark:bg-amber-950'
                }`}>
                  {diagStats.total === 0 ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                    : diagStats.errors > 0 ? <XCircle className="w-5 h-5 text-red-600" />
                    : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  <span className="font-arabic text-sm">
                    {diagStats.total === 0 ? 'لا توجد مشكلات! البيانات سليمة ✓'
                      : `${diagStats.errors} خطأ و ${diagStats.warnings} تحذير من أصل ${allWords.length.toLocaleString()} كلمة`}
                  </span>
                  <div className="mr-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="font-arabic text-xs"
                      onClick={() => { setDiagRunning(false); setDiagFilter('all'); setDiagPage(1); }}>
                      إعادة الفحص
                    </Button>
                    <Button size="sm" variant="outline" className="font-arabic text-xs gap-1"
                      onClick={() => {
                        const exportData = {
                          version: '1.0',
                          type: 'diagnostics-report',
                          timestamp: new Date().toISOString(),
                          totalWords: allWords.length,
                          stats: diagStats,
                          issues: diagnosticIssues.map(i => ({
                            type: i.type, severity: i.severity, message: i.message,
                            page: i.word.pageNumber, surah: i.word.surahNumber,
                            verse: i.word.verseNumber, word: i.word.wordText,
                            meaning: i.word.meaning, uniqueKey: i.word.uniqueKey,
                          })),
                        };
                        handleExport(JSON.stringify(exportData, null, 2), `diagnostics-${Date.now()}.json`);
                      }}>
                      <Download className="w-3 h-3" /> تصدير
                    </Button>
                    <Button size="sm" variant="outline" className="font-arabic text-xs gap-1"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = '.json';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            try {
                              const data = JSON.parse(ev.target?.result as string);
                              if (data.type !== 'diagnostics-report' || !data.issues) {
                                toast.error('ملف غير صالح — يجب أن يكون تقرير تشخيص');
                                return;
                              }
                              setImportedDiagData(data);
                              toast.success(`تم استيراد ${data.issues.length} مشكلة من التقرير`);
                            } catch { toast.error('خطأ في قراءة الملف'); }
                          };
                          reader.readAsText(file);
                        };
                        input.click();
                      }}>
                      <Upload className="w-3 h-3" /> استيراد
                    </Button>
                  </div>
                </div>

                {/* Imported report view */}
                {importedDiagData && (
                  <div className="p-2 border rounded-lg border-blue-300 bg-blue-50 dark:bg-blue-950 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="font-arabic text-xs flex-1">
                      تقرير مستورد: {importedDiagData.issues.length} مشكلة — {new Date(importedDiagData.timestamp).toLocaleString('ar')}
                    </span>
                    <Button size="sm" variant="ghost" className="font-arabic text-xs h-6" onClick={() => setImportedDiagData(null)}>
                      إغلاق
                    </Button>
                  </div>
                )}

                {/* Issues List with Pagination */}
                {filteredDiagIssues.length > 0 ? (
                  <>
                    <ScrollArea className="flex-1 border rounded-lg min-h-[300px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="font-arabic text-right w-14">النوع</TableHead>
                            <TableHead className="font-arabic text-right">الوصف</TableHead>
                            <TableHead className="font-arabic text-right w-14">ص</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedDiagIssues.map((issue, idx) => (
                            <TableRow key={`diag-${diagPage}-${idx}`}>
                              <TableCell>
                                {issue.severity === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                              </TableCell>
                              <TableCell className="font-arabic text-sm">{issue.message}</TableCell>
                              <TableCell className="text-sm">{issue.word.pageNumber}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="h-7 text-xs font-arabic" onClick={() => handleFixIssue(issue)}>
                                  إصلاح
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-arabic">
                        {filteredDiagIssues.length.toLocaleString()} نتيجة
                      </span>
                      <PaginationBar current={diagPage} total={totalDiagPages} onChange={setDiagPage} />
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground font-arabic py-4">لا توجد مشكلات من هذا النوع</p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
