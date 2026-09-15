/**
 * QuranAudioProvider — an independent audio layer for the app.
 *
 * Design rules:
 *  - The review session never knows which website the audio comes from; it
 *    only asks this layer for (reciter, narration, surah, ayah).
 *  - Every audio file is identified by a full source descriptor:
 *    provider + reciter + narration + surah + ayah. A file is only ever used
 *    for the exact same descriptor — no automatic substitution of a different
 *    reciter or narration when a file fails.
 *  - Files are stored in the device's persistent app storage (Capacitor
 *    Filesystem on Android/iOS, IndexedDB on the web) and are never bundled
 *    inside the APK.
 *
 * Verified sources (checked live, ayah-by-ayah mp3):
 *  - verses.quran.foundation — the Quran Foundation / quran.com verse CDN,
 *    paths taken from the official recitations catalogue.
 *  - cdn.islamic.network — the Al Quran Cloud CDN, ayah numbered 1..6236.
 */

import type { AyahRef } from '@/utils/pageAyahRefs';
import { VERSE_COUNTS } from '@/utils/pageAssemblyModel';
import {
  saveAudio,
  hasValidAudio,
  localAudioUrl,
  isRevocableUrl,
  countAudio,
  deleteAudioPrefix,
  readMeta,
  writeMeta,
  MIN_AUDIO_BYTES,
} from './audioStorage';

// ── Narrations & providers ──────────────────────────────────────────────────

/** The system is not hard-wired to one narration. */
export type NarrationId = 'hafs' | 'warsh' | 'qalun' | 'duri';

export const NARRATION_NAMES: Record<NarrationId, string> = {
  hafs: 'حفص عن عاصم',
  warsh: 'ورش عن نافع',
  qalun: 'قالون عن نافع',
  duri: 'الدوري عن أبي عمرو',
};

export interface AudioProvider {
  id: string;
  name: string;
  /** Builds the remote URL for one ayah of one reciter. */
  buildUrl: (reciter: Reciter, surah: number, ayah: number) => string;
}

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Global ayah number 1..6236 (used by the Al Quran Cloud CDN). */
export function globalAyahNumber(surah: number, ayah: number): number {
  let n = 0;
  for (let s = 1; s < surah; s++) n += VERSE_COUNTS[s] || 0;
  return n + ayah;
}

export const PROVIDERS: Record<string, AudioProvider> = {
  quranfoundation: {
    id: 'quranfoundation',
    name: 'مؤسسة القرآن (verses.quran.foundation)',
    buildUrl: (r, s, a) => `https://verses.quran.foundation/${r.path}/${pad3(s)}${pad3(a)}.mp3`,
  },
  islamicnetwork: {
    id: 'islamicnetwork',
    name: 'شبكة القرآن (cdn.islamic.network)',
    buildUrl: (r, s, a) => `https://cdn.islamic.network/quran/audio/128/${r.path}/${globalAyahNumber(s, a)}.mp3`,
  },
};

// ── Reciters ────────────────────────────────────────────────────────────────

export interface Reciter {
  id: string;
  name: string;
  narration: NarrationId;
  provider: string;
  /** Provider-specific identifier (folder path or edition id). */
  path: string;
}

