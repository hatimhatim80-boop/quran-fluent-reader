/**
 * One key/value layer for small, must-not-be-lost records.
 *
 * Android/iOS → Capacitor Preferences is the single source of truth. The web
 * stores (IndexedDB, then localStorage) are read once only to migrate records
 * written by an older build, and are never written to on native.
 * Web        → IndexedDB, with localStorage only as a last-resort mirror.
 *
 * Large binaries (reciter audio) are NOT stored here — they stay in the
 * Filesystem layer of `audioStorage`.
 */

import { Capacitor } from '@capacitor/core';
import type { StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

const STORE_NAME = 'keyval';

export function createPersistentStorage(dbName: string): StateStorage {
  const native = Capacitor.isNativePlatform();

  const getDB = () =>
    openDB(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      },
    });

  const prefs = async () => (await import('@capacitor/preferences')).Preferences;

  const readWeb = async (name: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const v = (await db.get(STORE_NAME, name)) as string | undefined;
      if (v != null) return v;
    } catch (e) {
      console.error(`[persistentKV:${dbName}] idb read failed`, e);
    }
    try { return localStorage.getItem(name); } catch { return null; }
  };

  return {
    getItem: async (name) => {
      if (native) {
        const key = `${dbName}:${name}`;
        try {
          const { value } = await (await prefs()).get({ key });
          if (value != null) return value;
        } catch (e) {
          console.error(`[persistentKV:${dbName}] native read failed`, e);
        }
        // Nothing native yet — migrate a record left by an older web-storage build.
        const legacy = await readWeb(name);
        if (legacy != null) {
          try { await (await prefs()).set({ key, value: legacy }); }
          catch (e) { console.error(`[persistentKV:${dbName}] migration to native failed`, e); }
        }
        return legacy;
      }
      return readWeb(name);
    },

    setItem: async (name, value) => {
      if (native) {
        try {
          await (await prefs()).set({ key: `${dbName}:${name}`, value });
          return;
        } catch (e) {
          console.error(`[persistentKV:${dbName}] native write failed`, e);
          // fall through to the web stores rather than losing progress
        }
      }
      let stored = false;
      try {
        const db = await getDB();
        await db.put(STORE_NAME, value, name);
        stored = true;
      } catch (e) {
        console.error(`[persistentKV:${dbName}] idb write failed`, e);
      }
      try { localStorage.setItem(name, value); stored = true; } catch { /* quota */ }
      if (!stored) console.error(`[persistentKV:${dbName}] every write path failed for`, name);
    },

    removeItem: async (name) => {
      if (native) {
        try { await (await prefs()).remove({ key: `${dbName}:${name}` }); }
        catch (e) { console.error(`[persistentKV:${dbName}] native delete failed`, e); }
      }
      try {
        const db = await getDB();
        await db.delete(STORE_NAME, name);
      } catch (e) {
        console.error(`[persistentKV:${dbName}] idb delete failed`, e);
      }
      try { localStorage.removeItem(name); } catch { /* ignore */ }
    },
  };
}
