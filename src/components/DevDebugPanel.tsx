import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  Link2,
  MousePointer,
  Database,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Clock,
  Trash2,
  ArrowRightLeft,
  Save,
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

export interface AssemblyBlock {
  id: string;
  surahRange: string;
  ayahRange: string;
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
  position: string;
  reason: UnmatchedReason;
  surah?: number;
  ayah?: number;
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
  matchedMeaningId: string | null;
  meaningPreview: string;
  surah?: number;
  ayah?: number;
  wordIndex?: number;
  tokenIndex?: number;
  assemblyId?: string;
}

interface DevDebugPanelProps {
  page: QuranPage;
  pageNumber: number;
  ghareebWords: GhareebWord[];
  renderedWords: GhareebWord[];
  onInvalidateCache?: () => void;
  mappingVersionId?: string;
}

// ============= GLOBAL EVENT FOR WORD SELECTION =============

// Custom event for word inspection
export const DEV_INSPECT_WORD_EVENT = 'dev-debug-inspect-word';

export interface DevInspectWordDetail {
  uniqueKey: string;
  originalWord: string;
  surahNumber: number;
  verseNumber: number;
  wordIndex: number;
  meaning: string;
  tokenIndex?: number;
  assemblyId?: string;
  matchedMeaningId?: string;
  meaningPreview?: string;
  selectionSource?: string;
}

// Helper to dispatch inspection event from anywhere
export function dispatchWordInspection(detail: DevInspectWordDetail) {
  window.dispatchEvent(new CustomEvent(DEV_INSPECT_WORD_EVENT, { detail }));
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

// ============= ANALYSIS ENGINE =============

function analyzePageAssembly(
  page: QuranPage,
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[]
): {
  assemblies: AssemblyBlock[];
  matchingStats: MatchingStats;
  dataVersions: { quranText: string; ghareeb: string; mapping: string };
} {
  const lines = page.text.split('\n');
  const assemblies: AssemblyBlock[] = [];
  
  let currentSurah = page.surahName || 'غير محدد';
  let currentSurahNumber = 0;
  let blockStartLine = 0;
  let currentBlockLines: string[] = [];
  let blockId = 0;
  
  // Track surah transitions for assembly blocks
  const surahTransitions: { lineIdx: number; surahName: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSurahHeader(line)) {
      // Close previous block if exists
      if (currentBlockLines.length > 0) {
        assemblies.push(createAssemblyBlock(
          blockId++,
          currentSurah,
          currentSurahNumber,
          currentBlockLines,
          ghareebWords,
          renderedWords,
          blockStartLine
        ));
        currentBlockLines = [];
      }
      
      currentSurah = extractSurahName(line);
      const matchedGhareeb = ghareebWords.find(gw => 
        normalizeSurahName(gw.surahName) === normalizeSurahName(currentSurah)
      );
      currentSurahNumber = matchedGhareeb?.surahNumber || 0;
      blockStartLine = i + 1;
      
      surahTransitions.push({ lineIdx: i, surahName: currentSurah });
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
      renderedWords,
      blockStartLine
    ));
  }
  
  // If no transitions found, create a single block
  if (assemblies.length === 0 && lines.length > 0) {
    assemblies.push({
      id: 'block-0',
      surahRange: currentSurah,
      ayahRange: 'كامل',
      rendererType: ghareebWords.length > 0 ? 'WORD_SPANS' : 'PLAIN_TEXT',
      tokenCount: countTokens(page.text),
      highlightEnabled: ghareebWords.length > 0,
      fallbackReason: null,
      matchedCount: renderedWords.length,
      ghareebInBlock: ghareebWords.length,
    });
  }
  
  // Calculate matching stats
  const matchingStats = calculateMatchingStats(ghareebWords, renderedWords);
  
  // Generate version IDs (summary identifiers only)
  const dataVersions = {
    quranText: `hash-${hashCode(page.text.slice(0, 100))}`,
    ghareeb: `count-${ghareebWords.length}-${Date.now().toString(36).slice(-4)}`,
    mapping: 'page-mapping.json',
  };
  
  return { assemblies, matchingStats, dataVersions };
}

