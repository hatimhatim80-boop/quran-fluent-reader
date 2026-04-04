/**
 * Ghareeb-portal-only auto-scroll helper.
 * Scrolls content ONLY when the active word or meaning frame
 * would be hidden behind the bottom action bar.
 */

const DEBUG = false; // flip to true during dev, remove in production

interface ScrollCheckResult {
  needed: boolean;
  scrollDelta: number;
  target: 'word' | 'meaning' | 'none';
  targetBottom: number;
  safeVisibleBottom: number;
}

/** Get the bottom bar height from a scroll container's parent */
function getBottomBarHeight(scrollContainer: HTMLElement): number {
  const parent = scrollContainer.parentElement;
  if (!parent) return 0;

  // Try known action bar selector
  const actionBar = parent.querySelector<HTMLElement>(
    '.border-t.border-border, [data-ghareeb-bottom-bar]'
  );
  if (actionBar) return actionBar.getBoundingClientRect().height;

  // Fallback: sum heights of siblings after the scroll container
  const children = Array.from(parent.children);
  const scIdx = children.indexOf(scrollContainer);
  let h = 0;
  for (let i = scIdx + 1; i < children.length; i++) {
    h += (children[i] as HTMLElement).getBoundingClientRect().height;
  }
  return h || 0;
}

/** Get the safe-area inset at the bottom (for notched phones) */
function getSafeAreaBottom(): number {
  const val = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
  return parseFloat(val) || 0;
}

/** Find the scroll container for a given element */
export function findGhareebScrollParent(el: HTMLElement): HTMLElement | null {
  // data attribute first
  const tagged = el.closest<HTMLElement>('[data-review-scroll-container="true"]');
  if (tagged) return tagged;
  // walk up
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const s = getComputedStyle(node);
    if (/(auto|scroll)/.test(s.overflow) || /(auto|scroll)/.test(s.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Check if an element is hidden behind the bottom bar and compute
 * the minimum scroll delta needed to reveal it.
 */
function checkVisibility(
  target: HTMLElement,
  scrollContainer: HTMLElement,
  extraMargin = 12
): ScrollCheckResult {
  const scRect = scrollContainer.getBoundingClientRect();
  const bottomBarH = getBottomBarHeight(scrollContainer);
  const safeInset = getSafeAreaBottom();
  const bottomSafeZone = bottomBarH + safeInset + extraMargin;
  const safeVisibleBottom = scRect.bottom - bottomSafeZone;

  const tRect = target.getBoundingClientRect();

  // Also check if above viewport (scrolled past)
  const isAbove = tRect.bottom < scRect.top + 10;
  const isBelow = tRect.bottom > safeVisibleBottom;

  const needed = isAbove || isBelow;
  let scrollDelta = 0;
  if (isBelow) {
    // Scroll down just enough to bring target.bottom to safeVisibleBottom
    scrollDelta = tRect.bottom - safeVisibleBottom;
  } else if (isAbove) {
    // Scroll up to bring target into view near top
    scrollDelta = tRect.top - scRect.top - 20;
  }

  return {
    needed,
    scrollDelta,
    target: 'word',
    targetBottom: tRect.bottom,
    safeVisibleBottom,
  };
}

/** Anti-bounce guard: don't re-scroll within 300ms */
let lastScrollTime = 0;
const SCROLL_COOLDOWN = 300;

/**
 * Main entry: ensure the ghareeb word + its meaning frame are visible
 * above the bottom bar. Scrolls only the minimum amount needed.
 *
 * @param wordEl - the highlighted word/phrase element
 * @param meaningEl - the meaning popover/tooltip/frame (optional)
 * @param wordKey - for debug logging
 */
export function ensureGhareebMeaningVisibleAboveBottomBar(
  wordEl: HTMLElement | null,
  meaningEl: HTMLElement | null,
  wordKey?: string
): void {
  if (!wordEl) return;

  const scrollContainer = findGhareebScrollParent(wordEl);
  if (!scrollContainer) return;

  const now = Date.now();
  if (now - lastScrollTime < SCROLL_COOLDOWN) return;

  // Check meaning frame first (it's usually below the word)
  const primaryTarget = meaningEl || wordEl;
  const wordCheck = checkVisibility(wordEl, scrollContainer);
  const meaningCheck = meaningEl ? checkVisibility(meaningEl, scrollContainer) : null;

  // Determine if scroll is needed
  const needScroll = wordCheck.needed || (meaningCheck?.needed ?? false);

  if (DEBUG) {
    console.log('[GhareebAutoScroll]', {
      wordKey,
      target: meaningCheck?.needed ? 'meaning' : wordCheck.needed ? 'word' : 'none',
      wordBottom: wordCheck.targetBottom,
      meaningBottom: meaningCheck?.targetBottom,
      safeVisibleBottom: wordCheck.safeVisibleBottom,
      wordDelta: wordCheck.scrollDelta,
      meaningDelta: meaningCheck?.scrollDelta,
      scrollExecuted: needScroll,
    });
  }

  if (!needScroll) return;

  lastScrollTime = now;

  // Pick the largest delta needed (meaning is usually lower)
  let delta = wordCheck.scrollDelta;
  if (meaningCheck && meaningCheck.needed) {
    delta = Math.max(delta, meaningCheck.scrollDelta);
  }

  // If meaning frame is very tall, don't try to show all of it—
  // show its top + ~200px max
  if (meaningEl) {
    const mRect = meaningEl.getBoundingClientRect();
    if (mRect.height > 250) {
      const scRect = scrollContainer.getBoundingClientRect();
      const bottomBarH = getBottomBarHeight(scrollContainer) + getSafeAreaBottom() + 12;
      const safeBottom = scRect.bottom - bottomBarH;
      // Just make sure top ~200px of meaning is visible
      const desiredBottom = mRect.top + 200;
      if (desiredBottom > safeBottom) {
        delta = desiredBottom - safeBottom;
      } else if (!wordCheck.needed) {
        return; // top part visible, word visible, done
      }
    }
  }

  // Scroll by minimum delta
  scrollContainer.scrollTo({
    top: scrollContainer.scrollTop + delta,
    behavior: 'smooth',
  });
}
