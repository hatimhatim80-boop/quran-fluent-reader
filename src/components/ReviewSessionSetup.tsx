import React, { useState, useMemo, useCallback } from 'react';
import { useSRSStore, SRSCard } from '@/stores/srsStore';
import { useReviewSessionStore, SessionType, SessionOrder, ArchiveFilter, ReviewSessionMeta } from '@/stores/reviewSessionStore';
import { SRSScopeSelector, SRSScope, scopeToPages } from './SRSScopeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Play, Clock, Trash2 } from 'lucide-react';

interface ReviewSessionSetupProps {
  portal: 'ghareeb' | 'tahfeez';
  currentPage: number;
  /** Called with selected cards when session starts or resumes */
  onStartSession: (cards: SRSCard[], sessionId: string, sessionName: string) => void;
  /** Extra UI to show (e.g., add words buttons) */
  headerContent?: React.ReactNode;
  /** Extra UI for portal-specific settings */
  extraSettings?: React.ReactNode;
  /** Custom card pool filter */
  cardTypeFilter?: SRSCard['type'] | SRSCard['type'][];
  /** Called to auto-generate cards for scope if pool is empty */
  onAutoGenerateCards?: (pages: number[]) => number;
}

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string; desc: string }[] = [
  { value: 'due', label: 'المستحقة', desc: 'البطاقات المستحقة الآن فقط' },
  { value: 'new', label: 'جديدة', desc: 'بطاقات لم تُراجع بعد' },
  { value: 'mixed', label: 'مختلطة', desc: 'مستحقة + جديدة معاً' },
  { value: 'flagged', label: 'المعلّمة', desc: 'البطاقات المحددة بعلامة' },
  { value: 'archived-only', label: 'المؤرشفة', desc: 'مراجعة البطاقات المؤرشفة سابقاً' },
  { value: 'scope', label: 'نطاق محدد', desc: 'كل بطاقات النطاق المختار' },
];

const ORDER_OPTIONS: { value: SessionOrder; label: string }[] = [
  { value: 'smart', label: 'ذكي (الأقدم أولاً)' },
  { value: 'mushaf', label: 'ترتيب المصحف' },
  { value: 'random', label: 'عشوائي' },
];

const ARCHIVE_FILTER_OPTIONS: { value: ArchiveFilter; label: string }[] = [
  { value: 'exclude', label: 'استبعاد المؤرشفة' },
  { value: 'include', label: 'تضمين المؤرشفة' },
  { value: 'only', label: 'المؤرشفة فقط' },
];

function formatArabicNumber(n: number): string {
  return new Intl.NumberFormat('ar-SA').format(n);
}