function createAssemblyBlock(
  id: number,
  surahName: string,
  surahNumber: number,
  lines: string[],
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[],
  startLine: number
): AssemblyBlock {
  const blockText = lines.join(' ');
  const tokenCount = countTokens(blockText);
  
  // Find ghareeb words that belong to this surah
  const normalizedSurah = normalizeSurahName(surahName);
  const ghareebInBlock = ghareebWords.filter(gw => 
    normalizeSurahName(gw.surahName) === normalizedSurah ||
    gw.surahNumber === surahNumber
  );
  
  const matchedInBlock = renderedWords.filter(rw =>
    normalizeSurahName(rw.surahName) === normalizedSurah ||
    rw.surahNumber === surahNumber
  );
  
  // Determine ayah range from verse markers
  const ayahMatches = blockText.match(/﴿(\d+)﴾/g);
  let ayahRange = 'غير محدد';
  if (ayahMatches && ayahMatches.length > 0) {
    const ayahs = ayahMatches.map(m => parseInt(m.replace(/[﴿﴾]/g, '')));
    const minAyah = Math.min(...ayahs);
    const maxAyah = Math.max(...ayahs);
    ayahRange = minAyah === maxAyah ? `${minAyah}` : `${minAyah}-${maxAyah}`;
  }
  
  // Determine renderer type and fallback reason
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
    surahRange: `${surahName} (${surahNumber || '?'})`,
    ayahRange,
    rendererType,
    tokenCount,
    highlightEnabled: ghareebInBlock.length > 0,
    fallbackReason,
    matchedCount: matchedInBlock.length,
    ghareebInBlock: ghareebInBlock.length,
  };
}

function countTokens(text: string): number {
  const cleanText = text
    .replace(/[﴿﴾()[\]{}۝۞٭؟،۔]/g, '')
    .replace(/سُورَةُ\s+\S+/g, '')
    .replace(/سورة\s+\S+/g, '')
    .replace(/بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ/g, '');
  
  return cleanText.split(/\s+/).filter(t => t.trim().length > 0).length;
}

