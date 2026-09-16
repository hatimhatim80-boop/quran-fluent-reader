/**
 * One key/value layer for small, must-not-be-lost records.
 *
 * Android/iOS → Capacitor Preferences (native storage, survives WebView data
 * clearing much better than localStorage).
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

  return {
    getItem: async (name) => {
      if (native) {
        try {
          const { value } = await (await prefs()).get({ key: `${dbName}:${name}` });
          if (value != null) return value;
        } catch (e) {
          console.error(`[persistentKV:${dbName}] native read failed`, e);
        }
      }
      try {
        const db = await getDB();
        const v = (await db.get(STORE_NAME, name)) as string | undefined;
        if (v != null) return v;
      } catch (e) {
        console.error(`[persistentKV:${dbName}] idb read failed`, e);
      }
      try { return localStorage.getItem(name); } catch { return null; }
    },

    setItem: async (name, value) => {
      let stored = false;
      if (native) {
        try {
          await (await prefs()).set({ key: `${dbName}:${name}`, value });
          stored = true;
        } catch (e) {
          console.error(`[persistentKV:${dbName}] native write failed`, e);
        }
      }
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
