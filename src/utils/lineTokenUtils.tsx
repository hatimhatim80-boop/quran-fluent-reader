import React from 'react';

/**
 * Formats bismillah text by using hair spaces for minimal separation.
 */
export function formatBismillah(text: string): string {
  return text.replace(/\s+/g, '\u200A');
}

/**
 * Check if we should use no-justify mode (mobile with redistribution)
 */
export function shouldNoJustify(mobileLinesPerPage: number, desktopLinesPerPage: number): boolean {
  if (typeof window === 'undefined') return false;
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
  
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const nextEl = elements[i + 1];
    
    // Check if next element is a verse number
    if (nextEl && isVerseNumberElement(nextEl)) {
      // Wrap current word + verse number + next word together
      const group: React.ReactNode[] = [el];
      let j = i + 1;
      // Collect spaces and the verse number
      while (j < elements.length && (isSpaceElement(elements[j]) || isVerseNumberElement(elements[j]))) {
        group.push(elements[j]);
        if (isVerseNumberElement(elements[j])) {
          j++;
          break;
        }
        j++;
      }
      // Also collect the next word after the verse number (spaces + first non-space element)
      while (j < elements.length && isSpaceElement(elements[j])) {
        group.push(elements[j]);
        j++;
      }
      if (j < elements.length && !isVerseNumberElement(elements[j])) {
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
