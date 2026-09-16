/** Bootstrap host for the independent repetition-memorization session. */
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MemorizationRepeatSession } from '@/components/MemorizationRepeatSession';
import { Button } from '@/components/ui/button';
import { useQuranData } from '@/hooks/useQuranData';
import { DEFAULT_RECITER_ID } from '@/services/quranAudio';
import { useMemorizationStore } from '@/stores/memorizationStore';
import { useSessionsStore } from '@/stores/sessionsStore';

export default function Memorize() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedSessionId = params.get('sessionId');
  const activeSessionId = useSessionsStore(state => state.activeSessionId);
  const sessions = useSessionsStore(state => state.sessions);
  const markSessionResumed = useSessionsStore(state => state.markSessionResumed);
  const sessionId = requestedSessionId || activeSessionId;
  const session = useMemo(() => sessions.find(item => item.id === sessionId), [sessions, sessionId]);
  const { pages, isLoading, error } = useQuranData({ sessionId });
  const hasHydrated = useMemorizationStore(state => state.hasHydrated);
  const ensure = useMemorizationStore(state => state.ensure);
  const [recordReady, setRecordReady] = useState(false);

  useEffect(() => {
    setRecordReady(false);
    if (!hasHydrated || !session) return;
    ensure(session.id, {
      startPage: session.startPage || session.currentPage || 1,
      endPage: session.endPage || session.startPage || session.currentPage || 1,
      reciterId: DEFAULT_RECITER_ID,
    });
    setRecordReady(true);
    markSessionResumed(session.id);
  }, [ensure, hasHydrated, markSessionResumed, session]);

  if (!sessionId || (!session && sessions.length > 0)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6" dir="rtl">
        <p className="font-arabic text-sm text-muted-foreground">لم يتم العثور على الجلسة.</p>
        <Button className="font-arabic" onClick={() => navigate('/sessions')}>بوابة الجلسات</Button>
      </div>
    );
  }

  if (!session || !hasHydrated || !recordReady || isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center gap-2 font-arabic text-muted-foreground" dir="rtl">
        <Loader2 className="w-5 h-5 animate-spin" /> {session && !recordReady ? 'جارٍ استعادة الجلسة…' : 'جارٍ التحميل…'}
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

  return <MemorizationRepeatSession session={session} pages={pages} totalPages={pages.length || 604} />;
}