export const RECITERS: Reciter[] = [
  { id: 'husary', name: 'محمود خليل الحصري', narration: 'hafs', provider: 'islamicnetwork', path: 'ar.husary' },
  { id: 'husary-mujawwad', name: 'الحصري (المجود)', narration: 'hafs', provider: 'islamicnetwork', path: 'ar.husarymujawwad' },
  { id: 'alafasy', name: 'مشاري راشد العفاسي', narration: 'hafs', provider: 'quranfoundation', path: 'Alafasy/mp3' },
  { id: 'abdulbasit', name: 'عبد الباسط (مرتل)', narration: 'hafs', provider: 'quranfoundation', path: 'AbdulBaset/Murattal/mp3' },
  { id: 'abdulbasit-mujawwad', name: 'عبد الباسط (مجود)', narration: 'hafs', provider: 'quranfoundation', path: 'AbdulBaset/Mujawwad/mp3' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي', narration: 'hafs', provider: 'quranfoundation', path: 'Minshawi/Murattal/mp3' },
  { id: 'sudais', name: 'عبد الرحمن السديس', narration: 'hafs', provider: 'quranfoundation', path: 'Sudais/mp3' },
  { id: 'shatri', name: 'أبو بكر الشاطري', narration: 'hafs', provider: 'quranfoundation', path: 'Shatri/mp3' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', narration: 'hafs', provider: 'islamicnetwork', path: 'ar.mahermuaiqly' },
];

export const DEFAULT_RECITER_ID = 'husary';

/** Returns the reciter, or null — never silently substitutes another one. */
export function findReciter(id: string | undefined): Reciter | null {
  return RECITERS.find(r => r.id === id) ?? null;
}

export function getReciter(id: string | undefined): Reciter {
  return findReciter(id) ?? RECITERS.find(r => r.id === DEFAULT_RECITER_ID)!;
}

export function narrationName(r: Reciter): string {
  return NARRATION_NAMES[r.narration];
}

// ── Source descriptor ───────────────────────────────────────────────────────

export interface AudioSourceRef {
  provider: string;
  reciterId: string;
  narration: NarrationId;
  surah: number;
  ayah: number;
  url: string;
  /** Storage key — encodes provider/reciter/narration/surah/ayah. */
  key: string;
}

/** Full descriptor for one ayah. Returns null for an unknown reciter. */
export function resolveSource(reciterId: string, ref: AyahRef): AudioSourceRef | null {
  const reciter = findReciter(reciterId);
  if (!reciter) return null;
  const provider = PROVIDERS[reciter.provider];
  if (!provider) return null;
  if (!ref || ref.surah < 1 || ref.surah > 114 || ref.ayah < 1) return null;
  return {
    provider: provider.id,
    reciterId: reciter.id,
    narration: reciter.narration,
    surah: ref.surah,
    ayah: ref.ayah,
    url: provider.buildUrl(reciter, ref.surah, ref.ayah),
    key: `${provider.id}:${reciter.id}:${reciter.narration}:${pad3(ref.surah)}${pad3(ref.ayah)}`,
  };
}

/** Prefix that identifies every file of one reciter package. */
export function packagePrefix(reciterId: string): string {
  const r = findReciter(reciterId);
  if (!r) return `__unknown__:${reciterId}`;
  return `${r.provider}:${r.id}:${r.narration}:`;
}

export function packageId(reciterId: string): string {
  const r = findReciter(reciterId);
  if (!r) return `unknown-${reciterId}`;
  return `${r.provider}-${r.id}-${r.narration}`;
}

// ── Local files ─────────────────────────────────────────────────────────────

export async function hasLocal(reciterId: string, ref: AyahRef): Promise<boolean> {
  const src = resolveSource(reciterId, ref);
  if (!src) return false;
  return hasValidAudio(src.key);
}

export async function countLocal(reciterId: string, refs?: AyahRef[]): Promise<number> {
  const keys = refs?.map(r => resolveSource(reciterId, r)?.key).filter(Boolean) as string[] | undefined;
  return countAudio(packagePrefix(reciterId), keys);
}

export async function clearReciter(reciterId: string, refs?: AyahRef[]): Promise<void> {
  const keys = refs?.map(r => resolveSource(reciterId, r)?.key).filter(Boolean) as string[] | undefined;
  await deleteAudioPrefix(packagePrefix(reciterId), keys);
  await writeMeta(`pkg:${packageId(reciterId)}`, null);
}

export async function missingAyat(reciterId: string, refs: AyahRef[]): Promise<AyahRef[]> {
  const out: AyahRef[] = [];
  for (const ref of refs) if (!(await hasLocal(reciterId, ref))) out.push(ref);
  return out;
}

// ── Download + validation ───────────────────────────────────────────────────

/** Rejects HTML error pages, empty or truncated files. */
async function fetchValidAudio(url: string): Promise<Blob | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.includes('text/') || type.includes('html') || type.includes('json')) return null;
  const declared = Number(res.headers.get('content-length') || 0);
  const blob = await res.blob();
  if (blob.size < MIN_AUDIO_BYTES) return null;
  if (declared > 0 && Math.abs(declared - blob.size) > 64) return null;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isId3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33; // "ID3"
  const isMpeg = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  if (!isId3 && !isMpeg) return null;
  return blob;
}

