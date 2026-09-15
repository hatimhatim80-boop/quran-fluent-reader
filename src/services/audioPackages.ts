/**
 * Official recitation PACKAGES.
 *
 * Some providers (institutional ones) publish a single archive containing the
 * whole Mushaf split into ayah files, instead of one URL per ayah. This module
 * downloads such an archive with byte-level resume (HTTP Range when the server
 * allows it), unpacks it into the app's private storage, and builds a local
 * manifest mapping surah+ayah to the stored file.
 *
 * It knows nothing about the review session; the session only ever calls the
 * audio provider layer.
 */

import { unzip } from 'fflate';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  saveAudio,
  hasValidAudio,
  readMeta,
  writeMeta,
  MIN_AUDIO_BYTES,
} from './audioStorage';
import type { NarrationId } from './quranAudio';

export interface AudioPackage {
  id: string;
  provider: string;
  providerName: string;
  reciterId: string;
  reciterName: string;
  narration: NarrationId;
  /** Direct download URL of the official ayah-by-ayah archive. */
  url: string;
  /** Declared size in bytes, when the provider publishes it. */
  sizeBytes?: number;
  /** Human readable size for the UI. */
  sizeLabel?: string;
}

export interface PackageState {
  packageId: string;
  url: string;
  provider: string;
  reciterId: string;
  narration: NarrationId;
  expectedSize: number;
  downloadedBytes: number;
  supportsRange: boolean | null;
  status: 'idle' | 'downloading' | 'paused' | 'extracting' | 'ready' | 'incomplete' | 'error';
  /** Ayat successfully extracted, as "surah:ayah". */
  extracted: string[];
  /** Ayat expected but missing or corrupt after extraction. */
  missing: string[];
  error?: string;
  updatedAt: number;
}

export interface PackageProgress {
  phase: 'download' | 'extract' | 'done';
  downloadedBytes: number;
  totalBytes: number;
  extracted: number;
  status: PackageState['status'];
  supportsRange: boolean | null;
}

const partPath = (pkgId: string) => `recitations/packages/${pkgId}.part`;
const stateKey = (pkgId: string) => `package:${pkgId}`;

export async function readPackageDownloadState(pkgId: string): Promise<PackageState | null> {
  return readMeta<PackageState>(stateKey(pkgId));
}

async function saveState(state: PackageState) {
  await writeMeta(stateKey(state.packageId), { ...state, updatedAt: Date.now() });
}

// ── Partial file handling ───────────────────────────────────────────────────

const isNative = () => Capacitor.isNativePlatform();

/** In the browser the partial archive is kept in memory for the session only. */
const memoryParts = new Map<string, Uint8Array>();

