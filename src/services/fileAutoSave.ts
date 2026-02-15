/**
 * Auto-save words to a local file using File System Access API
 * Falls back to download if API not available
 */

let fileHandle: FileSystemFileHandle | null = null;

export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window;
}

export async function pickSaveFile(): Promise<boolean> {
  try {
    fileHandle = await (window as any).showSaveFilePicker({
      suggestedName: 'quran-words-backup.json',
      types: [
        { description: 'JSON Files', accept: { 'application/json': ['.json'] } },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function autoSaveToFile(data: unknown): Promise<boolean> {
  if (!fileHandle) return false;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch {
    fileHandle = null;
    return false;
  }
}

export function downloadAsFile(data: unknown, filename = 'quran-words-backup.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function hasActiveFileHandle(): boolean {
  return fileHandle !== null;
}

export function clearFileHandle() {
  fileHandle = null;
}