/** Downloads one ayah into persistent storage. */
export async function downloadAyah(reciterId: string, ref: AyahRef): Promise<boolean> {
  const src = resolveSource(reciterId, ref);
  if (!src) return false;
  try {
    const blob = await fetchValidAudio(src.url);
    if (!blob) return false;
    return saveAudio(src.key, blob);
  } catch {
    return false;
  }
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

/** The offline copy when present, otherwise the remote URL of the SAME source. */
export async function resolvePlayableUrl(
  reciterId: string,
  ref: AyahRef,
): Promise<{ url: string; local: boolean } | null> {
  const src = resolveSource(reciterId, ref);
  if (!src) return null;
  const local = await localAudioUrl(src.key);
  if (local) return { url: local, local: true };
  return { url: src.url, local: false };
}

export interface PlayResult {
  played: number;
  failed: number;
}

/**
 * Plays the given ayat in order. Purely an audio action — it never touches
 * reveal state, card progress or ratings.
 */
export async function playAyahSequence(reciterId: string, refs: AyahRef[]): Promise<PlayResult> {
  stopAudio();
  const token = ++playToken;
  const el = getAudioEl();
  const result: PlayResult = { played: 0, failed: 0 };

  for (const ref of refs) {
    if (token !== playToken) return result;
    const resolved = await resolvePlayableUrl(reciterId, ref);
    if (!resolved) { result.failed++; continue; }
    if (token !== playToken) {
      if (isRevocableUrl(resolved.url)) URL.revokeObjectURL(resolved.url);
      return result;
    }
    if (isRevocableUrl(resolved.url)) activeObjectUrl = resolved.url;
    el.src = resolved.url;
    let failed = false;
    try {
      await el.play();
    } catch {
      failed = true;
    }
    if (!failed) {
      await new Promise<void>(resolve => {
        const onEnd = () => { cleanup(); resolve(); };
        const onErr = () => { failed = true; cleanup(); resolve(); };
        const cleanup = () => {
          el.removeEventListener('ended', onEnd);
          el.removeEventListener('error', onErr);
        };
        el.addEventListener('ended', onEnd);
        el.addEventListener('error', onErr);
      });
    }
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
    if (failed) result.failed++; else result.played++;
  }
  return result;
}

// ── Persistent download package ─────────────────────────────────────────────

const refId = (r: AyahRef) => `${r.surah}:${r.ayah}`;
const parseRefId = (s: string): AyahRef => {
  const [a, b] = s.split(':');
  return { surah: Number(a), ayah: Number(b) };
};

export interface DownloadPackageState {
  packageId: string;
  provider: string;
  reciterId: string;
  narration: NarrationId;
  /** Every ayah requested for this package. */
  refs: string[];
  /** Ayat confirmed stored on the device. */
  done: string[];
  /** Ayat that failed and still need a repair pass. */
  failed: string[];
  status: 'idle' | 'running' | 'paused' | 'complete';
  updatedAt: number;
}

export async function readPackageState(reciterId: string): Promise<DownloadPackageState | null> {
  return readMeta<DownloadPackageState>(`pkg:${packageId(reciterId)}`);
}

async function savePackageState(state: DownloadPackageState) {
  await writeMeta(`pkg:${state.packageId}`, { ...state, updatedAt: Date.now() });
}

export interface DownloadProgress {
  total: number;
  done: number;
  failed: number;
  running: boolean;
  paused: boolean;
}

/**
 * A resumable download. State is persisted after every file, so closing the
 * app (or rebooting the phone) and coming back continues with the missing
 * files only — existing valid files are never downloaded again.
 */
export class AyahDownloadJob {
  private paused = false;
  private cancelled = false;
  private state: DownloadPackageState;
  private readonly reciter: Reciter;

  constructor(
    private reciterId: string,
    refs: AyahRef[],
    private onProgress: (p: DownloadProgress) => void,
    previous?: DownloadPackageState | null,
  ) {
    const reciter = findReciter(reciterId);
    if (!reciter) throw new Error(`Unknown reciter: ${reciterId}`);
    this.reciter = reciter;
    const ids = refs.map(refId);
    const merged = previous && previous.packageId === packageId(reciterId)
      ? Array.from(new Set([...previous.refs, ...ids]))
      : ids;
    this.state = {
      packageId: packageId(reciterId),
      provider: reciter.provider,
      reciterId: reciter.id,
      narration: reciter.narration,
      refs: merged,
      done: previous?.done?.filter(id => merged.includes(id)) ?? [],
      failed: [],
      status: 'idle',
      updatedAt: Date.now(),
    };
  }

  private emit(running: boolean) {
    this.onProgress({
      total: this.state.refs.length,
      done: this.state.done.length,
      failed: this.state.failed.length,
      running,
      paused: this.paused,
    });
  }

  pause() { this.paused = true; this.state.status = 'paused'; void savePackageState(this.state); this.emit(true); }
  resume() { this.paused = false; this.state.status = 'running'; this.emit(true); }
  cancel() { this.cancelled = true; this.paused = false; }

  async run(): Promise<void> {
    this.state.status = 'running';
    this.state.failed = [];
    // Trust the device, not the saved list: re-check what is actually stored.
    const confirmed: string[] = [];
    for (const id of this.state.refs) {
      if (await hasLocal(this.reciterId, parseRefId(id))) confirmed.push(id);
    }
    this.state.done = confirmed;
    await savePackageState(this.state);
    this.emit(true);

    for (const id of this.state.refs) {
      if (this.cancelled) break;
      if (this.state.done.includes(id)) continue;
      while (this.paused && !this.cancelled) await new Promise(r => setTimeout(r, 300));
      if (this.cancelled) break;

      const ok = await downloadAyah(this.reciterId, parseRefId(id));
      if (ok) this.state.done.push(id);
      else this.state.failed.push(id);
      await savePackageState(this.state);
      this.emit(true);
    }

    this.state.status = this.state.done.length === this.state.refs.length ? 'complete' : 'paused';
    await savePackageState(this.state);
    this.emit(false);
  }

  get narrationLabel() { return NARRATION_NAMES[this.reciter.narration]; }
}