function calculateMatchingStats(
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[]
): MatchingStats {
  const renderedKeys = new Set(renderedWords.map(w => w.uniqueKey));
  
  const unmatchedList: UnmatchedWord[] = [];
  let meaningsMissing = 0;
  
  for (const gw of ghareebWords) {
    if (!renderedKeys.has(gw.uniqueKey)) {
      // Determine reason
      let reason: UnmatchedReason = 'NO_TOKEN';
      
      // Check if normalized word is problematic
      const normalized = normalizeArabic(gw.wordText);
      if (!normalized || normalized.length < 2) {
        reason = 'NORMALIZATION_MISMATCH';
      }
      
      unmatchedList.push({
        originalWord: gw.wordText,
        normalizedWord: normalized,
        position: `${gw.surahNumber}:${gw.verseNumber}:${gw.wordIndex}`,
        reason,
        surah: gw.surahNumber,
        ayah: gw.verseNumber,
      });
    } else {
      // Check if meaning is missing
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
    unmatchedList: unmatchedList.slice(0, 10), // First 10
  };
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

// ============= INSPECT TAB WITH EDITING ACTIONS =============

interface InspectTabContentProps {
  inspectedWord: InspectedWord | null;
  lastSelectionEvent: string | null;
  reassignMode: boolean;
  setReassignMode: (mode: boolean) => void;
  pendingReassignTarget: string | null;
  pageNumber: number;
  ghareebWords: GhareebWord[];
  renderedWords: GhareebWord[];
  onInvalidateCache?: () => void;
  setInspectedWord: (word: InspectedWord | null) => void;
}

function InspectTabContent({
  inspectedWord,
  lastSelectionEvent,
  reassignMode,
  setReassignMode,
  pendingReassignTarget,
  pageNumber,
  ghareebWords,
  renderedWords,
  onInvalidateCache,
  setInspectedWord,
}: InspectTabContentProps) {
  const addWordOverride = useDataStore((s) => s.addWordOverride);
  const deleteWordOverride = useDataStore((s) => s.deleteWordOverride);
  const getOverrideByKey = useDataStore((s) => s.getOverrideByKey);
  
  // Handle: Remove Ghareeb highlight from this word
  const handleRemoveHighlight = useCallback(() => {
    if (!inspectedWord) return;
    
    // Add a "delete" override for this word
    addWordOverride({
      key: inspectedWord.identityKey,
      pageNumber,
      wordText: inspectedWord.originalWord,
      meaning: '',
      surahNumber: inspectedWord.surah,
      verseNumber: inspectedWord.ayah,
      wordIndex: inspectedWord.wordIndex,
      operation: 'delete',
    });
    
    toast.success('تم إزالة التمييز', {
      description: `الكلمة "${inspectedWord.originalWord}" لن تظهر كغريبة`,
    });
    
    // Refresh view
    onInvalidateCache?.();
    setInspectedWord(null);
  }, [inspectedWord, pageNumber, addWordOverride, onInvalidateCache, setInspectedWord]);
  
  // Handle: Reassign meaning to another word
  const handleReassignMeaning = useCallback(() => {
    if (!inspectedWord || !pendingReassignTarget) {
      toast.error('اختر الكلمة الهدف أولاً');
      return;
    }
    
    // Find target word details
    const targetWord = renderedWords.find(w => w.uniqueKey === pendingReassignTarget) ||
                       ghareebWords.find(w => w.uniqueKey === pendingReassignTarget);
    
    if (!targetWord) {
      toast.error('لم يتم العثور على الكلمة الهدف');
      return;
    }
    
    // Step 1: Delete the source (remove highlight from "إن")
    addWordOverride({
      key: inspectedWord.identityKey,
      pageNumber,
      wordText: inspectedWord.originalWord,
      meaning: '',
      surahNumber: inspectedWord.surah,
      verseNumber: inspectedWord.ayah,
      wordIndex: inspectedWord.wordIndex,
      operation: 'delete',
    });
    
    // Step 2: Add/edit the target word with the meaning
    // Parse target key to get its position
    const targetParts = pendingReassignTarget.split('_');
    const targetSurah = parseInt(targetParts[0]) || targetWord.surahNumber;
    const targetAyah = parseInt(targetParts[1]) || targetWord.verseNumber;
    const targetWordIdx = parseInt(targetParts[2]) || targetWord.wordIndex;
    
    addWordOverride({
      key: pendingReassignTarget,
      pageNumber,
      wordText: targetWord.wordText,
      meaning: inspectedWord.meaningPreview?.replace('...', '') || '',
      surahNumber: targetSurah,
      verseNumber: targetAyah,
      wordIndex: targetWordIdx,
      operation: 'add',
    });
    
    toast.success('تم نقل المعنى', {
      description: `نُقل المعنى من "${inspectedWord.originalWord}" إلى "${targetWord.wordText}"`,
    });
    
    // Refresh view
    onInvalidateCache?.();
    setInspectedWord(null);
  }, [inspectedWord, pendingReassignTarget, renderedWords, ghareebWords, pageNumber, addWordOverride, onInvalidateCache, setInspectedWord]);
  
  // Check if current word has override
  const existingOverride = inspectedWord ? getOverrideByKey(inspectedWord.identityKey) : undefined;
  
  return (
    <>
      <div className="p-2 rounded bg-muted/50 border border-dashed">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MousePointer className="w-3 h-3" />
          <span>
            {reassignMode 
              ? '🎯 وضع النقل: انقر على الكلمة الهدف'
              : 'Click or long-press any highlighted word to inspect'}
          </span>
        </div>
      </div>
      
      {/* Selection Event Status */}
      <div className="flex items-center gap-2 text-[10px] px-1">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">Last selection:</span>
        <span className={lastSelectionEvent ? 'text-primary' : 'text-muted-foreground'}>
          {lastSelectionEvent || 'none'}
        </span>
      </div>
      
      {inspectedWord ? (
        <div className="p-3 rounded border bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-arabic text-lg" dir="rtl">{inspectedWord.originalWord}</span>
            <Badge variant="outline" className="text-[9px]">{inspectedWord.identityKey}</Badge>
          </div>
          
          {existingOverride && (
            <Badge variant="secondary" className="text-[9px]">
              ⚠️ يوجد تعديل سابق: {existingOverride.operation}
            </Badge>
          )}
          
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">Normalized:</span>
              <div className="font-arabic" dir="rtl">{inspectedWord.normalizedWord}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Position:</span>
              <div>{inspectedWord.surah}:{inspectedWord.ayah}:{inspectedWord.wordIndex}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">Assembly:</span>
              <div className="font-mono">{inspectedWord.assemblyId || 'unknown'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Token Index:</span>
              <div className="font-mono">{inspectedWord.tokenIndex ?? 'N/A'}</div>
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground text-[10px]">Meaning ID:</span>
            <div className="font-mono text-[10px] break-all">{inspectedWord.matchedMeaningId || 'null'}</div>
          </div>
          
          <div>
            <span className="text-muted-foreground text-[10px]">Meaning Preview:</span>
            <div className="font-arabic text-sm p-1.5 bg-muted rounded" dir="rtl">
              {inspectedWord.meaningPreview || 'لا يوجد معنى'}
            </div>
          </div>
          
          {/* DEV-ONLY Editing Actions */}
          <div className="border-t pt-2 mt-2 space-y-2">
            <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Save className="w-3 h-3" />
              DEV Actions (persisted to overrides)
            </div>
            
            {/* Action 1: Remove Highlight */}
            <Button
              size="sm"
              variant="destructive"
              className="w-full h-7 text-[10px] gap-1"
              onClick={handleRemoveHighlight}
            >
              <Trash2 className="w-3 h-3" />
              إزالة التمييز من هذه الكلمة
            </Button>
            
            {/* Action 2: Reassign Meaning */}
            <div className="space-y-1">
              <Button
                size="sm"
                variant={reassignMode ? 'default' : 'outline'}
                className="w-full h-7 text-[10px] gap-1"
                onClick={() => setReassignMode(!reassignMode)}
              >
                <ArrowRightLeft className="w-3 h-3" />
                {reassignMode ? '🎯 في انتظار اختيار الهدف...' : 'نقل المعنى إلى كلمة أخرى'}
              </Button>
              
              {pendingReassignTarget && (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">الهدف:</span>
                  <Badge variant="secondary" className="text-[9px]">{pendingReassignTarget}</Badge>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-5 text-[9px] px-2 ml-auto"
                    onClick={handleReassignMeaning}
                  >
                    تأكيد النقل
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>لم يتم تحديد كلمة</span>
          <span className="text-[10px]">Click a highlighted word in the mushaf</span>
        </div>
      )}
    </>
  );
}

// ============= COMPONENT =============

export function DevDebugPanel({
  page,
  pageNumber,
  ghareebWords,
  renderedWords,
  onInvalidateCache,
  mappingVersionId,
}: DevDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assembly' | 'matching' | 'inspect'>('assembly');
  const [inspectedWord, setInspectedWord] = useState<InspectedWord | null>(null);
  const [lastSelectionEvent, setLastSelectionEvent] = useState<string | null>(null);
  const [snapshotTime, setSnapshotTime] = useState<string>(new Date().toLocaleTimeString('ar-EG'));
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // DEV-only editing state
  const [reassignMode, setReassignMode] = useState(false);
  const [pendingReassignTarget, setPendingReassignTarget] = useState<string | null>(null);
  
  // Listen for reassign target selection
  useEffect(() => {
    if (!reassignMode) return;
    
    const handleReassignTarget = (e: CustomEvent<DevInspectWordDetail>) => {
      const detail = e.detail;
      // If in reassign mode, capture this as the target
      setPendingReassignTarget(detail.uniqueKey);
      setReassignMode(false);
      toast.info(`اختيار الهدف: ${detail.originalWord}`, {
        description: `المفتاح: ${detail.uniqueKey}`,
      });
    };
    
    window.addEventListener(DEV_INSPECT_WORD_EVENT as any, handleReassignTarget);
    return () => window.removeEventListener(DEV_INSPECT_WORD_EVENT as any, handleReassignTarget);
  }, [reassignMode]);
  
  // Analyze page
  const analysis = useMemo(() => {
    return analyzePageAssembly(page, ghareebWords, renderedWords);
  }, [page, ghareebWords, renderedWords]);
  
  // Helper to find and set inspected word
  const inspectWordByKey = useCallback((key: string, source: string = 'click') => {
    const word = ghareebWords.find(w => w.uniqueKey === key) || 
                 renderedWords.find(w => w.uniqueKey === key);
    
    if (word) {
      const timestamp = new Date().toLocaleTimeString('ar-EG');
      setLastSelectionEvent(`${source} @ ${timestamp}`);
      setInspectedWord({
        originalWord: word.wordText,
        normalizedWord: normalizeArabic(word.wordText),
        identityKey: word.uniqueKey,
        matchedMeaningId: key,
        meaningPreview: word.meaning?.slice(0, 60) + (word.meaning?.length > 60 ? '...' : '') || 'لا يوجد',
        surah: word.surahNumber,
        ayah: word.verseNumber,
        wordIndex: word.wordIndex,
        tokenIndex: renderedWords.findIndex(w => w.uniqueKey === key),
        assemblyId: `block-${word.surahNumber}`,
      });
      
      // Auto-switch to inspect tab
      if (isOpen) {
        setActiveTab('inspect');
      }
      
      return true;
    }
    return false;
  }, [ghareebWords, renderedWords, isOpen]);
  
  // Handle DOM click with data-ghareeb-key attribute
  const handleDOMWordClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const ghareebEl = target.closest('[data-ghareeb-key]') as HTMLElement;
    
    if (ghareebEl) {
      const key = ghareebEl.dataset.ghareebKey || '';
      if (key) {
        inspectWordByKey(key, 'click');
      }
    }
  }, [inspectWordByKey]);
  
  // Handle long-press for mobile
  const handlePointerDown = useCallback((event: PointerEvent) => {
    const target = event.target as HTMLElement;
    const ghareebEl = target.closest('[data-ghareeb-key]') as HTMLElement;
    
    if (ghareebEl) {
      const key = ghareebEl.dataset.ghareebKey || '';
      if (key) {
        longPressTimer.current = setTimeout(() => {
          inspectWordByKey(key, 'long-press');
        }, 500);
      }
    }
  }, [inspectWordByKey]);
  
  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  
  // Listen for custom inspection events (from GhareebWordPopover)
  useEffect(() => {
    const handleCustomInspect = (e: CustomEvent<DevInspectWordDetail>) => {
      const detail = e.detail;
      const timestamp = new Date().toLocaleTimeString('ar-EG');
      const source = detail.selectionSource || 'event';

      setLastSelectionEvent(`${source} @ ${timestamp}`);

      const preview =
        detail.meaningPreview ??
        (detail.meaning
          ? detail.meaning.slice(0, 60) + (detail.meaning.length > 60 ? '...' : '')
          : '');

      setInspectedWord({
        originalWord: detail.originalWord,
        normalizedWord: normalizeArabic(detail.originalWord),
        identityKey: detail.uniqueKey,
        matchedMeaningId: detail.matchedMeaningId ?? detail.uniqueKey,
        meaningPreview: preview || 'لا يوجد',
        surah: detail.surahNumber,
        ayah: detail.verseNumber,
        wordIndex: detail.wordIndex,
        tokenIndex: detail.tokenIndex,
        assemblyId: detail.assemblyId ?? 'unknown',
      });

      if (isOpen) {
        setActiveTab('inspect');
      }
    };
    
    window.addEventListener(DEV_INSPECT_WORD_EVENT as any, handleCustomInspect);
    return () => window.removeEventListener(DEV_INSPECT_WORD_EVENT as any, handleCustomInspect);
  }, [isOpen]);
  
  // Listen for DOM clicks when panel is open (best-effort; global overlay also emits events)
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleDOMWordClick, true);
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('pointerup', handlePointerUp, true);
      document.addEventListener('pointercancel', handlePointerUp, true);

      return () => {
        document.removeEventListener('click', handleDOMWordClick, true);
        document.removeEventListener('pointerdown', handlePointerDown, true);
        document.removeEventListener('pointerup', handlePointerUp, true);
        document.removeEventListener('pointercancel', handlePointerUp, true);
      };
    }
  }, [isOpen, handleDOMWordClick, handlePointerDown, handlePointerUp]);
  
  // Cleanup long-press timer
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);
  
  // Refresh snapshot time
  const handleRefresh = useCallback(() => {
    setSnapshotTime(new Date().toLocaleTimeString('ar-EG'));
    onInvalidateCache?.();
  }, [onInvalidateCache]);
  
  // Status indicators
  const hasIssues = analysis.matchingStats.unmatchedCount > 0 || 
    analysis.assemblies.some(a => a.fallbackReason !== null);
  
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          size="sm"
          variant={hasIssues ? 'destructive' : 'outline'}
          className="gap-1 font-mono text-xs"
        >
          <Bug className="w-3 h-3" />
          DEV Debug
          {hasIssues && <AlertCircle className="w-3 h-3" />}
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="border rounded-lg bg-card text-card-foreground p-3 space-y-3 text-xs font-mono" dir="ltr">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Page {pageNumber}</Badge>
              <Badge variant="secondary">{analysis.dataVersions.quranText}</Badge>
              <Badge variant="secondary">{analysis.dataVersions.ghareeb}</Badge>
              <Badge variant="secondary">{mappingVersionId || analysis.dataVersions.mapping}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Snapshot: {snapshotTime}</span>
              <Button size="sm" variant="ghost" onClick={handleRefresh} className="h-6 px-2">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid grid-cols-3 h-7">
              <TabsTrigger value="assembly" className="text-xs gap-1 h-6">
                <Layers className="w-3 h-3" />
                Assembly
              </TabsTrigger>
              <TabsTrigger value="matching" className="text-xs gap-1 h-6">
                <Link2 className="w-3 h-3" />
                Matching
              </TabsTrigger>
              <TabsTrigger value="inspect" className="text-xs gap-1 h-6">
                <MousePointer className="w-3 h-3" />
                Inspect
              </TabsTrigger>
            </TabsList>
            
            {/* Assembly Tab */}
            <TabsContent value="assembly" className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="w-3 h-3" />
                <span>Assemblies: {analysis.assemblies.length}</span>
              </div>
              
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {analysis.assemblies.map((block) => (
                    <div
                      key={block.id}
                      className={`p-2 rounded border ${
                        block.fallbackReason ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{block.id}</span>
                        <div className="flex gap-1">
                          <Badge 
                            variant={block.rendererType === 'WORD_SPANS' ? 'default' : 'secondary'}
                            className="text-[10px] h-4"
                          >
                            {block.rendererType}
                          </Badge>
                          {block.highlightEnabled ? (
                            <CheckCircle className="w-3 h-3 text-primary" />
                          ) : (
                            <XCircle className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                        <span>Surah: {block.surahRange}</span>
                        <span>Ayah: {block.ayahRange}</span>
                        <span>Tokens: {block.tokenCount}</span>
                        <span>Matched: {block.matchedCount}/{block.ghareebInBlock}</span>
                      </div>
                      
                      {block.fallbackReason && (
                        <div className="mt-1 text-destructive text-[10px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Fallback: {block.fallbackReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            {/* Matching Tab */}
            <TabsContent value="matching" className="mt-2 space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded bg-muted text-center">
                  <div className="text-lg font-bold">{analysis.matchingStats.ghareebTotal}</div>
                  <div className="text-[10px] text-muted-foreground">Total Ghareeb</div>
                </div>
                <div className="p-2 rounded bg-primary/10 text-center">
                  <div className="text-lg font-bold text-primary">
                    {analysis.matchingStats.matchedCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Matched</div>
                </div>
                <div className={`p-2 rounded text-center ${
                  analysis.matchingStats.unmatchedCount > 0 ? 'bg-destructive/10' : 'bg-muted'
                }`}>
                  <div className={`text-lg font-bold ${
                    analysis.matchingStats.unmatchedCount > 0 ? 'text-destructive' : ''
                  }`}>
                    {analysis.matchingStats.unmatchedCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Unmatched</div>
                </div>
                <div className={`p-2 rounded text-center ${
                  analysis.matchingStats.meaningsMissing > 0 ? 'bg-secondary' : 'bg-muted'
                }`}>
                  <div className={`text-lg font-bold ${
                    analysis.matchingStats.meaningsMissing > 0 ? 'text-secondary-foreground' : ''
                  }`}>
                    {analysis.matchingStats.meaningsMissing}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Missing Meaning</div>
                </div>
              </div>
              
              {analysis.matchingStats.unmatchedList.length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    First 10 Unmatched:
                  </div>
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-1">
                      {analysis.matchingStats.unmatchedList.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="p-1.5 rounded bg-destructive/5 border border-destructive/20 text-[10px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-arabic text-sm" dir="rtl">{item.originalWord}</span>
                            <Badge variant="destructive" className="text-[8px] h-4">
                              {item.reason}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            Normalized: "{item.normalizedWord}" | Pos: {item.position}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {analysis.matchingStats.unmatchedCount === 0 && (
                <div className="flex items-center justify-center gap-2 py-4 text-primary">
                  <CheckCircle className="w-4 h-4" />
                  All ghareeb words matched successfully!
                </div>
              )}
            </TabsContent>
            
            {/* Inspect Tab */}
            <TabsContent value="inspect" className="mt-2 space-y-2">
              <InspectTabContent
                inspectedWord={inspectedWord}
                lastSelectionEvent={lastSelectionEvent}
                reassignMode={reassignMode}
                setReassignMode={setReassignMode}
                pendingReassignTarget={pendingReassignTarget}
                pageNumber={pageNumber}
                ghareebWords={ghareebWords}
                renderedWords={renderedWords}
                onInvalidateCache={onInvalidateCache}
                setInspectedWord={setInspectedWord}
              />
            </TabsContent>
          </Tabs>
          
          {/* Cache Controls */}
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px]">
              Editor snapshot: {snapshotTime}
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              className="h-6 text-[10px] gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Invalidate Cache
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
