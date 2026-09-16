/**
 * Route host for "جلسة الحفظ بالتكرار".
 * Loads the mushaf pages, resolves the session, then hands over to the
 * session component. Fully independent from the review portals.
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuranData } from '@/hooks/useQuranData';
import { useSessionsStore } from '@/stores/sessionsStore';
import { MemorizationRepeatSession } from '@/components/MemorizationRepeatSession';
import { useMemorizationStore } from '@/stores/memorizationStore';
import { DEFAULT_RECITER_ID } from '@/services/quranAudio';

export default function Memorize() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paramSessionId = params.get('sessionId');
  const activeSessionId = useSessionsStore(s => s.activeSessionId);
  const sessionId = paramSessionId || activeSessionId;
  const sessions = useSessionsStore(s => s.sessions);
  const markSessionResumed = useSessionsStore(s => s.markSessionResumed);

  const session = useMemo(() => sessions.find(s => s.id === sessionId), [sessions, sessionId]);
  const { pages, isLoading, error } = useQuranData({ sessionId });

  // The progress store restores asynchronously; creating a record before that
  // finishes would overwrite the saved session.
  const hasHydrated = useMemorizationStore(s => s.hasHydrated);
  const ensure = useMemorizationStore(s => s.ensure);
  const [recordReady, setRecordReady] = React.useState(false);

  useEffect(() => {
    if (session) markSessionResumed(session.id);
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasHydrated || !session) return;
    ensure(session.id, {
      startPage: session.startPage || session.currentPage || 1,
      endPage: session.endPage || session.startPage || session.currentPage || 1,
      reciterId: DEFAULT_RECITER_ID,
    });
    setRecordReady(true);
  }, [hasHydrated, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && (!hasHydrated || !recordReady)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center gap-2 font-arabic text-muted-foreground" dir="rtl">
        <Loader2 className="w-5 h-5 animate-spin" /> جارٍ استعادة الجلسة…
      </div>
    );
  }


  if (!sessionId || (!session && sessions.length > 0)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6" dir="rtl">
        <p className="font-arabic text-sm text-muted-foreground">لم يتم العثور على الجلسة.</p>
        <Button className="font-arabic" onClick={() => navigate('/sessions')}>بوابة الجلسات</Button>
      </div>
    );
  }

  if (isLoading || !session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center gap-2 font-arabic text-muted-foreground" dir="rtl">
        <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6" dir="rtl">
        <p className="font-arabic text-sm text-destructive">{error}</p>
        <Button className="font-arabic" onClick={() => navigate('/sessions')}>رجوع</Button>
      </div>
    );
  }

  return (
    <MemorizationRepeatSession session={session} pages={pages} totalPages={pages.length || 604} />
  );
}
