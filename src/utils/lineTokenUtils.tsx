import React from 'react';

/**
 * Formats bismillah text by using hair spaces for minimal separation.
 */
export function formatBismillah(text: string): string {
  return text.replace(/\s+/g, '\u200A');
}

/**
 * Check if we should use no-justify mode (mobile with redistribution)
 * Only applies when user hasn't explicitly set text alignment to justify
 */
export function shouldNoJustify(mobileLinesPerPage: number, desktopLinesPerPage: number, textAlign?: string): boolean {
  if (typeof window === 'undefined') return false;
  // If user explicitly chose justify, never override it
  if (textAlign === 'justify') return false;
  const isMobile = window.innerWidth < 768;
  return isMobile && mobileLinesPerPage < 15;
}

/**
 * Post-processes an array of React line elements to:
 * 1. Wrap verse-number spans with the preceding word in a nowrap container
 * 2. Bind last two word elements together to prevent orphan lines
 * 
 * Works by scanning the flat element array for elements with className containing "verse-number"
 * and wrapping them with the preceding non-space element.
 */
export function bindVerseNumbers(
  elements: React.ReactNode[],
  lineIdx: number
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  
  // First, find indices of all verse-number elements
  const verseNumberIndices = new Set<number>();
  elements.forEach((el, i) => {
    if (isVerseNumberElement(el)) verseNumberIndices.add(i);
  });
  
  // Find indices of spaces directly adjacent to verse numbers (to skip them)
  const skipIndices = new Set<number>();
  verseNumberIndices.forEach(vi => {
    // Skip space before verse number
    if (vi > 0 && isSpaceElement(elements[vi - 1])) skipIndices.add(vi - 1);
    // Skip space after verse number
    if (vi < elements.length - 1 && isSpaceElement(elements[vi + 1])) skipIndices.add(vi + 1);
  });

  for (let i = 0; i < elements.length; i++) {
    if (skipIndices.has(i)) continue; // skip spaces adjacent to verse numbers
    
    const el = elements[i];
    
    // Check if next non-skip element is a verse number
    let nextIdx = i + 1;
    while (nextIdx < elements.length && skipIndices.has(nextIdx)) nextIdx++;
    
    if (nextIdx < elements.length && isVerseNumberElement(elements[nextIdx])) {
      // Wrap: current word + verse number (no spaces between)
      const group: React.ReactNode[] = [el, elements[nextIdx]];
      let j = nextIdx + 1;
      // Skip the space after verse number (already in skipIndices)
      while (j < elements.length && skipIndices.has(j)) j++;
      // Also bind the next word after verse number
      if (j < elements.length && !isVerseNumberElement(elements[j]) && !isSpaceElement(elements[j])) {
        group.push(elements[j]);
        j++;
      }
      result.push(
        <span key={`ayah-wrap-${lineIdx}-${i}`} className="ayah-end-wrapper">
          {group}
        </span>
      );
      i = j - 1;
    } else {
      result.push(el);
    }
  }
  
  return result;
}

/**
 * Simplified version for TahfeezQuizView and TahfeezSelectionView
 */
export function bindVerseNumbersSimple(
  elements: React.ReactNode[],
  lineIdx: number
): React.ReactNode[] {
  return bindVerseNumbers(elements, lineIdx);
}

function isVerseNumberElement(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false;
  const props = el.props as any;
  return typeof props?.className === 'string' && props.className.includes('verse-number');
}

function isSpaceElement(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false;
  const props = el.props as any;
  const children = props?.children;
  return typeof children === 'string' && /^\s+$/.test(children) && !props.className;
}
