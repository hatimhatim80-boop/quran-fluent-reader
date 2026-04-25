import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import type { Session } from '@/stores/sessionsStore';
import {
  getSessionCompletionStats,
  preventDuplicateCompletion,
  recordSessionCompletion,
} from '@/services/localSessionCompletionStore';

const STORAGE_KEY = 'local.session_completions.v1';
const session: Session = {
  id: 'test_tahfeez_session',
  name: 'جلسة اختبار',
  type: 'tahfeez',
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: 0,
  archived: false,
  currentPage: 1,
  startPage: 1,
  endPage: 1,
  status: 'active',
  resumeState: null,
};

describe('localSessionCompletionStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Preferences.remove({ key: STORAGE_KEY });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
  });

  it('يسجل الختمة محليًا ويمنع تكرار الاستدعاء السريع فقط ثم يسمح بختمات متتابعة', async () => {
    await expect(recordSessionCompletion(session, 'local_test_user')).resolves.toBe(true);
    await expect(preventDuplicateCompletion(session.id, 3_000, 'local_test_user')).resolves.toBe(true);
    await expect(recordSessionCompletion(session, 'local_test_user')).resolves.toBe(false);

    vi.setSystemTime(new Date('2026-04-25T12:00:05Z'));
    await expect(recordSessionCompletion(session, 'local_test_user')).resolves.toBe(true);

    vi.setSystemTime(new Date('2026-04-25T12:00:10Z'));
    await expect(recordSessionCompletion(session, 'local_test_user')).resolves.toBe(true);

    vi.setSystemTime(new Date('2026-04-25T12:00:15Z'));
    await expect(recordSessionCompletion(session, 'local_test_user')).resolves.toBe(true);

    const stats = await getSessionCompletionStats(session.id, 'local_test_user');
    expect(stats.total).toBe(4);
    expect(stats.thisMonth).toBe(4);
    expect(stats.byMonth).toEqual([{ month_key: '2026-04', count: 4 }]);
    expect(localStorage.getItem(STORAGE_KEY)).toContain(session.id);
  });
});
