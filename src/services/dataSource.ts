/**
 * Unified DataSource — offline-first data access layer.
 *
 * Priority:
 *   1. IndexedDB (latest updated copy)
 *   2. Bundled /data/* files (shipped with the build)
 */
import { getStoredData } from './offlineDatabase';

/** Map of data keys to their bundled file paths */
const BUNDLED_PATHS: Record<string, string> = {
  'mushaf': '/data/mushaf.txt',
  'ghareeb': '/data/ghareeb-words.txt',
  'tanzil-metadata': '/data/tanzil-metadata.xml',
  'quran-tanzil': '/data/quran-tanzil.txt',
  'page-mapping': '/data/page-mapping.json',
};

/**
 * Get data by key. Checks IndexedDB first, then falls back to bundled file.
 */
export async function getData(key: string): Promise<string> {
  // 1. Try IndexedDB
  try {
    const cached = await getStoredData(key);
    if (cached) {
      console.log(`[DataSource] "${key}" loaded from IndexedDB`);
      return cached;
    }
  } catch (e) {
    console.warn(`[DataSource] IndexedDB read failed for "${key}":`, e);
  }

  // 2. Fall back to bundled file
  return fetchBundled(key);
}

/**
 * Fetch the bundled (shipped) version of a data file.
 */
export async function fetchBundled(key: string): Promise<string> {
  const path = BUNDLED_PATHS[key];
  if (!path) throw new Error(`[DataSource] Unknown data key: "${key}"`);

  const response = await fetch(path);
  if (!response.ok) throw new Error(`[DataSource] Failed to fetch bundled "${key}" (${response.status})`);

  const text = await response.text();
  console.log(`[DataSource] "${key}" loaded from bundled file`);
  return text;
}

/**
 * Get all registered data keys
 */
export function getDataKeys(): string[] {
  return Object.keys(BUNDLED_PATHS);
}
