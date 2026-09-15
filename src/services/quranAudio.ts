/**
 * QuranAudioProvider — the single audio layer of the app.
 *
 * Rules:
 *  - The review session never knows any website, URL or package format.
 *    It only calls `playAyah(reciterId, surah, ayah)` / `playAyahSequence`.
 *  - Every file is identified by provider + reciter + narration + surah + ayah.
 *    A file is only ever used for that exact combination; a missing file is
 *    NEVER replaced by another reciter, narration or source.
 *  - Files live in the device's permanent app storage (Capacitor Filesystem on
 *    Android/iOS, IndexedDB on the web) and are never bundled inside the APK.
 *
 * Primary source: the King Fahd Glorious Quran Printing Complex, which
 * publishes an official "المصحف كاملاً آيات" package per reciter on its own
 * pages (https://qurancomplex.gov.sa/quran-audios/). Those packages are
 * downloaded, unpacked and indexed locally (see audioPackages.ts).
 * Secondary per-ayah CDNs are kept as separate, clearly labelled reciters —
 * they are never substituted for a Complex reciter.
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

// ── Narrations ──────────────────────────────────────────────────────────────

/** The system is narration-generic; only narrations really published are listed. */
export type NarrationId = 'hafs' | 'shubah' | 'qalun' | 'susi' | 'duri';

export const NARRATION_NAMES: Record<NarrationId, string> = {
  hafs: 'حفص عن عاصم',
  shubah: 'شعبة عن عاصم',
  qalun: 'قالون عن نافع',
  susi: 'السوسي عن أبي عمرو',
  duri: 'الدوري عن أبي عمرو',
};

// ── Providers ───────────────────────────────────────────────────────────────

export interface AudioProvider {
  id: string;
  name: string;
  /** Per-ayah URL builder; package providers have none. */
  buildUrl?: (reciter: Reciter, surah: number, ayah: number) => string;
}

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Global ayah number 1..6236 (used by the Al Quran Cloud CDN). */
export function globalAyahNumber(surah: number, ayah: number): number {
  let n = 0;
  for (let s = 1; s < surah; s++) n += VERSE_COUNTS[s] || 0;
  return n + ayah;
}

export const PROVIDERS: Record<string, AudioProvider> = {
  kfgqpc: {
    id: 'kfgqpc',
    name: 'مجمع الملك فهد لطباعة المصحف الشريف',
  },
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
  /** 'package' = one official archive; 'perAyah' = one URL per ayah. */
  kind: 'package' | 'perAyah';
  /** Per-ayah providers: provider-specific folder/edition id. */
  path?: string;
  /** Package providers: the official page that hosts the download button. */
  pageUrl?: string;
  /** Package size as published by the provider, when known. */
  sizeLabel?: string;
}

/**
 * King Fahd Complex reciters — exactly the reciters and narrations published
 * on https://qurancomplex.gov.sa/quran-audios/ with an ayah-by-ayah package.
 */