async function partSize(pkgId: string): Promise<number> {
  if (!isNative()) return memoryParts.get(pkgId)?.length ?? 0;
  try {
    const stat = await Filesystem.stat({ path: partPath(pkgId), directory: Directory.Data });
    return Number(stat.size) || 0;
  } catch {
    return 0;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function appendPart(pkgId: string, bytes: Uint8Array) {
  if (!isNative()) {
    const prev = memoryParts.get(pkgId);
    if (!prev) memoryParts.set(pkgId, bytes);
    else {
      const merged = new Uint8Array(prev.length + bytes.length);
      merged.set(prev, 0);
      merged.set(bytes, prev.length);
      memoryParts.set(pkgId, merged);
    }
    return;
  }
  const path = partPath(pkgId);
  try {
    await Filesystem.mkdir({ path: 'recitations/packages', directory: Directory.Data, recursive: true });
  } catch { /* exists */ }
  await Filesystem.appendFile({ path, directory: Directory.Data, data: toBase64(bytes) });
}

async function readPart(pkgId: string): Promise<Uint8Array | null> {
  if (!isNative()) return memoryParts.get(pkgId) ?? null;
  try {
    const res = await Filesystem.readFile({ path: partPath(pkgId), directory: Directory.Data });
    const bin = atob(String(res.data));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function clearPart(pkgId: string) {
  memoryParts.delete(pkgId);
  if (!isNative()) return;
  try {
    await Filesystem.deleteFile({ path: partPath(pkgId), directory: Directory.Data });
  } catch { /* nothing */ }
}

// ── Archive entry → ayah mapping ────────────────────────────────────────────

/**
 * Accepts the common official naming schemes for ayah files:
 *   001001.mp3 · 001_001.mp3 · 1-1.mp3 · .../002/002003.mp3
 * Anything that does not resolve to a valid surah+ayah is skipped.
 */
export function parseAyahFileName(name: string): { surah: number; ayah: number } | null {
  const base = name.split('/').pop() || name;
  if (!/\.mp3$/i.test(base)) return null;
  const stem = base.replace(/\.mp3$/i, '');
  let m = stem.match(/^(\d{3})(\d{3})$/);
  if (!m) m = stem.match(/^(\d{1,3})[._-](\d{1,3})$/);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return { surah, ayah };
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });
}

// ── Download + extract ──────────────────────────────────────────────────────

export class PackageDownloadJob {
  private paused = false;
  private cancelled = false;
  private state: PackageState;

  constructor(
    private pkg: AudioPackage,
    private onProgress: (p: PackageProgress) => void,
    previous?: PackageState | null,
  ) {
    this.state = previous && previous.packageId === pkg.id && previous.url === pkg.url
      ? { ...previous, status: 'idle' }
      : {
          packageId: pkg.id,
          url: pkg.url,
          provider: pkg.provider,
          reciterId: pkg.reciterId,
          narration: pkg.narration,
          expectedSize: pkg.sizeBytes ?? 0,
          downloadedBytes: 0,
          supportsRange: null,
          status: 'idle',
          extracted: [],
          missing: [],
          updatedAt: Date.now(),
        };
  }

  private emit(phase: PackageProgress['phase']) {
    this.onProgress({
      phase,
      downloadedBytes: this.state.downloadedBytes,
      totalBytes: this.state.expectedSize,
      extracted: this.state.extracted.length,
      status: this.state.status,
      supportsRange: this.state.supportsRange,
    });
  }

  pause() { this.paused = true; }
  cancel() { this.cancelled = true; }

  /** Downloads (resuming when possible) then extracts and verifies. */
  async run(): Promise<PackageState> {
    try {
      await this.download();
      if (this.cancelled || this.paused) {
        this.state.status = 'paused';
        await saveState(this.state);
        this.emit('download');
        return this.state;
      }
      await this.extract();
    } catch (e) {
      this.state.status = 'error';
      this.state.error = e instanceof Error ? e.message : String(e);
      await saveState(this.state);
      this.emit('download');
    }
    return this.state;
  }

  private async download() {
    const already = await partSize(this.pkg.id);
    this.state.downloadedBytes = already;
    this.state.status = 'downloading';
    this.emit('download');

    const headers: Record<string, string> = {};
    if (already > 0) headers.Range = `bytes=${already}-`;

    const res = await fetch(this.pkg.url, { headers });
    if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);

    if (already > 0) {
      // Only a real 206 means the server honoured the resume request.
      this.state.supportsRange = res.status === 206;
      if (res.status !== 206) {
        await clearPart(this.pkg.id);
        this.state.downloadedBytes = 0;
      }
    } else {
      this.state.supportsRange = (res.headers.get('accept-ranges') || '').includes('bytes');
    }

    const len = Number(res.headers.get('content-length') || 0);
    if (len > 0) this.state.expectedSize = this.state.downloadedBytes + len;
    await saveState(this.state);

    const reader = res.body?.getReader();
    if (!reader) {
      const buf = new Uint8Array(await res.arrayBuffer());
      await appendPart(this.pkg.id, buf);
      this.state.downloadedBytes += buf.length;
    } else {
      let pending: Uint8Array[] = [];
      let pendingLen = 0;
      const flush = async () => {
        if (pendingLen === 0) return;
        const merged = new Uint8Array(pendingLen);
        let off = 0;
        for (const c of pending) { merged.set(c, off); off += c.length; }
        await appendPart(this.pkg.id, merged);
        pending = []; pendingLen = 0;
      };
      for (;;) {
        if (this.cancelled || this.paused) { await flush(); await saveState(this.state); return; }
        const { done, value } = await reader.read();
        if (done) break;
        pending.push(value);
        pendingLen += value.length;
        this.state.downloadedBytes += value.length;
        if (pendingLen >= 1024 * 1024) {
          await flush();
          await saveState(this.state);
          this.emit('download');
        }
      }
      await flush();
    }
    await saveState(this.state);
    this.emit('download');
  }

  /** Unpacks the archive into per-ayah files and verifies each one. */
  private async extract() {
    this.state.status = 'extracting';
    await saveState(this.state);
    this.emit('extract');

    const data = await readPart(this.pkg.id);
    if (!data || data.length < MIN_AUDIO_BYTES) throw new Error('الحزمة غير مكتملة');

    const files = await unzipAsync(data);
    const extracted: string[] = [];
    const missing: string[] = [];

    for (const [name, bytes] of Object.entries(files)) {
      const ref = parseAyahFileName(name);
      if (!ref) continue;
      const id = `${ref.surah}:${ref.ayah}`;
      if (bytes.length < MIN_AUDIO_BYTES) { missing.push(id); continue; }
      const key = packageAyahKey(this.pkg, ref.surah, ref.ayah);
      const ok = await saveAudio(key, new Blob([bytes], { type: 'audio/mpeg' }));
      if (ok && (await hasValidAudio(key))) extracted.push(id);
      else missing.push(id);
      if (extracted.length % 50 === 0) this.emit('extract');
    }

    this.state.extracted = extracted;
    this.state.missing = missing;
    this.state.status = missing.length === 0 && extracted.length > 0 ? 'ready' : 'incomplete';
    await saveState(this.state);
    await clearPart(this.pkg.id);
    this.emit('done');
  }
}

/** Storage key of one ayah belonging to a package — narration-safe. */
export function packageAyahKey(pkg: AudioPackage, surah: number, ayah: number): string {
  const pad = (n: number) => String(n).padStart(3, '0');
  return `${pkg.provider}:${pkg.reciterId}:${pkg.narration}:${pad(surah)}${pad(ayah)}`;
}
