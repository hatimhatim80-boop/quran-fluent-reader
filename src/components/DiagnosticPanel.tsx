import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Stethoscope,
  Layers,
  Link2,
  MousePointer,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Undo2,
  Database,
  FileText,
} from 'lucide-react';
import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';

// ============= TYPES =============

export type RendererType = 'WORD_SPANS' | 'PLAIN_TEXT';
export type FallbackReason = 
  | 'TOKENIZE_ERROR' 
  | 'NORMALIZE_ERROR' 
  | 'NORMALIZATION_MISMATCH'
  | 'DOM_PARSE_ERROR' 
  | 'CACHE_STALE' 
  | 'UNKNOWN'
  | null;

export type UnmatchedReason =
  | 'NO_TOKEN'
  | 'NORMALIZATION_MISMATCH'
  | 'DUPLICATE_KEY'
  | 'MISSING_MEANING'
  | 'SURAH_MISMATCH';

export type MeaningSource = 'overrides' | 'imported' | 'canonical' | 'none';

export interface AssemblyBlock {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  rendererType: RendererType;
  tokenCount: number;
  highlightEnabled: boolean;
  fallbackReason: FallbackReason;
  matchedCount: number;
  ghareebInBlock: number;
}

export interface UnmatchedWord {
  originalWord: string;
  normalizedWord: string;
  surah: number;
  ayah: number;
  wordIndex: number;
  page: number;
  reason: UnmatchedReason;
  meaningSource: MeaningSource;
}

export interface MatchingStats {
  ghareebTotal: number;
  matchedCount: number;
  unmatchedCount: number;
  meaningsMissing: number;
  unmatchedList: UnmatchedWord[];
}

export interface InspectedWord {
  originalWord: string;
  normalizedWord: string;
  identityKey: string;
  surah: number;
  ayah: number;
  wordIndex: number;
  page: number;
  matchedMeaningId: string | null;
  meaningPreview: string;
  meaningSource: MeaningSource;
}

export interface PageDiagnostics {
  pageNumber: number;
  dataVersions: {
    quranText: string;
    ghareebMeanings: string;
    pageMapping: string;
  };
  assembliesCount: number;
  expectedFirstVerse: string;
  expectedLastVerse: string;
  renderedFirstVerse: string;
  renderedLastVerse: string;
  missingVerseCount: number;
  assemblies: AssemblyBlock[];
  matchingStats: MatchingStats;
  snapshotTime: string;
}

interface DiagnosticPanelProps {
  page: QuranPage;
  pageNumber: number;
  ghareebWords: GhareebWord[];
  renderedWords: GhareebWord[];
  onInvalidateCache?: () => void;
  onForceRebuild?: () => void;
}

// ============= HELPER FUNCTIONS =============

function isSurahHeader(line: string): boolean {
  return line.startsWith('سُورَةُ') || line.startsWith('سورة ');
}

function isBismillah(line: string): boolean {
  return line.includes('بِسمِ اللَّهِ') || line.includes('بِسۡمِ ٱللَّهِ');
}

function extractSurahName(line: string): string {
  return line
    .replace(/^سُورَةُ\s*/, '')
    .replace(/^سورة\s*/, '')
    .trim();
}

