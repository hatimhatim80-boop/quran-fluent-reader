import { Preferences } from '@capacitor/preferences';
import type { Session, SessionType } from '@/stores/sessionsStore';

const STORAGE_KEY = 'local.session_completions.v1';
const LOCAL_USER_KEY = 'quran-app-local-user-id';
const TAHFEEZ_COMPLETABLE_TYPES: SessionType[] = ['tahfeez', 'tahfeez-test', 'tahfeez-auto', 'tahfeez-review'];

export interface LocalSessionCompletion {
  id: string;
  session_id: string;
  user_id: string;
  completed_at: number;
  month_key: string;
  session_type: SessionType;
  completion_count: number;
  created_at: number;
}

export interface LocalSessionCompletionStats {
  total: number;
  thisMonth: number;
  byMonth: { month_key: string; count: number }[];
}

function getMonthKey(ts: number = Date.now()): string {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLocalUserId(): string {
  try {
    const existing = localStorage.getItem(LOCAL_USER_KEY);
    if (existing) return existing;
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LOCAL_USER_KEY, id);
    return id;
  } catch {
    return 'local_user';
  }
}

async function readCompletions(): Promise<LocalSessionCompletion[]> {
  try {
    const nativeValue = await Preferences.get({ key: STORAGE_KEY });
    const raw = nativeValue.value ?? localStorage.getItem(STORAGE_KEY) ?? '[]';
    return JSON.parse(raw) as LocalSessionCompletion[];
  } catch {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as LocalSessionCompletion[]; }
    catch { return []; }
  }
}

async function writeCompletions(completions: LocalSessionCompletion[]): Promise<void> {
  const value = JSON.stringify(completions);
  try { await Preferences.set({ key: STORAGE_KEY, value }); } catch {}
  try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  window.dispatchEvent(new CustomEvent('local-session-completions-changed'));
}

export async function preventDuplicateCompletion(sessionId: string, withinMs = 60_000, userId = getLocalUserId()): Promise<boolean> {
  const now = Date.now();
  const completions = await readCompletions();
  return completions.some(c => c.session_id === sessionId && c.user_id === userId && now - c.completed_at < withinMs);
}

export async function recordSessionCompletion(session: Session, userId = getLocalUserId()): Promise<boolean> {
  if (!TAHFEEZ_COMPLETABLE_TYPES.includes(session.type)) return false;
  if (await preventDuplicateCompletion(session.id, 60_000, userId)) return false;
  const now = Date.now();
  const completions = await readCompletions();
  completions.push({
    id: `lsc_${now}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: session.id,
    user_id: userId,
    completed_at: now,
    month_key: getMonthKey(now),
    session_type: session.type,
    completion_count: 1,
    created_at: now,
  });
  await writeCompletions(completions);
  return true;
}

export async function getSessionMonthlyCompletions(sessionId: string, userId = getLocalUserId()): Promise<{ month_key: string; count: number }[]> {
  const completions = (await readCompletions()).filter(c => c.session_id === sessionId && c.user_id === userId);
  const monthMap = new Map<string, number>();
  completions.forEach(c => monthMap.set(c.month_key, (monthMap.get(c.month_key) || 0) + (c.completion_count || 1)));
  return Array.from(monthMap.entries())
    .map(([month_key, count]) => ({ month_key, count }))
    .sort((a, b) => b.month_key.localeCompare(a.month_key));
}

export async function getSessionCompletionStats(sessionId: string, userId = getLocalUserId()): Promise<LocalSessionCompletionStats> {
  const byMonth = await getSessionMonthlyCompletions(sessionId, userId);
  const total = byMonth.reduce((sum, row) => sum + row.count, 0);
  return { total, thisMonth: byMonth.find(row => row.month_key === getMonthKey())?.count || 0, byMonth };
}
