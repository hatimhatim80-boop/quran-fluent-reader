/**
 * Global Audit System for DevDebug
 * 
 * Scans all pages for issues:
 * - PLAIN_TEXT fallback pages
 * - tokensCount == 0
 * - Unmatched ghareeb words
 * - Missing meanings
 * - Inspect integrity failures (normalized empty)
 * - Stale cache indicators
 */

import { QuranPage, GhareebWord } from '@/types/quran';
import { normalizeArabic } from '@/utils/quranParser';
import { useHighlightOverrideStore } from '@/stores/highlightOverrideStore';

// ============= TYPES =============

export type AuditIssueType =
  | 'PLAIN_TEXT_FALLBACK'
  | 'ZERO_TOKENS'
  | 'UNMATCHED_GHAREEB'
  | 'MISSING_MEANING'
  | 'EMPTY_NORMALIZED'
  | 'HIGHLIGHT_NO_MEANING'
  | 'STALE_OVERRIDE'
  | 'STOPWORD_HIGHLIGHTED';

export interface AuditIssue {
  type: AuditIssueType;
  pageNumber: number;
  severity: 'error' | 'warning' | 'info';
  description: string;
  details: Record<string, unknown>;
  wordKey?: string;
  wordText?: string;
}

export interface PageAuditResult {
  pageNumber: number;
  issues: AuditIssue[];
  stats: {
    ghareebTotal: number;
    matchedCount: number;
    unmatchedCount: number;
    meaningsMissing: number;
    tokensCount: number;
    rendererType: 'WORD_SPANS' | 'PLAIN_TEXT';
  };
}

export interface GlobalAuditResult {
  totalPages: number;
  scannedPages: number;
  totalIssues: number;
  issuesByType: Record<AuditIssueType, number>;
  pagesWithIssues: number[];
  pageResults: PageAuditResult[];
  timestamp: string;
}

// ============= STOPWORDS LIST =============

/**
 * Arabic particles and stopwords that should NOT be highlighted
 * These are common prepositions, conjunctions, and particles
 */
export const ARABIC_STOPWORDS = new Set([
  // Prepositions
  'من', 'إلى', 'على', 'في', 'عن', 'مع', 'ل', 'ب', 'ك',
  // Conjunctions
  'و', 'ف', 'ثم', 'أو', 'أم', 'بل', 'لكن', 'حتى',
  // Particles
  'إن', 'أن', 'إذا', 'إذ', 'لو', 'لولا', 'لما', 'ما', 'لا', 'لم', 'لن',
  'قد', 'هل', 'أ', 'يا', 'أي', 'أيا', 'هذا', 'هذه', 'ذلك', 'تلك',
  // Common pronouns (attached forms handled separately)
  'هو', 'هي', 'هم', 'هن', 'أنت', 'أنتم', 'أنتن', 'أنا', 'نحن',
  // Demonstratives
  'الذي', 'التي', 'الذين', 'اللذان', 'اللتان', 'اللاتي', 'اللائي',
  // Others
  'كل', 'بعض', 'غير', 'سوى', 'كان', 'كانت', 'كانوا', 'يكون', 'تكون',
]);

/**
 * Check if a word is a stopword (should not be highlighted)
 */
export function isStopword(word: string): boolean {
  const normalized = normalizeArabic(word).trim();
  
  // Check exact match
  if (ARABIC_STOPWORDS.has(normalized)) {
    return true;
  }
  
  // Check if it's a very short word (1-2 letters are usually particles)
  if (normalized.length <= 2) {
    return true;
  }
  
  return false;
}

// ============= AUDIT ENGINE =============

/**
 * Count tokens in a text block
 */
function countTokens(text: string): number {
  const cleanText = text
    .replace(/[﴿﴾()[\\\]{}۝۞٭؟،۔ۣۖۗۘۙۚۛۜ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]/g, '')
    .replace(/سُورَةُ\s+\S+/g, '')
    .replace(/سورة\s+\S+/g, '')
    .replace(/بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ/g, '');
  
  return cleanText.split(/\s+/).filter(t => t.trim().length > 0).length;
}

/**
 * Audit a single page
 */
