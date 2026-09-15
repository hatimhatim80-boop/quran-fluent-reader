/**
 * QuranAudioProvider — an independent audio layer for the app.
 *
 * Responsibilities:
 *  - Resolve a stable remote URL for an exact (reciter, surah, ayah) in the
 *    Hafs ʿan ʿĀṣim narration.
 *  - Cache downloaded ayah files inside IndexedDB so playback works offline
 *    (files are NEVER bundled inside the APK).
 *  - Provide a resumable/pausable download manager with repair support.
 *
 * Audio is fully decoupled from text reveal: nothing here touches session
 * state, reveal progress or card ratings.
 */

import { openDB, IDBPDatabase } from 'idb';
import type { AyahRef } from '@/utils/pageAyahRefs';

const DB_NAME = 'quran-audio';
const STORE = 'files';

export interface Reciter {
  id: string;
  /** everyayah.com folder name — Hafs narration, verse-by-verse files. */
  dir: string;
  name: string;
  narration: string;
}

/** All entries are the Hafs narration, one file per ayah. */
export const RECITERS: Reciter[] = [
  { id: 'husary', dir: 'Husary_128kbps', name: 'محمود خليل الحصري', narration: 'حفص عن عاصم' },
  { id: 'alafasy', dir: 'Alafasy_128kbps', name: 'مشاري راشد العفاسي', narration: 'حفص عن عاصم' },
  { id: 'abdulbasit', dir: 'Abdul_Basit_Murattal_192kbps', name: 'عبد الباسط (مرتل)', narration: 'حفص عن عاصم' },
  { id: 'minshawy', dir: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي (مرتل)', narration: 'حفص عن عاصم' },
  { id: 'sudais', dir: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبد الرحمن السديس', narration: 'حفص عن عاصم' },
];

export const DEFAULT_RECITER_ID = 'husary';

export function getReciter(id: string | undefined): Reciter {
  return RECITERS.find(r => r.id === id) || RECITERS[0];
}

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Canonical file id — guarantees reciter/surah/ayah always stay matched. */
export function ayahKey(reciterId: string, ref: AyahRef): string {
  return `${reciterId}:${pad3(ref.surah)}${pad3(ref.ayah)}`;
}

export function remoteAyahUrl(reciterId: string, ref: AyahRef): string {
  const rec = getReciter(reciterId);
  return `https://everyayah.com/data/${rec.dir}/${pad3(ref.surah)}${pad3(ref.ayah)}.mp3`;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function getLocalBlob(reciterId: string, ref: AyahRef): Promise<Blob | null> {
  try {
    const db = await getDB();
    return ((await db.get(STORE, ayahKey(reciterId, ref))) as Blob) ?? null;
  } catch {
    return null;
  }
}

export async function hasLocal(reciterId: string, ref: AyahRef): Promise<boolean> {
  try {
    const db = await getDB();
    const key = ayahKey(reciterId, ref);
    const count = await db.count(STORE, IDBKeyRange.only(key));
    return count > 0;
  } catch {
    return false;
  }
}

async function saveBlob(reciterId: string, ref: AyahRef, blob: Blob) {
  const db = await getDB();
  await db.put(STORE, blob, ayahKey(reciterId, ref));
}

export async function countLocal(reciterId: string): Promise<number> {
  try {
    const db = await getDB();
    const keys = (await db.getAllKeys(STORE)) as string[];
    return keys.filter(k => k.startsWith(`${reciterId}:`)).length;
  } catch {
    return 0;
  }
}

export async function clearReciter(reciterId: string): Promise<void> {
  const db = await getDB();
  const keys = (await db.getAllKeys(STORE)) as string[];
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(keys.filter(k => k.startsWith(`${reciterId}:`)).map(k => tx.store.delete(k)));
  await tx.done;
}

/** Resolves a playable URL: the offline copy when present, otherwise streaming. */
export async function resolveAyahUrl(reciterId: string, ref: AyahRef): Promise<{ url: string; local: boolean }> {
  const blob = await getLocalBlob(reciterId, ref);
  if (blob) return { url: URL.createObjectURL(blob), local: true };
  return { url: remoteAyahUrl(reciterId, ref), local: false };
}

// ── Playback ────────────────────────────────────────────────────────────────

let audioEl: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let playToken = 0;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

export function stopAudio(): void {
  playToken++;
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

/** Plays the given ayat in order. Never mutates any session/reveal state. */
export async function playAyahSequence(reciterId: string, refs: AyahRef[]): Promise<void> {
  stopAudio();
  const token = ++playToken;
  const el = getAudioEl();
  for (const ref of refs) {
    if (token !== playToken) return;
    const { url, local } = await resolveAyahUrl(reciterId, ref);
    if (token !== playToken) {
      if (local) URL.revokeObjectURL(url);
      return;
    }
    if (local) activeObjectUrl = url;
    el.src = url;
    try {
      await el.play();
    } catch {
      return;
    }
    await new Promise<void>(resolve => {
      const done = () => {
        el.removeEventListener('ended', done);
        el.removeEventListener('error', done);
        resolve();
      };
      el.addEventListener('ended', done);
      el.addEventListener('error', done);
    });
    if (local && activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }
}

// ── Download manager ────────────────────────────────────────────────────────

export interface DownloadProgress {
  total: number;
  done: number;
  failed: number;
  running: boolean;
  paused: boolean;
}

export class AyahDownloadJob {
  private paused = false;
  private cancelled = false;
  private done = 0;
  private failed = 0;
  private readonly refs: AyahRef[];

  constructor(
    private reciterId: string,
    refs: AyahRef[],
    private onProgress: (p: DownloadProgress) => void,
  ) {
    this.refs = refs;
  }

  private emit(running: boolean) {
    this.onProgress({
      total: this.refs.length,
      done: this.done,
      failed: this.failed,
      running,
      paused: this.paused,
    });
  }

  pause() { this.paused = true; this.emit(true); }
  resume() { this.paused = false; this.emit(true); }
  cancel() { this.cancelled = true; this.paused = false; }

  async run(): Promise<void> {
    this.emit(true);
    for (const ref of this.refs) {
      if (this.cancelled) break;
      while (this.paused && !this.cancelled) {
        await new Promise(r => setTimeout(r, 300));
      }
      if (this.cancelled) break;
      try {
        if (await hasLocal(this.reciterId, ref)) {
          this.done++;
          this.emit(true);
          continue;
        }
        const res = await fetch(remoteAyahUrl(this.reciterId, ref));
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (blob.size < 512) throw new Error('empty');
        await saveBlob(this.reciterId, ref, blob);
        this.done++;
      } catch {
        this.failed++;
      }
      this.emit(true);
    }
    this.emit(false);
  }

  /** Ayat that are still missing locally — used by the repair action. */
  async missing(): Promise<AyahRef[]> {
    const out: AyahRef[] = [];
    for (const ref of this.refs) {
      if (!(await hasLocal(this.reciterId, ref))) out.push(ref);
    }
    return out;
  }
}

export async function missingAyat(reciterId: string, refs: AyahRef[]): Promise<AyahRef[]> {
  const out: AyahRef[] = [];
  for (const ref of refs) {
    if (!(await hasLocal(reciterId, ref))) out.push(ref);
  }
  return out;
}
