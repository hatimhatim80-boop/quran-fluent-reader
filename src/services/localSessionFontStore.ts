import { Preferences } from '@capacitor/preferences';
import type { FontSettings } from '@/stores/settingsStore';
import type { SessionType } from '@/stores/sessionsStore';

const STORAGE_PREFIX = 'local.session_font_settings.v1';
export type SessionFontSettingsValue = Pick<FontSettings, 'fontFamily' | 'quranFontSize' | 'lineHeight' | 'fontWeight'>;

const keyFor = (sessionType: SessionType | 'default') => `${STORAGE_PREFIX}.${sessionType}`;

export async function getSessionFontSettings(sessionType: SessionType | 'default'): Promise<Partial<SessionFontSettingsValue> | null> {
  const key = keyFor(sessionType);
  try {
    const nativeValue = await Preferences.get({ key });
    const raw = nativeValue.value ?? localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }
}

export async function saveSessionFontSettings(sessionType: SessionType | 'default', settings: Partial<SessionFontSettingsValue>): Promise<void> {
  const key = keyFor(sessionType);
  const value = JSON.stringify(settings);
  try { await Preferences.set({ key, value }); } catch {}
  try { localStorage.setItem(key, value); } catch {}
}