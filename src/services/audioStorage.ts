/**
 * Persistent binary store for recitation files.
 *
 * On Android/iOS (Capacitor) the files live in the app's private data
 * directory through @capacitor/filesystem, so they survive app restarts and
 * app updates and are NEVER bundled inside the APK.
 * On the web the same API is backed by IndexedDB.
 *
 * The rest of the app only sees opaque `key` strings, so the storage backend
 * can change without touching the review session or the audio provider.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'quran-audio';
const BLOB_STORE = 'files';
const META_STORE = 'meta';
const ROOT_DIR = 'recitations';

export const isNativeStorage = (): boolean => Capacitor.isNativePlatform();

// ── IndexedDB backend (web) ─────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      },
    });
  }
  return dbPromise;
}

// ── Native helpers ──────────────────────────────────────────────────────────

/** A storage key maps 1:1 onto a private file path. */
function keyToPath(key: string): string {
  return `${ROOT_DIR}/${key.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '/')}.mp3`;
}

async function ensureDir(path: string) {
  const dir = path.slice(0, path.lastIndexOf('/'));
  try {
    await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true });
  } catch {
    /* already exists */
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.slice(res.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface StoredAudioInfo {
  key: string;
  size: number;
}

/** Saves a downloaded file. Returns false when the write failed. */
export async function saveAudio(key: string, blob: Blob): Promise<boolean> {
  try {
    if (isNativeStorage()) {
      const path = keyToPath(key);
      await ensureDir(path);
      await Filesystem.writeFile({
        path,
        directory: Directory.Data,
        data: await blobToBase64(blob),
      });
      return true;
    }
    const db = await getDB();
    await db.put(BLOB_STORE, blob, key);
    return true;
  } catch {
    return false;
  }
}

/** Size in bytes of the stored file, or 0 when it does not exist. */
export async function audioSize(key: string): Promise<number> {
  try {
    if (isNativeStorage()) {
      const stat = await Filesystem.stat({ path: keyToPath(key), directory: Directory.Data });
      return Number(stat.size) || 0;
    }
    const db = await getDB();
    const blob = (await db.get(BLOB_STORE, key)) as Blob | undefined;
    return blob?.size ?? 0;
  } catch {
    return 0;
  }
}

/** Smallest size we accept as a real mp3 ayah file. */
export const MIN_AUDIO_BYTES = 2048;

/** True only when a *valid looking* file is really present on the device. */
export async function hasValidAudio(key: string): Promise<boolean> {
  return (await audioSize(key)) >= MIN_AUDIO_BYTES;
}

/** A URL playable by an <audio> element, or null when nothing is stored. */
export async function localAudioUrl(key: string): Promise<string | null> {
  try {
    if (isNativeStorage()) {
      if (!(await hasValidAudio(key))) return null;
      const { uri } = await Filesystem.getUri({ path: keyToPath(key), directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    }
    const db = await getDB();
    const blob = (await db.get(BLOB_STORE, key)) as Blob | undefined;
    if (!blob || blob.size < MIN_AUDIO_BYTES) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** True when the returned URL is an object URL that must be revoked. */
export function isRevocableUrl(url: string): boolean {
  return url.startsWith('blob:');
}

export async function deleteAudio(key: string): Promise<void> {
  try {
    if (isNativeStorage()) {
      await Filesystem.deleteFile({ path: keyToPath(key), directory: Directory.Data });
      return;
    }
    const db = await getDB();
    await db.delete(BLOB_STORE, key);
  } catch {
    /* nothing to delete */
  }
}

/** Counts stored files whose key starts with the given prefix. */
export async function countAudio(prefix: string, candidateKeys?: string[]): Promise<number> {
  if (isNativeStorage()) {
    if (!candidateKeys) return 0;
    let n = 0;
    for (const k of candidateKeys) if (await hasValidAudio(k)) n++;
    return n;
  }
  try {
    const db = await getDB();
    const keys = (await db.getAllKeys(BLOB_STORE)) as string[];
    return keys.filter(k => k.startsWith(prefix)).length;
  } catch {
    return 0;
  }
}

/** Removes every file of one reciter package. */
export async function deleteAudioPrefix(prefix: string, candidateKeys?: string[]): Promise<void> {
  if (isNativeStorage()) {
    const safe = prefix.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '/');
    try {
      await Filesystem.rmdir({ path: `${ROOT_DIR}/${safe}`, directory: Directory.Data, recursive: true });
      return;
    } catch {
      for (const k of candidateKeys || []) await deleteAudio(k);
      return;
    }
  }
  try {
    const db = await getDB();
    const keys = (await db.getAllKeys(BLOB_STORE)) as string[];
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    await Promise.all(keys.filter(k => k.startsWith(prefix)).map(k => tx.store.delete(k)));
    await tx.done;
  } catch {
    /* ignore */
  }
}

// ── Small JSON metadata store (download state) ──────────────────────────────

export async function readMeta<T>(key: string): Promise<T | null> {
  try {
    if (isNativeStorage()) {
      const res = await Filesystem.readFile({
        path: `${ROOT_DIR}/meta/${key}.json`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(String(res.data)) as T;
    }
    const db = await getDB();
    return ((await db.get(META_STORE, key)) as T) ?? null;
  } catch {
    return null;
  }
}

export async function writeMeta<T>(key: string, value: T): Promise<void> {
  try {
    if (isNativeStorage()) {
      const path = `${ROOT_DIR}/meta/${key}.json`;
      await ensureDir(path);
      await Filesystem.writeFile({
        path,
        directory: Directory.Data,
        data: JSON.stringify(value),
        encoding: Encoding.UTF8,
      });
      return;
    }
    const db = await getDB();
    await db.put(META_STORE, value, key);
  } catch {
    /* ignore */
  }
}