export function auditPage(
  page: QuranPage,
  ghareebWords: GhareebWord[],
  renderedWords: GhareebWord[],
  overrides?: ReturnType<typeof useHighlightOverrideStore.getState>['overrides']
): PageAuditResult {
  const issues: AuditIssue[] = [];
  const tokensCount = countTokens(page.text);
  
  // Check for zero tokens
  if (tokensCount === 0) {
    issues.push({
      type: 'ZERO_TOKENS',
      pageNumber: page.pageNumber,
      severity: 'error',
      description: 'Page has zero tokenizable content',
      details: { textLength: page.text.length },
    });
  }
  
  // Determine renderer type
  const rendererType = ghareebWords.length > 0 && renderedWords.length > 0 
    ? 'WORD_SPANS' 
    : 'PLAIN_TEXT';
  
  // Check for PLAIN_TEXT fallback when ghareeb expected
  if (ghareebWords.length > 0 && renderedWords.length === 0) {
    issues.push({
      type: 'PLAIN_TEXT_FALLBACK',
      pageNumber: page.pageNumber,
      severity: 'warning',
      description: 'Page fell back to PLAIN_TEXT despite having ghareeb words',
      details: { 
        ghareebCount: ghareebWords.length,
        renderedCount: renderedWords.length,
      },
    });
  }
  
  // Track matched keys for unmatched detection
  const renderedKeys = new Set(renderedWords.map(w => w.uniqueKey));
  let unmatchedCount = 0;
  let meaningsMissing = 0;
  
  // Check each ghareeb word
  for (const gw of ghareebWords) {
    const normalized = normalizeArabic(gw.wordText);
    
    // Check for empty normalized
    if (!normalized || normalized.trim().length === 0) {
      issues.push({
        type: 'EMPTY_NORMALIZED',
        pageNumber: page.pageNumber,
        severity: 'error',
        description: `Word "${gw.wordText}" normalizes to empty string`,
        details: { 
          originalWord: gw.wordText,
          uniqueKey: gw.uniqueKey,
        },
        wordKey: gw.uniqueKey,
        wordText: gw.wordText,
      });
    }
    
    // Check for unmatched
    if (!renderedKeys.has(gw.uniqueKey)) {
      unmatchedCount++;
      issues.push({
        type: 'UNMATCHED_GHAREEB',
        pageNumber: page.pageNumber,
        severity: 'warning',
        description: `Ghareeb word "${gw.wordText}" not found in rendered output`,
        details: {
          originalWord: gw.wordText,
          normalizedWord: normalized,
          uniqueKey: gw.uniqueKey,
          surah: gw.surahNumber,
          ayah: gw.verseNumber,
        },
        wordKey: gw.uniqueKey,
        wordText: gw.wordText,
      });
    }
    
    // Check for missing meaning
    if (!gw.meaning || gw.meaning.trim() === '') {
      meaningsMissing++;
      issues.push({
        type: 'MISSING_MEANING',
        pageNumber: page.pageNumber,
        severity: 'warning',
        description: `Word "${gw.wordText}" has no meaning defined`,
        details: {
          uniqueKey: gw.uniqueKey,
        },
        wordKey: gw.uniqueKey,
        wordText: gw.wordText,
      });
    }
    
    // Check for stopword that shouldn't be highlighted
    if (isStopword(gw.wordText)) {
      issues.push({
        type: 'STOPWORD_HIGHLIGHTED',
        pageNumber: page.pageNumber,
        severity: 'info',
        description: `"${gw.wordText}" is a stopword/particle and probably shouldn't be highlighted`,
        details: {
          word: gw.wordText,
          normalized,
          uniqueKey: gw.uniqueKey,
        },
        wordKey: gw.uniqueKey,
        wordText: gw.wordText,
      });
    }
  }
  
  // Check overrides for issues
  if (overrides) {
    const pageOverrides = overrides.filter(o => o.pageNumber === page.pageNumber);
    
    for (const override of pageOverrides) {
      // Check for highlight without meaning
      if (override.highlight && !override.meaningText && !override.meaningId && !override.meaning) {
        issues.push({
          type: 'HIGHLIGHT_NO_MEANING',
          pageNumber: page.pageNumber,
          severity: 'error',
          description: `Override for "${override.wordText}" has highlight but no meaning`,
          details: {
            positionKey: override.positionKey,
            identityKey: override.identityKey,
            createdAt: override.createdAt,
          },
          wordKey: override.identityKey,
          wordText: override.wordText,
        });
      }
      
      // Check for stale override (word no longer exists in rendered)
      const stillExists = renderedWords.some(w => 
        w.uniqueKey === override.identityKey || 
        `${w.surahNumber}_${w.verseNumber}_${w.wordIndex}` === override.identityKey
      );
      
      if (!stillExists && override.highlight) {
        issues.push({
          type: 'STALE_OVERRIDE',
          pageNumber: page.pageNumber,
          severity: 'info',
          description: `Override for "${override.wordText}" may be stale (word not found in current render)`,
          details: {
            positionKey: override.positionKey,
            identityKey: override.identityKey,
          },
          wordKey: override.identityKey,
          wordText: override.wordText,
        });
      }
    }
  }
  
  return {
    pageNumber: page.pageNumber,
    issues,
    stats: {
      ghareebTotal: ghareebWords.length,
      matchedCount: renderedWords.length,
      unmatchedCount,
      meaningsMissing,
      tokensCount,
      rendererType,
    },
  };
}

