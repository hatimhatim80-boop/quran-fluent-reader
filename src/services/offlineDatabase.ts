import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AppDBSchema extends DBSchema {
  appData: {
    key: string;
    value: {
      key: string;
      data: string;
      version: number;
      updatedAt: string;
    };
  };
  meta: {
    key: string;
    value: {
      key: string;
      value: string | number;
    };
  };
}

const DB_NAME = 'quran-app-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AppDBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<AppDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('appData')) {
        db.createObjectStore('appData', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// ── appData CRUD ──

export async function getStoredData(key: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get('appData', key);
  return record?.data ?? null;
}

export async function storeData(key: string, data: string, version: number): Promise<void> {
  const db = await getDB();
  await db.put('appData', {
    key,
    data,
    version,
    updatedAt: new Date().toISOString(),
  });
}

// ── meta CRUD ──

export async function getMeta(key: string): Promise<string | number | null> {
  const db = await getDB();
  const record = await db.get('meta', key);
  return record?.value ?? null;
}

export async function setMeta(key: string, value: string | number): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}
