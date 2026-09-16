/** Persistent key/value storage: Preferences on native, IndexedDB on web. */
import { Capacitor } from '@capacitor/core';
import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';

const STORE_NAME = 'keyval';
const READ_TIMEOUT_MS = 4000;

/** Never let a blocked IndexedDB/Preferences read hang the app forever. */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => {
      console.error(`[persistentKV] ${label} timed out after ${READ_TIMEOUT_MS}ms`);
      resolve(null);
    }, READ_TIMEOUT_MS)),
  ]);
}

export function createPersistentStorage(dbName: string): StateStorage {
  const native = Capacitor.isNativePlatform();
  const getDB = () => openDB(dbName, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    },
  });
  const preferences = async () => (await import('@capacitor/preferences')).Preferences;

  const readWeb = async (name: string): Promise<string | null> => {
    try {
      const value = await withTimeout(
        (async () => (await getDB()).get(STORE_NAME, name) as Promise<string | undefined>)(),
        `${dbName} IndexedDB read`,
      );
      if (value != null) return value;
    } catch (error) {
      console.error(`[persistentKV:${dbName}] IndexedDB read failed`, error);
    }
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.error(`[persistentKV:${dbName}] localStorage read failed`, error);
      return null;
    }
  };

  const writeWeb = async (name: string, value: string): Promise<void> => {
    let stored = false;
    try {
      await (await getDB()).put(STORE_NAME, value, name);
      stored = true;
    } catch (error) {
      console.error(`[persistentKV:${dbName}] IndexedDB write failed`, error);
    }
    try {
      localStorage.setItem(name, value);
      stored = true;
    } catch (error) {
      console.error(`[persistentKV:${dbName}] localStorage write failed`, error);
    }
    if (!stored) console.error(`[persistentKV:${dbName}] every write path failed for ${name}`);
  };

  return {
    getItem: async name => {
      if (!native) return readWeb(name);
      const key = `${dbName}:${name}`;
      try {
        const { value } = await (await preferences()).get({ key });
        if (value != null) return value;
      } catch (error) {
        console.error(`[persistentKV:${dbName}] Preferences read failed`, error);
      }
      const legacy = await readWeb(name);
      if (legacy != null) {
        try {
          await (await preferences()).set({ key, value: legacy });
        } catch (error) {
          console.error(`[persistentKV:${dbName}] legacy migration failed`, error);
        }
      }
      return legacy;
    },
    setItem: async (name, value) => {
      if (native) {
        const key = `${dbName}:${name}`;
        try {
          await (await preferences()).set({ key, value });
          return;
        } catch (error) {
          console.error(`[persistentKV:${dbName}] Preferences write failed`, error);
        }
      }
      await writeWeb(name, value);
    },
    removeItem: async name => {
      if (native) {
        const key = `${dbName}:${name}`;
        try {
          await (await preferences()).remove({ key });
          return;
        } catch (error) {
          console.error(`[persistentKV:${dbName}] Preferences delete failed`, error);
        }
      }
      try {
        await (await getDB()).delete(STORE_NAME, name);
      } catch (error) {
        console.error(`[persistentKV:${dbName}] IndexedDB delete failed`, error);
      }
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.error(`[persistentKV:${dbName}] localStorage delete failed`, error);
      }
    },
  };
}
