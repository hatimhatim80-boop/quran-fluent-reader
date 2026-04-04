/**
 * Ghareeb-portal-only auto-scroll helper.
 * Scrolls content ONLY when the active word or meaning frame
 * would be hidden behind the bottom action bar.
 *
 * Rules:
 * - No scroll if element is fully within [safeTop, safeBottom]
 * - safeBottom = top of bottom bar − margin (measured live via getBoundingClientRect)
 * - Minimum delta threshold to avoid micro-scrolls
 * - Debounce to prevent loops/jitter
 */

/** Minimum scroll delta to bother scrolling (px) */
const MIN_SCROLL_DELTA = 16;

/** Anti-bounce guard: don't re-scroll within this window */
const SCROLL_COOLDOWN = 350;
let lastScrollTime = 0;
let lastScrolledKey: string | null = null;

/**
 * Find the real bottom bar / action panel that overlaps the scroll area.
 * Searches the DOM for known Ghareeb bottom-bar elements.
 */
function findBottomBarTop(scrollContainer: HTMLElement): number | null {
  // 1) Explicit data attribute
  const tagged = document.querySelector<HTMLElement>('[data-ghareeb-bottom-bar]');
  if (tagged) return tagged.getBoundingClientRect().top;

  // 2) Walk up from scroll container and find fixed/sticky siblings below it
  const parent = scrollContainer.parentElement;
  if (!parent) return null;

  const children = Array.from(parent.children) as HTMLElement[];
  const scIdx = children.indexOf(scrollContainer);
  let topmost: number | null = null;

  for (let i = scIdx + 1; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (rect.height < 2) continue; // skip invisible
    const t = rect.top;
    if (topmost === null || t < topmost) topmost = t;
  }

  // 3) Also check for common fixed bottom bars outside the parent
  if (topmost === null) {
    const fixedBars = document.querySelectorAll<HTMLElement>(
      '.border-t.border-border, [class*="fixed"][class*="bottom"], [class*="sticky"][class*="bottom"]'
    );
    for (const bar of fixedBars) {
      // Make sure it's actually at the bottom area
      const r = bar.getBoundingClientRect();
      if (r.height < 10) continue;
      if (r.top > window.innerHeight * 0.5) {
        if (topmost === null || r.top < topmost) topmost = r.top;
      }
    }
  }

  return topmost;
}

/** Get the safe-area inset at the bottom (for notched phones) */
function getSafeAreaBottom(): number {
  const val = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
  return parseFloat(val) || 0;
}

/** Find the scroll container for a given element */
export function findGhareebScrollParent(el: HTMLElement): HTMLElement | null {
  const tagged = el.closest<HTMLElement>('[data-review-scroll-container="true"]');
  if (tagged) return tagged;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const s = getComputedStyle(node);
    if (/(auto|scroll)/.test(s.overflow) || /(auto|scroll)/.test(s.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Main entry: ensure the ghareeb word + its meaning frame are visible
 * above the bottom bar. Scrolls only the minimum amount needed.
 * Does NOT scroll if elements are already fully visible.
 */
export function ensureGhareebMeaningVisibleAboveBottomBar(
  wordEl: HTMLElement | null,
  meaningEl: HTMLElement | null,
  wordKey?: string
): void {
  if (!wordEl) return;

  const scrollContainer = findGhareebScrollParent(wordEl);
  if (!scrollContainer) return;

  // Cooldown: don't re-scroll for same key within window
  const now = Date.now();
  if (now - lastScrollTime < SCROLL_COOLDOWN && lastScrolledKey === (wordKey || '')) return;

  const scRect = scrollContainer.getBoundingClientRect();
  const safeTop = scRect.top;
  const extraMargin = 14;
  const safeAreaBottom = getSafeAreaBottom();

  // Compute safeBottom from real bottom bar position
  const bottomBarTop = findBottomBarTop(scrollContainer);
  const safeBottom = bottomBarTop !== null
    ? bottomBarTop - extraMargin - safeAreaBottom
    : scRect.bottom - extraMargin; // fallback: bottom of scroll container

  // Determine the primary target to keep visible
  // Check both word and meaning, use the one that extends furthest down
  const wordRect = wordEl.getBoundingClientRect();
  const meaningRect = meaningEl?.getBoundingClientRect() ?? null;

  // Find the element whose bottom is furthest down (most likely to be hidden)
  let targetBottom = wordRect.bottom;
  let targetTop = wordRect.top;
  let targetLabel: 'word' | 'meaning' = 'word';

  if (meaningRect && meaningRect.height > 0) {
    // For very tall meaning frames, cap at top + 220px
    const effectiveMeaningBottom = meaningRect.height > 250
      ? meaningRect.top + 220
      : meaningRect.bottom;

    if (effectiveMeaningBottom > targetBottom) {
      targetBottom = effectiveMeaningBottom;
      targetLabel = 'meaning';
    }
    // Also ensure meaning top is visible
    if (meaningRect.top < targetTop) {
      targetTop = meaningRect.top;
    }
  }

  // Check: is the target fully within the safe zone?
  const hiddenBelow = targetBottom > safeBottom;
  const hiddenAbove = targetTop < safeTop;

  if (!hiddenBelow && !hiddenAbove) {
    // Everything visible — no scroll needed
    return;
  }

  // Compute minimum delta
  let delta = 0;
  if (hiddenBelow) {
    delta = targetBottom - safeBottom;
  } else if (hiddenAbove) {
    delta = targetTop - safeTop - 20; // negative = scroll up
  }

  // Skip micro-scrolls
  if (Math.abs(delta) < MIN_SCROLL_DELTA) return;

  // Execute scroll
  lastScrollTime = now;
  lastScrolledKey = wordKey || '';

  scrollContainer.scrollTo({
    top: scrollContainer.scrollTop + delta,
    behavior: 'smooth',
  });
}
