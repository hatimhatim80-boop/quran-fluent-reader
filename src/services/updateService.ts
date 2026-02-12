/**
 * Update Service — checks a remote manifest, downloads new data, stores in IndexedDB.
 */
import { getMeta, setMeta, storeData } from './offlineDatabase';

export interface ManifestFile {
  key: string;
  url: string;
  sha256?: string;
}

export interface UpdateManifest {
  version: number;
  updatedAt: string;
  files: ManifestFile[];
}

export interface UpdateProgress {
  phase: 'checking' | 'downloading' | 'done' | 'error' | 'up-to-date';
  current: number;
  total: number;
  message: string;
}

// Default manifest URL — can be overridden in settings
const DEFAULT_MANIFEST_URL = '/updates/manifest.json';

/**
 * Get the currently stored manifest version (0 = never updated).
 */
export async function getLocalVersion(): Promise<number> {
  const v = await getMeta('manifestVersion');
  return typeof v === 'number' ? v : 0;
}

/**
 * Get last update timestamp.
 */
export async function getLastUpdated(): Promise<string | null> {
  const v = await getMeta('lastUpdated');
  return typeof v === 'string' ? v : null;
}

/**
 * Get last check timestamp.
 */
export async function getLastChecked(): Promise<string | null> {
  const v = await getMeta('lastChecked');
  return typeof v === 'string' ? v : null;
}

/**
 * Check for updates and download new data.
 * @param manifestUrl Override the default manifest URL
 * @param onProgress Callback for progress updates
 * @returns true if updated, false if already up-to-date
 */
export async function checkAndUpdate(
  manifestUrl: string = DEFAULT_MANIFEST_URL,
  onProgress?: (p: UpdateProgress) => void,
): Promise<boolean> {
  const report = (p: UpdateProgress) => onProgress?.(p);

  try {
    // 1. Fetch manifest
    report({ phase: 'checking', current: 0, total: 0, message: 'جاري التحقق من التحديثات...' });

    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);

    const manifest: UpdateManifest = await res.json();
    await setMeta('lastChecked', new Date().toISOString());

    // 2. Compare versions
    const localVersion = await getLocalVersion();
    if (manifest.version <= localVersion) {
      report({ phase: 'up-to-date', current: 0, total: 0, message: 'البيانات محدّثة بالفعل' });
      return false;
    }

    // 3. Download files
    const total = manifest.files.length;
    for (let i = 0; i < total; i++) {
      const file = manifest.files[i];
      report({
        phase: 'downloading',
        current: i + 1,
        total,
        message: `تحميل ${file.key} (${i + 1}/${total})...`,
      });

      const fileRes = await fetch(file.url, { cache: 'no-cache' });
      if (!fileRes.ok) throw new Error(`Failed to download ${file.key}: ${fileRes.status}`);

      const data = await fileRes.text();

      // Optional SHA-256 verification
      if (file.sha256) {
        const hash = await computeSHA256(data);
        if (hash !== file.sha256) {
          throw new Error(`SHA-256 mismatch for ${file.key}`);
        }
      }

      await storeData(file.key, data, manifest.version);
    }

    // 4. Save metadata
    await setMeta('manifestVersion', manifest.version);
    await setMeta('lastUpdated', new Date().toISOString());

    report({ phase: 'done', current: total, total, message: 'تم التحديث بنجاح!' });
    return true;
  } catch (error: any) {
    report({
      phase: 'error',
      current: 0,
      total: 0,
      message: `فشل التحديث: ${error.message || 'خطأ غير معروف'}`,
    });
    throw error;
  }
}

/**
 * Compute SHA-256 hash of a string (hex-encoded).
 */
async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