function normalizeSurahName(name: string): string {
  return normalizeArabic(name).replace(/\s+/g, '');
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

function countTokens(text: string): number {
  const cleanText = text
    .replace(/[﴿﴾()[\]{}۝۞٭؟،۔]/g, '')
    .replace(/سُورَةُ\s+\S+/g, '')
    .replace(/سورة\s+\S+/g, '')
    .replace(/بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ/g, '');
  
  return cleanText.split(/\s+/).filter(t => t.trim().length > 0).length;
}

function extractVerseNumbers(text: string): number[] {
  const matches = text.match(/﴿(\d+)﴾/g);
  if (!matches) return [];
  return matches.map(m => parseInt(m.replace(/[﴿﴾]/g, '')));
}

function getMeaningSource(word: GhareebWord, userOverrides: any[]): MeaningSource {
  const hasOverride = userOverrides.some(o => o.key === word.uniqueKey);
  if (hasOverride) return 'overrides';
  if (word.meaning && word.meaning.trim()) return 'canonical';
  return 'none';
}

// ============= ANALYSIS ENGINE =============

function analyzePageDiagnostics(
  page: QuranPage,
  pageNumber: number,
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[],
  userOverrides: any[]
): PageDiagnostics {
  const lines = page.text.split('\n');
  const assemblies: AssemblyBlock[] = [];
  
  let currentSurah = page.surahName || 'غير محدد';
  let currentSurahNumber = 0;
  let blockStartLine = 0;
  let currentBlockLines: string[] = [];
  let blockId = 0;
  
  // Parse assemblies
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSurahHeader(line)) {
      if (currentBlockLines.length > 0) {
        assemblies.push(createAssemblyBlock(
          blockId++,
          currentSurah,
          currentSurahNumber,
          currentBlockLines,
          ghareebWords,
          renderedWords
        ));
        currentBlockLines = [];
      }
      
      currentSurah = extractSurahName(line);
      const matchedGhareeb = ghareebWords.find(gw => 
        normalizeSurahName(gw.surahName) === normalizeSurahName(currentSurah)
      );
      currentSurahNumber = matchedGhareeb?.surahNumber || 0;
      blockStartLine = i + 1;
    } else if (!isBismillah(line) && line.trim()) {
      currentBlockLines.push(line);
    }
  }
  
  // Add final block
  if (currentBlockLines.length > 0) {
    assemblies.push(createAssemblyBlock(
      blockId,
      currentSurah,
      currentSurahNumber,
      currentBlockLines,
      ghareebWords,
      renderedWords
    ));
  }
  
  // If no transitions, create single block
  if (assemblies.length === 0 && lines.length > 0) {
    assemblies.push({
      id: 'block-0',
      surahNumber: currentSurahNumber,
      surahName: currentSurah,
      ayahStart: 0,
      ayahEnd: 0,
      rendererType: ghareebWords.length > 0 ? 'WORD_SPANS' : 'PLAIN_TEXT',
      tokenCount: countTokens(page.text),
      highlightEnabled: ghareebWords.length > 0,
      fallbackReason: null,
      matchedCount: renderedWords.length,
      ghareebInBlock: ghareebWords.length,
    });
  }
  
  // Calculate matching stats
  const matchingStats = calculateMatchingStats(pageNumber, ghareebWords, renderedWords, userOverrides);
  
  // Extract verse info
  const allVerses = extractVerseNumbers(page.text);
  const firstVerse = allVerses.length > 0 ? allVerses[0] : 0;
  const lastVerse = allVerses.length > 0 ? allVerses[allVerses.length - 1] : 0;
  
  // Get rendered verse range
  const renderedVerses = renderedWords.map(w => w.verseNumber).filter(v => v > 0);
  const renderedFirst = renderedVerses.length > 0 ? Math.min(...renderedVerses) : 0;
  const renderedLast = renderedVerses.length > 0 ? Math.max(...renderedVerses) : 0;
  
  // Calculate expected vs actual
  const expectedRange = lastVerse - firstVerse + 1;
  const actualRange = allVerses.length;
  const missingCount = Math.max(0, expectedRange - actualRange);
  
  return {
    pageNumber,
    dataVersions: {
      quranText: `txt-${hashCode(page.text.slice(0, 100))}`,
      ghareebMeanings: `ghr-${ghareebWords.length}`,
      pageMapping: `map-v1.0`,
    },
    assembliesCount: assemblies.length,
    expectedFirstVerse: assemblies.length > 0 
      ? `${assemblies[0].surahName} ${assemblies[0].ayahStart}` 
      : `آية ${firstVerse}`,
    expectedLastVerse: assemblies.length > 0 
      ? `${assemblies[assemblies.length - 1].surahName} ${assemblies[assemblies.length - 1].ayahEnd}` 
      : `آية ${lastVerse}`,
    renderedFirstVerse: renderedFirst > 0 ? `آية ${renderedFirst}` : 'لا يوجد',
    renderedLastVerse: renderedLast > 0 ? `آية ${renderedLast}` : 'لا يوجد',
    missingVerseCount: missingCount,
    assemblies,
    matchingStats,
    snapshotTime: new Date().toLocaleTimeString('ar-EG'),
  };
}