export function ReviewSessionSetup({
  portal,
  currentPage,
  onStartSession,
  headerContent,
  extraSettings,
  cardTypeFilter,
  onAutoGenerateCards,
}: ReviewSessionSetupProps) {
  const { getDueCards, getCardsByPages, cards, getFlaggedCards, getArchivedCards } = useSRSStore();
  const { getActiveSession, getRecentSessions, createSession, deleteSession, completeSession } = useReviewSessionStore();

  const [sessionType, setSessionType] = useState<SessionType>('due');
  const [scope, setScope] = useState<SRSScope>({ type: 'all-due', from: currentPage, to: currentPage });
  const [sessionSize, setSessionSize] = useState<string>('all');
  const [order, setOrder] = useState<SessionOrder>('smart');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('exclude');
  const [sessionName, setSessionName] = useState('');

  const typeFilters = useMemo(() => {
    if (!cardTypeFilter) return undefined;
    return Array.isArray(cardTypeFilter) ? cardTypeFilter : [cardTypeFilter];
  }, [cardTypeFilter]);

  const scopePages = useMemo(
    () => scopeToPages({ ...scope, from: scope.type === 'current-page' ? currentPage : scope.from }),
    [scope, currentPage],
  );

  // Active incomplete session
  const activeSession = useMemo(() => getActiveSession(portal), [portal, getActiveSession]);
  const recentSessions = useMemo(() => getRecentSessions(portal, 5), [portal, getRecentSessions]);

  // Build card pool based on session type
  const cardPool = useMemo(() => {
    let pool: SRSCard[] = [];
    const filterByType = (list: SRSCard[]) => {
      if (!typeFilters) return list;
      return list.filter(c => typeFilters.includes(c.type));
    };

    switch (sessionType) {
      case 'due':
        pool = filterByType(
          scopePages
            ? getDueCards(undefined, undefined, scopePages)
            : getDueCards()
        );
        break;
      case 'new':
        pool = filterByType(cards).filter(c =>
          c.repetitions === 0 && !c.archived && !c.flagged
        );
        if (scopePages) {
          const ps = new Set(scopePages);
          pool = pool.filter(c => ps.has(c.page));
        }
        break;
      case 'mixed': {
        const due = filterByType(
          scopePages ? getDueCards(undefined, undefined, scopePages) : getDueCards()
        ).filter(c => typeFilters ? typeFilters.includes(c.type) : true);
        const newCards = filterByType(cards).filter(c =>
          c.repetitions === 0 && !c.archived && !c.flagged
        );
        const dueSet = new Set(due.map(c => c.id));
        pool = [...due, ...newCards.filter(c => !dueSet.has(c.id))];
        if (scopePages) {
          const ps = new Set(scopePages);
          pool = pool.filter(c => ps.has(c.page));
        }
        break;
      }
      case 'flagged':
        pool = filterByType(getFlaggedCards());
        if (scopePages) {
          const ps = new Set(scopePages);
          pool = pool.filter(c => ps.has(c.page));
        }
        break;
      case 'archived-only':
        pool = filterByType(getArchivedCards());
        if (scopePages) {
          const ps = new Set(scopePages);
          pool = pool.filter(c => ps.has(c.page));
        }
        break;
      case 'scope':
        if (scopePages) {
          pool = filterByType(getCardsByPages(scopePages));
        } else {
          pool = filterByType(cards);
        }
        break;
    }

    // Apply archive filter (except for archive-specific types)
    if (sessionType !== 'archived-only') {
      if (archiveFilter === 'exclude') pool = pool.filter(c => !c.archived);
      else if (archiveFilter === 'only') pool = pool.filter(c => c.archived);
    }

    return pool;
  }, [sessionType, scopePages, cards, getDueCards, getFlaggedCards, getArchivedCards, getCardsByPages, typeFilters, archiveFilter]);

  // Apply order
  const orderedPool = useMemo(() => {
    const pool = [...cardPool];
    switch (order) {
      case 'mushaf':
        pool.sort((a, b) => a.page - b.page || a.id.localeCompare(b.id));
        break;
      case 'random':
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        break;
      case 'smart':
      default:
        pool.sort((a, b) => a.nextReview - b.nextReview);
        break;
    }
    return pool;
  }, [cardPool, order]);

  const availableCount = orderedPool.length;
  const maxCount = sessionSize === 'all' ? availableCount : Math.min(parseInt(sessionSize, 10) || 1, availableCount);
  const quickSizes = Array.from(new Set([10, 20, 50, 100, 200, availableCount].filter(n => n > 0))).sort((a, b) => a - b);

  const handleStart = useCallback(() => {
    let pool = orderedPool;

    // Auto-generate if empty
    if (pool.length === 0 && onAutoGenerateCards && scopePages && scopePages.length > 0) {
      const added = onAutoGenerateCards(scopePages);
      if (added > 0) {
        // Re-fetch
        const state = useSRSStore.getState();
        const ps = new Set(scopePages);
        pool = typeFilters
          ? state.cards.filter(c => typeFilters.includes(c.type) && ps.has(c.page))
          : state.cards.filter(c => ps.has(c.page));
      }
    }

    if (pool.length === 0) return;

    const selected = pool.slice(0, maxCount);
    const name = sessionName.trim() || `${portal === 'ghareeb' ? 'غريب' : 'تحفيظ'} — ${new Date().toLocaleDateString('ar-SA')}`;

    const sessionId = createSession({
      portal,
      name,
      sessionType,
      scopeLabel: scope.type,
      cardIds: selected.map(c => c.id),
      settings: { order, archiveFilter },
    });

    onStartSession(selected, sessionId, name);
  }, [orderedPool, maxCount, sessionName, portal, sessionType, scope, order, archiveFilter, createSession, onStartSession, onAutoGenerateCards, scopePages, typeFilters]);

  const handleResume = useCallback((session: ReviewSessionMeta) => {
    const state = useSRSStore.getState();
    const sessionCards = session.cardIds
      .map(id => state.cards.find(c => c.id === id))
      .filter((c): c is SRSCard => !!c);

    if (sessionCards.length === 0) {
      completeSession(session.id);
      return;
    }

    onStartSession(sessionCards, session.id, session.name);
  }, [completeSession, onStartSession]);

  return (
    <div className="p-4 space-y-4 font-arabic" dir="rtl">
      {/* Resume active session */}
      {activeSession && !activeSession.completed && (
        <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-primary">جلسة نشطة</h3>
            <span className="text-[10px] text-muted-foreground">
              {new Date(activeSession.updatedAt).toLocaleString('ar-SA', { timeStyle: 'short' })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{activeSession.name}</p>
          <div className="flex items-center gap-2 text-[11px]">
            <span>{formatArabicNumber(activeSession.reviewedIds.length)} / {formatArabicNumber(activeSession.cardIds.length)}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(activeSession.reviewedIds.length / activeSession.cardIds.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleResume(activeSession)} className="flex-1 gap-1 font-arabic" size="sm">
              <Play className="w-3 h-3" /> استئناف
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-arabic text-xs"
              onClick={() => completeSession(activeSession.id)}
            >
              إنهاء
            </Button>
          </div>
        </div>
      )}

      {headerContent}

      {/* Session type */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <h3 className="font-bold text-sm">نوع الجلسة</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SESSION_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSessionType(opt.value)}
              className={`px-2 py-2 rounded-lg text-[11px] transition-colors border ${
                sessionType === opt.value
                  ? 'bg-primary/10 border-primary/40 text-primary font-bold'
                  : 'border-border hover:bg-muted/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {SESSION_TYPE_OPTIONS.find(o => o.value === sessionType)?.desc}
        </p>
      </div>

      {/* Scope */}
      <div className="bg-card border border-border rounded-lg p-3">
        <SRSScopeSelector scope={scope} onChange={setScope} currentPage={currentPage} showFlagged />
      </div>

      {/* Archive filter */}
      {sessionType !== 'archived-only' && sessionType !== 'flagged' && (
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">فلتر الأرشفة</span>
            <Select value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as ArchiveFilter)}>
              <SelectTrigger className="w-40 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARCHIVE_FILTER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Order */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">ترتيب الجلسة</span>
          <Select value={order} onValueChange={(v) => setOrder(v as SessionOrder)}>
            <SelectTrigger className="w-44 h-8 text-xs font-arabic"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {extraSettings}

      {/* Session name & count */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm">إعدادات الجلسة</h3>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">اسم الجلسة (اختياري)</span>
          <Input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="جلسة مراجعة..."
            className="h-9 text-sm font-arabic"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
            <p className="text-3xl font-bold text-primary leading-none">{formatArabicNumber(maxCount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">سيبدأ بها</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
            <p className="text-3xl font-bold text-foreground leading-none">{formatArabicNumber(availableCount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">المتاح</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">عدد البطاقات</span>
            <Button
              variant={sessionSize === 'all' ? 'default' : 'outline'}
              size="sm"
              className="font-arabic"
              onClick={() => setSessionSize('all')}
            >
              الكل
            </Button>
          </div>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={sessionSize === 'all' ? '' : sessionSize}
            onChange={(e) => setSessionSize(e.target.value === '' ? 'all' : e.target.value)}
            placeholder={availableCount > 0 ? `حتى ${formatArabicNumber(availableCount)}` : '0'}
            className="h-12 text-center text-2xl font-bold font-arabic"
          />
          <div className="flex flex-wrap gap-2">
            {quickSizes.map(count => (
              <Button
                key={count}
                variant={sessionSize !== 'all' && parseInt(sessionSize) === count ? 'default' : 'outline'}
                size="sm"
                className="font-arabic min-w-[4rem]"
                onClick={() => setSessionSize(String(count))}
              >
                {formatArabicNumber(count)}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={availableCount === 0}
          className="w-full gap-2 font-arabic"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          بدء المراجعة ({formatArabicNumber(maxCount)})
        </Button>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2">
          <h3 className="font-bold text-xs text-muted-foreground">جلسات سابقة</h3>
          {recentSessions.filter(s => s.completed).slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-muted/40">
              <div className="flex-1 truncate">
                <span>{s.name}</span>
                <span className="text-[10px] text-muted-foreground mr-2">
                  {formatArabicNumber(s.reviewedIds.length)}/{formatArabicNumber(s.cardIds.length)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3 inline" /> {new Date(s.updatedAt).toLocaleDateString('ar-SA')}
                </span>
                <button onClick={() => deleteSession(s.id)} className="p-1 hover:bg-accent rounded">
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