/**
 * Run global audit across all pages
 */
export async function runGlobalAudit(
  pages: QuranPage[],
  getGhareebForPage: (pageNum: number) => GhareebWord[],
  getRenderedForPage: (pageNum: number) => GhareebWord[],
  overrides?: ReturnType<typeof useHighlightOverrideStore.getState>['overrides'],
  onProgress?: (current: number, total: number) => void
): Promise<GlobalAuditResult> {
  const pageResults: PageAuditResult[] = [];
  const issuesByType: Record<AuditIssueType, number> = {
    PLAIN_TEXT_FALLBACK: 0,
    ZERO_TOKENS: 0,
    UNMATCHED_GHAREEB: 0,
    MISSING_MEANING: 0,
    EMPTY_NORMALIZED: 0,
    HIGHLIGHT_NO_MEANING: 0,
    STALE_OVERRIDE: 0,
    STOPWORD_HIGHLIGHTED: 0,
  };
  const pagesWithIssues: number[] = [];
  let totalIssues = 0;
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const ghareeb = getGhareebForPage(page.pageNumber);
    const rendered = getRenderedForPage(page.pageNumber);
    
    const result = auditPage(page, ghareeb, rendered, overrides);
    pageResults.push(result);
    
    if (result.issues.length > 0) {
      pagesWithIssues.push(page.pageNumber);
      totalIssues += result.issues.length;
      
      for (const issue of result.issues) {
        issuesByType[issue.type]++;
      }
    }
    
    onProgress?.(i + 1, pages.length);
    
    // Yield to UI every 50 pages
    if (i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return {
    totalPages: pages.length,
    scannedPages: pages.length,
    totalIssues,
    issuesByType,
    pagesWithIssues,
    pageResults,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Export audit results as JSON
 */
export function exportAuditResults(result: GlobalAuditResult): string {
  return JSON.stringify({
    version: '1.0',
    type: 'global-audit-report',
    ...result,
  }, null, 2);
}

/**
 * Get summary statistics from audit result
 */
export function getAuditSummary(result: GlobalAuditResult): {
  healthScore: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  topIssueTypes: { type: AuditIssueType; count: number }[];
} {
  let criticalIssues = 0;
  let warningIssues = 0;
  let infoIssues = 0;
  
  for (const pageResult of result.pageResults) {
    for (const issue of pageResult.issues) {
      switch (issue.severity) {
        case 'error':
          criticalIssues++;
          break;
        case 'warning':
          warningIssues++;
          break;
        case 'info':
          infoIssues++;
          break;
      }
    }
  }
  
  // Calculate health score (100 = perfect, 0 = all issues)
  const maxIssues = result.totalPages * 10; // Assume max 10 issues per page
  const healthScore = Math.max(0, Math.min(100, 
    100 - (criticalIssues * 5 + warningIssues * 2 + infoIssues) / maxIssues * 100
  ));
  
  // Get top issue types
  const topIssueTypes = Object.entries(result.issuesByType)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type: type as AuditIssueType, count }));
  
  return {
    healthScore: Math.round(healthScore),
    criticalIssues,
    warningIssues,
    infoIssues,
    topIssueTypes,
  };
}