function createAssemblyBlock(
  id: number,
  surahName: string,
  surahNumber: number,
  lines: string[],
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[]
): AssemblyBlock {
  const blockText = lines.join(' ');
  const tokenCount = countTokens(blockText);
  
  const normalizedSurah = normalizeSurahName(surahName);
  const ghareebInBlock = ghareebWords.filter(gw => 
    normalizeSurahName(gw.surahName) === normalizedSurah ||
    gw.surahNumber === surahNumber
  );
  
  const matchedInBlock = renderedWords.filter(rw =>
    normalizeSurahName(rw.surahName) === normalizedSurah ||
    rw.surahNumber === surahNumber
  );
  
  const ayahMatches = blockText.match(/﴿(\d+)﴾/g);
  let ayahStart = 0;
  let ayahEnd = 0;
  if (ayahMatches && ayahMatches.length > 0) {
    const ayahs = ayahMatches.map(m => parseInt(m.replace(/[﴿﴾]/g, '')));
    ayahStart = Math.min(...ayahs);
    ayahEnd = Math.max(...ayahs);
  }
  
  let rendererType: RendererType = 'WORD_SPANS';
  let fallbackReason: FallbackReason = null;
  
  if (ghareebInBlock.length === 0) {
    rendererType = 'PLAIN_TEXT';
  } else if (tokenCount === 0) {
    rendererType = 'PLAIN_TEXT';
    fallbackReason = 'TOKENIZE_ERROR';
  } else if (matchedInBlock.length === 0 && ghareebInBlock.length > 0) {
    fallbackReason = 'NORMALIZATION_MISMATCH';
  }
  
  return {
    id: `block-${id}`,
    surahNumber,
    surahName,
    ayahStart,
    ayahEnd,
    rendererType,
    tokenCount,
    highlightEnabled: ghareebInBlock.length > 0,
    fallbackReason,
    matchedCount: matchedInBlock.length,
    ghareebInBlock: ghareebInBlock.length,
  };
}

function calculateMatchingStats(
  pageNumber: number,
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[],
  userOverrides: any[]
): MatchingStats {
  const renderedKeys = new Set(renderedWords.map(w => w.uniqueKey));
  
  const unmatchedList: UnmatchedWord[] = [];
  let meaningsMissing = 0;
  
  for (const gw of ghareebWords) {
    if (!renderedKeys.has(gw.uniqueKey)) {
      let reason: UnmatchedReason = 'NO_TOKEN';
      const normalized = normalizeArabic(gw.wordText);
      if (!normalized || normalized.length < 2) {
        reason = 'NORMALIZATION_MISMATCH';
      }
      
      unmatchedList.push({
        originalWord: gw.wordText,
        normalizedWord: normalized,
        surah: gw.surahNumber,
        ayah: gw.verseNumber,
        wordIndex: gw.wordIndex,
        page: pageNumber,
        reason,
        meaningSource: getMeaningSource(gw, userOverrides),
      });
    } else {
      if (!gw.meaning || gw.meaning.trim() === '') {
        meaningsMissing++;
      }
    }
  }
  
  return {
    ghareebTotal: ghareebWords.length,
    matchedCount: renderedWords.length,
    unmatchedCount: unmatchedList.length,
    meaningsMissing,
    unmatchedList: unmatchedList.slice(0, 15),
  };
}

// ============= COMPONENT =============