export const KFGQPC_RECITERS: Reciter[] = [
  { id: 'kfgqpc-hudhaify-hafs', name: 'علي الحذيفي', narration: 'hafs', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audio-hafs-huthify/' },
  { id: 'kfgqpc-muaiqly-hafs', name: 'ماهر المعيقلي', narration: 'hafs', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audio-hafs-muaiqly/' },
  { id: 'kfgqpc-ayyoub-hafs', name: 'محمد أيوب', narration: 'hafs', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audio-hafs-ayyoub/', sizeLabel: '916 م.ب تقريبًا' },
  { id: 'kfgqpc-muhanna-hafs', name: 'خالد المهنا', narration: 'hafs', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/sounds-hafs-muhanna/', sizeLabel: '1.04 ج.ب تقريبًا' },
  { id: 'kfgqpc-akhdar-hafs', name: 'إبراهيم الأخضر', narration: 'hafs', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audio-hafs-akhdar/' },
  { id: 'kfgqpc-hudhaify-shubah', name: 'علي الحذيفي', narration: 'shubah', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audios/' },
  { id: 'kfgqpc-hudhaify-qalun', name: 'علي الحذيفي', narration: 'qalun', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audios/' },
  { id: 'kfgqpc-siddiqi-susi', name: 'عثمان الصديقي', narration: 'susi', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audios/' },
  { id: 'kfgqpc-juhany-duri', name: 'عبدالله الجهني', narration: 'duri', provider: 'kfgqpc', kind: 'package', pageUrl: 'https://qurancomplex.gov.sa/quran-audios/' },
];

/** Per-ayah CDNs — separate reciters, never used to replace a Complex file. */
export const CDN_RECITERS: Reciter[] = [
  { id: 'husary', name: 'محمود خليل الحصري', narration: 'hafs', provider: 'islamicnetwork', kind: 'perAyah', path: 'ar.husary' },
  { id: 'husary-mujawwad', name: 'الحصري (المجود)', narration: 'hafs', provider: 'islamicnetwork', kind: 'perAyah', path: 'ar.husarymujawwad' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', narration: 'hafs', provider: 'islamicnetwork', kind: 'perAyah', path: 'ar.mahermuaiqly' },
  { id: 'alafasy', name: 'مشاري راشد العفاسي', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'Alafasy/mp3' },
  { id: 'abdulbasit', name: 'عبد الباسط (مرتل)', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'AbdulBaset/Murattal/mp3' },
  { id: 'abdulbasit-mujawwad', name: 'عبد الباسط (مجود)', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'AbdulBaset/Mujawwad/mp3' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'Minshawi/Murattal/mp3' },
  { id: 'sudais', name: 'عبد الرحمن السديس', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'Sudais/mp3' },
  { id: 'shatri', name: 'أبو بكر الشاطري', narration: 'hafs', provider: 'quranfoundation', kind: 'perAyah', path: 'Shatri/mp3' },
];

export const RECITERS: Reciter[] = [...KFGQPC_RECITERS, ...CDN_RECITERS];

export const DEFAULT_RECITER_ID = 'kfgqpc-hudhaify-hafs';

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

export function providerName(r: Reciter): string {
  return PROVIDERS[r.provider]?.name ?? r.provider;
}

// ── Source descriptor ───────────────────────────────────────────────────────

export interface AudioSourceRef {
  provider: string;
  reciterId: string;
  narration: NarrationId;
  surah: number;
  ayah: number;
  /** Remote URL, or null for package reciters (local files only). */
  url: string | null;
  /** Storage key — encodes provider/reciter/narration/surah/ayah. */
  key: string;
}

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
    url: provider.buildUrl ? provider.buildUrl(reciter, ref.surah, ref.ayah) : null,
    key: `${provider.id}:${reciter.id}:${reciter.narration}:${pad3(ref.surah)}${pad3(ref.ayah)}`,
  };
}

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

// ── Per-ayah download + validation ──────────────────────────────────────────

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

export async function downloadAyah(reciterId: string, ref: AyahRef): Promise<boolean> {
  const src = resolveSource(reciterId, ref);
  if (!src || !src.url) return false;
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

/** Local copy first; streaming only for the very same source. */
export async function resolvePlayableUrl(
  reciterId: string,
  ref: AyahRef,
): Promise<{ url: string; local: boolean } | null> {
  const src = resolveSource(reciterId, ref);
  if (!src) return null;
  const local = await localAudioUrl(src.key);
  if (local) return { url: local, local: true };
  if (!src.url) return null; // package reciter, not downloaded yet
  return { url: src.url, local: false };
}

export interface PlayResult {
  played: number;
  /** Ayat that could not be played at all. */
  failed: number;
  /** True when the failure is simply "not downloaded on this device". */
  notDownloaded: boolean;
}

/**
 * Plays the given ayat in order. Purely an audio action — it never touches
 * reveal state, card progress or ratings.
 */
export async function playAyahSequence(reciterId: string, refs: AyahRef[]): Promise<PlayResult> {
  stopAudio();
  const token = ++playToken;
  const el = getAudioEl();
  const result: PlayResult = { played: 0, failed: 0, notDownloaded: false };

  for (const ref of refs) {
    if (token !== playToken) return result;
    const resolved = await resolvePlayableUrl(reciterId, ref);
    if (!resolved) { result.failed++; result.notDownloaded = true; continue; }
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

/** Convenience entry point used by the review session. */
export function playAyah(reciterId: string, surah: number, ayah: number): Promise<PlayResult> {
  return playAyahSequence(reciterId, [{ surah, ayah }]);
}

// ── Per-ayah resumable download package ─────────────────────────────────────

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
  refs: string[];
  done: string[];
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
 * Ayah-by-ayah download for per-ayah CDN reciters. State is persisted after
 * every file, so closing the app and returning continues with the missing
 * files only.
 */
export class AyahDownloadJob {
  private paused = false;
  private cancelled = false;
  private state: DownloadPackageState;

  constructor(
    private reciterId: string,
    refs: AyahRef[],
    private onProgress: (p: DownloadProgress) => void,
    previous?: DownloadPackageState | null,
  ) {
    const reciter = findReciter(reciterId);
    if (!reciter) throw new Error(`Unknown reciter: ${reciterId}`);
    if (reciter.kind !== 'perAyah') throw new Error('هذا القارئ يُنزَّل كحزمة رسمية كاملة');
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
}