export function DiagnosticPanel({
  page,
  pageNumber,
  ghareebWords,
  renderedWords,
  onInvalidateCache,
  onForceRebuild,
}: DiagnosticPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assembly' | 'matching' | 'inspect' | 'cache'>('assembly');
  const [inspectedWord, setInspectedWord] = useState<InspectedWord | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  
  const { userOverrides, addWordOverride } = useDataStore();
  
  // Analyze page
  const diagnostics = useMemo(() => {
    return analyzePageDiagnostics(page, pageNumber, ghareebWords, renderedWords, userOverrides);
  }, [page, pageNumber, ghareebWords, renderedWords, userOverrides]);
  
  // Handle word click for inspection
  const handleWordClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const ghareebEl = target.closest('[data-ghareeb-key]') as HTMLElement;
    
    if (ghareebEl && isOpen && activeTab === 'inspect') {
      const key = ghareebEl.dataset.ghareebKey || '';
      const word = ghareebWords.find(w => w.uniqueKey === key);
      
      if (word) {
        setInspectedWord({
          originalWord: word.wordText,
          normalizedWord: normalizeArabic(word.wordText),
          identityKey: word.uniqueKey,
          surah: word.surahNumber,
          ayah: word.verseNumber,
          wordIndex: word.wordIndex,
          page: word.pageNumber,
          matchedMeaningId: key,
          meaningPreview: word.meaning.slice(0, 60) + (word.meaning.length > 60 ? '...' : ''),
          meaningSource: getMeaningSource(word, userOverrides),
        });
      }
    }
  }, [ghareebWords, isOpen, activeTab, userOverrides]);
  
  useEffect(() => {
    if (isOpen && activeTab === 'inspect') {
      document.addEventListener('click', handleWordClick);
      return () => document.removeEventListener('click', handleWordClick);
    }
  }, [isOpen, activeTab, handleWordClick]);
  
  // One-click fix actions
  const handleRebindToCanonical = useCallback((word: InspectedWord) => {
    // Reset to canonical by removing any override
    const existingOverride = userOverrides.find(o => o.key === word.identityKey);
    if (existingOverride) {
      // Remove override to revert to canonical
      addWordOverride({
        key: word.identityKey,
        operation: 'delete',
        pageNumber: word.page,
      });
      toast.success('تم إعادة الربط للمعنى الأصلي');
    } else {
      toast.info('الكلمة مرتبطة بالمعنى الأصلي بالفعل');
    }
  }, [userOverrides, addWordOverride]);
  
  const handleShiftBinding = useCallback((word: InspectedWord, shift: number) => {
    const newWordIndex = Math.max(0, word.wordIndex + shift);
    addWordOverride({
      key: word.identityKey,
      operation: 'edit',
      pageNumber: word.page,
      wordText: word.originalWord,
      meaning: word.meaningPreview,
      surahNumber: word.surah,
      verseNumber: word.ayah,
      wordIndex: newWordIndex,
      surahName: '',
    });
    toast.success(`تم إزاحة الربط ${shift > 0 ? '+' : ''}${shift}`);
  }, [addWordOverride]);
  
  const toggleBlock = (blockId: string) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(blockId)) {
      newExpanded.delete(blockId);
    } else {
      newExpanded.add(blockId);
    }
    setExpandedBlocks(newExpanded);
  };
  
  const hasIssues = diagnostics.matchingStats.unmatchedCount > 0 || 
    diagnostics.assemblies.some(a => a.fallbackReason !== null) ||
    diagnostics.missingVerseCount > 0;
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant={hasIssues ? 'destructive' : 'outline'}
          className="gap-1 text-xs"
        >
          <Stethoscope className="w-3 h-3" />
          التشخيص
          {hasIssues && <AlertCircle className="w-3 h-3" />}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="w-[450px] sm:w-[500px]" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-arabic">
            <Stethoscope className="w-5 h-5" />
            لوحة التشخيص - صفحة {pageNumber}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-4 space-y-4">
          {/* Data Versions Header */}
          <div className="flex flex-wrap gap-1 text-[10px]">
            <Badge variant="outline">{diagnostics.dataVersions.quranText}</Badge>
            <Badge variant="outline">{diagnostics.dataVersions.ghareebMeanings}</Badge>
            <Badge variant="outline">{diagnostics.dataVersions.pageMapping}</Badge>
            <span className="text-muted-foreground mr-auto">
              {diagnostics.snapshotTime}
            </span>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-muted">
              <div className="font-bold text-lg">{diagnostics.assembliesCount}</div>
              <div className="text-muted-foreground">تجميعات</div>
            </div>
            <div className={`p-2 rounded ${diagnostics.matchingStats.unmatchedCount > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              <div className="font-bold text-lg">
                {diagnostics.matchingStats.matchedCount}/{diagnostics.matchingStats.ghareebTotal}
              </div>
              <div className="text-muted-foreground">مطابق</div>
            </div>
            <div className={`p-2 rounded ${diagnostics.missingVerseCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <div className="font-bold text-lg">{diagnostics.missingVerseCount}</div>
              <div className="text-muted-foreground">آيات ناقصة</div>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid grid-cols-4 h-8">
              <TabsTrigger value="assembly" className="text-xs gap-1 h-7">
                <Layers className="w-3 h-3" />
                التجميع
              </TabsTrigger>
              <TabsTrigger value="matching" className="text-xs gap-1 h-7">
                <Link2 className="w-3 h-3" />
                الربط
              </TabsTrigger>
              <TabsTrigger value="inspect" className="text-xs gap-1 h-7">
                <MousePointer className="w-3 h-3" />
                فحص
              </TabsTrigger>
              <TabsTrigger value="cache" className="text-xs gap-1 h-7">
                <Database className="w-3 h-3" />
                التحديث
              </TabsTrigger>
            </TabsList>
            
            {/* Assembly Tab */}
            <TabsContent value="assembly" className="mt-3 space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>أول آية متوقعة:</span>
                  <span className="font-mono">{diagnostics.expectedFirstVerse}</span>
                </div>
                <div className="flex justify-between">
                  <span>آخر آية متوقعة:</span>
                  <span className="font-mono">{diagnostics.expectedLastVerse}</span>
                </div>
              </div>
              
              <Separator />
              
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {diagnostics.assemblies.map((block) => (
                    <div
                      key={block.id}
                      className={`p-2 rounded border cursor-pointer ${
                        block.fallbackReason ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                      }`}
                      onClick={() => toggleBlock(block.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-arabic font-semibold text-sm">
                            {block.surahName}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {block.ayahStart}-{block.ayahEnd}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant={block.rendererType === 'WORD_SPANS' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {block.rendererType}
                          </Badge>
                          {block.highlightEnabled ? (
                            <CheckCircle className="w-3 h-3 text-primary" />
                          ) : (
                            <XCircle className="w-3 h-3 text-muted-foreground" />
                          )}
                          {expandedBlocks.has(block.id) ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                      
                      {expandedBlocks.has(block.id) && (
                        <div className="mt-2 pt-2 border-t text-[11px] space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">رقم السورة:</span>
                            <span>{block.surahNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">عدد التوكنات:</span>
                            <span>{block.tokenCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">مطابق:</span>
                            <span>{block.matchedCount}/{block.ghareebInBlock}</span>
                          </div>
                          {block.fallbackReason && (
                            <div className="text-destructive flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" />
                              {block.fallbackReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            {/* Matching Tab */}
            <TabsContent value="matching" className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded border">
                  <div className="text-muted-foreground">إجمالي الكلمات الغريبة</div>
                  <div className="font-bold">{diagnostics.matchingStats.ghareebTotal}</div>
                </div>
                <div className={`p-2 rounded border ${diagnostics.matchingStats.unmatchedCount > 0 ? 'border-destructive/50' : ''}`}>
                  <div className="text-muted-foreground">غير مطابق</div>
                  <div className="font-bold text-destructive">{diagnostics.matchingStats.unmatchedCount}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-muted-foreground">بدون معنى</div>
                  <div className="font-bold">{diagnostics.matchingStats.meaningsMissing}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-muted-foreground">نسبة النجاح</div>
                  <div className="font-bold">
                    {diagnostics.matchingStats.ghareebTotal > 0 
                      ? Math.round((diagnostics.matchingStats.matchedCount / diagnostics.matchingStats.ghareebTotal) * 100)
                      : 100}%
                  </div>
                </div>
              </div>
              
              {diagnostics.matchingStats.unmatchedList.length > 0 && (
                <>
                  <Separator />
                  <div className="text-xs font-semibold">أول {diagnostics.matchingStats.unmatchedList.length} كلمات غير مطابقة:</div>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2">
                      {diagnostics.matchingStats.unmatchedList.map((item, idx) => (
                        <div key={idx} className="p-2 rounded border border-destructive/30 bg-destructive/5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-arabic font-semibold">{item.originalWord}</span>
                            <Badge variant="outline" className="text-[9px]">{item.reason}</Badge>
                          </div>
                          <div className="text-muted-foreground text-[10px] mt-1">
                            <span>تطبيع: {item.normalizedWord}</span>
                            <span className="mx-2">•</span>
                            <span>{item.surah}:{item.ayah}:{item.wordIndex}</span>
                            <span className="mx-2">•</span>
                            <span>مصدر: {item.meaningSource}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
            
            {/* Inspect Tab */}
            <TabsContent value="inspect" className="mt-3 space-y-3">
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded flex items-center gap-2">
                <MousePointer className="w-4 h-4" />
                انقر على أي كلمة ملوّنة في القارئ لفحص تفاصيلها
              </div>
              
              {inspectedWord ? (
                <div className="space-y-3">
                  <div className="p-3 rounded border bg-card">
                    <div className="text-center mb-3">
                      <span className="font-arabic text-2xl font-bold text-primary">
                        {inspectedWord.originalWord}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">التطبيع:</span>
                        <span className="font-mono">{inspectedWord.normalizedWord}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المفتاح:</span>
                        <span className="font-mono text-[10px]">{inspectedWord.identityKey}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الموقع:</span>
                        <span>{inspectedWord.surah}:{inspectedWord.ayah}:{inspectedWord.wordIndex}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الصفحة:</span>
                        <span>{inspectedWord.page}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">مصدر المعنى:</span>
                        <Badge variant={inspectedWord.meaningSource === 'overrides' ? 'default' : 'secondary'} className="text-[10px]">
                          {inspectedWord.meaningSource}
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <span className="text-muted-foreground">المعنى:</span>
                        <div className="font-arabic mt-1 p-2 bg-muted rounded">
                          {inspectedWord.meaningPreview || 'لا يوجد معنى'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* One-click actions */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">إجراءات سريعة:</div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => handleRebindToCanonical(inspectedWord)}
                      >
                        <Undo2 className="w-3 h-3" />
                        إعادة للأصل
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => handleShiftBinding(inspectedWord, -1)}
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        إزاحة -1
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => handleShiftBinding(inspectedWord, +1)}
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        إزاحة +1
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  لم يتم تحديد كلمة
                </div>
              )}
            </TabsContent>
            
            {/* Cache Tab */}
            <TabsContent value="cache" className="mt-3 space-y-3">
              <div className="text-xs space-y-2">
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-muted-foreground">وقت اللقطة:</span>
                  <span>{diagnostics.snapshotTime}</span>
                </div>
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-muted-foreground">إصدار النص:</span>
                  <span className="font-mono">{diagnostics.dataVersions.quranText}</span>
                </div>
                <div className="flex justify-between p-2 rounded border">
                  <span className="text-muted-foreground">إصدار المعاني:</span>
                  <span className="font-mono">{diagnostics.dataVersions.ghareebMeanings}</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    onInvalidateCache?.();
                    toast.success('تم إبطال الذاكرة المؤقتة');
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  إبطال ذاكرة التخزين المؤقت لهذه الصفحة
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    onForceRebuild?.();
                    toast.success('جاري إعادة البناء من المصدر...');
                  }}
                >
                  <FileText className="w-4 h-4" />
                  إعادة بناء الصفحة من فهرس التنزيل
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
