import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, GraduationCap, Plus, Play, Archive, Trash2, RotateCcw, Clock,
  FolderOpen, FolderPlus, ArrowRightLeft, Pencil, Search, ArrowRight,
  Copy, ChevronDown, SortAsc, Filter, Home as HomeIcon, FileText, Brain, Zap, BookMarked, BarChart3
} from 'lucide-react';
import { TAHFEEZ_COMPLETABLE_SESSION_TYPES, useSessionsStore, Session, SessionType, SessionGroup } from '@/stores/sessionsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

/* ─── helpers ─── */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return `منذ ${Math.floor(days / 30)} شهر`;
}

const SESSION_TYPE_META: Record<SessionType, { label: string; icon: React.ReactNode; color: string; portal: string }> = {
  'ghareeb': { label: 'غريب', icon: <BookOpen className="w-5 h-5" />, color: 'bg-primary/10 text-primary', portal: '/mushaf' },
  'ghareeb-review': { label: 'مراجعة الغريب', icon: <Brain className="w-5 h-5" />, color: 'bg-primary/10 text-primary', portal: '/mushaf' },
  'ghareeb-read': { label: 'قراءة الغريب', icon: <BookOpen className="w-5 h-5" />, color: 'bg-primary/10 text-primary', portal: '/mushaf' },
  'tahfeez': { label: 'تحفيظ', icon: <GraduationCap className="w-5 h-5" />, color: 'bg-accent/60 text-primary', portal: '/tahfeez' },
  'tahfeez-test': { label: 'اختبار تخزين', icon: <FileText className="w-5 h-5" />, color: 'bg-accent/60 text-primary', portal: '/tahfeez' },
  'tahfeez-auto': { label: 'اختبار تلقائي', icon: <Zap className="w-5 h-5" />, color: 'bg-accent/60 text-primary', portal: '/tahfeez' },
  'tahfeez-review': { label: 'مراجعة الحفظ', icon: <BookMarked className="w-5 h-5" />, color: 'bg-accent/60 text-primary', portal: '/tahfeez' },
};

type SortKey = 'lastOpenedAt' | 'name' | 'type' | 'createdAt';
type FilterTab = 'all' | 'ghareeb' | 'tahfeez' | 'recent' | 'archived';

/* ─── Session Card ─── */
function SessionCard({
  session,
  onContinue,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onArchive,
  onStats,
  groups,
}: {
  session: Session;
  onContinue: (s: Session) => void;
  onRename: (s: Session) => void;
  onDuplicate: (s: Session) => void;
  onMove: (s: Session) => void;
  onDelete: (s: Session) => void;
  onArchive: (s: Session) => void;
  onStats: (s: Session) => void;
  groups: SessionGroup[];
}) {
  const meta = SESSION_TYPE_META[session.type] || SESSION_TYPE_META['ghareeb'];
  const group = groups.find(g => g.id === session.groupId);
  const completionStats = useSessionsStore(s => s.getSessionCompletionStats(session.id));
  const showCompletionStats = TAHFEEZ_COMPLETABLE_SESSION_TYPES.includes(session.type);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow border-border/60">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
            {meta.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-arabic font-semibold text-foreground truncate">{session.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-arabic text-muted-foreground">
              <span className="bg-muted/60 px-1.5 py-0.5 rounded">{meta.label}</span>
              {group && (
                <span className="flex items-center gap-0.5">
                  <FolderOpen className="w-2.5 h-2.5" />
                  {group.name}
                </span>
              )}
              <span>ص {session.currentPage}{session.endPage ? ` → ${session.endPage}` : ''}</span>
              <span className="flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {timeAgo(session.lastOpenedAt || session.updatedAt)}
              </span>
            </div>

            {/* Progress bar */}
            {session.startPage && session.endPage && session.endPage > session.startPage && (
              <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((session.currentPage - session.startPage) / (session.endPage - session.startPage)) * 100)}%`,
                  }}
                />
              </div>
            )}

            {showCompletionStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => onStats(session)}
                  className="text-[10px] font-arabic text-right bg-muted/40 hover:bg-muted/70 border border-border/40 rounded-md px-2 py-1 transition-colors"
                >
                  خُتمت منذ إنشائها: <span className="font-bold text-foreground">{completionStats.total}</span> مرة
                </button>
                <button
                  onClick={() => onStats(session)}
                  className="text-[10px] font-arabic text-right bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-md px-2 py-1 text-primary transition-colors"
                >
                  خُتمت هذا الشهر: <span className="font-bold">{completionStats.thisMonth}</span> مرة
                </button>
              </div>
            )}
          </div>

          {/* Continue button */}
          <Button
            size="sm"
            onClick={() => onContinue(session)}
            className="shrink-0 gap-1 text-xs font-arabic h-9"
          >
            <Play className="w-3 h-3" />
            استئناف
          </Button>
        </div>

        {/* Action row — always visible, with edit/delete prominently themed */}
        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/40">
          <button
            onClick={() => onRename(session)}
            className="text-[11px] font-arabic text-foreground/80 hover:text-primary flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors"
            title="تعديل الاسم"
          >
            <Pencil className="w-3.5 h-3.5" />
            تعديل
          </button>
          <button
            onClick={() => onMove(session)}
            className="text-[11px] font-arabic text-foreground/80 hover:text-primary flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors"
            title="نقل لمجلد"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            نقل
          </button>
          <button
            onClick={() => onDuplicate(session)}
            className="text-[11px] font-arabic text-foreground/80 hover:text-primary flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors"
            title="تكرار الجلسة"
          >
            <Copy className="w-3.5 h-3.5" />
            نسخ
          </button>
          {showCompletionStats && (
            <button
              onClick={() => onStats(session)}
              className="text-[11px] font-arabic text-foreground/80 hover:text-primary flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors"
              title="إحصاءات الختم"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              إحصاءات
            </button>
          )}
          <button
            onClick={() => onArchive(session)}
            className="text-[11px] font-arabic text-foreground/80 hover:text-foreground flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors mr-auto"
            title="أرشفة"
          >
            <Archive className="w-3.5 h-3.5" />
            أرشفة
          </button>
          <button
            onClick={() => onDelete(session)}
            className="text-[11px] font-arabic text-destructive hover:text-destructive-foreground hover:bg-destructive flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors"
            title="حذف الجلسة"
          >
            <Trash2 className="w-3.5 h-3.5" />
            حذف
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function Sessions() {
  const navigate = useNavigate();
  const store = useSessionsStore();
  const { sessions, groups } = store;

  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('lastOpenedAt');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState<Session | null>(null);
  const [showMove, setShowMove] = useState<Session | null>(null);
  const [showDelete, setShowDelete] = useState<Session | null>(null);
  const [showStats, setShowStats] = useState<Session | null>(null);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<SessionType>('ghareeb-review');
  const [newStartPage, setNewStartPage] = useState('1');
  const [newEndPage, setNewEndPage] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [moveTargetGroup, setMoveTargetGroup] = useState('');

  /* ─── Filtering & Sorting ─── */
  const filteredSessions = useMemo(() => {
    let list = [...sessions];

    // Tab filter
    if (activeTab === 'archived') {
      list = list.filter(s => s.archived || s.status === 'archived');
    } else {
      list = list.filter(s => !s.archived && s.status !== 'archived');
      if (activeTab === 'ghareeb') list = list.filter(s => s.type.startsWith('ghareeb'));
      if (activeTab === 'tahfeez') list = list.filter(s => s.type.startsWith('tahfeez'));
      if (activeTab === 'recent') list = list.sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt)).slice(0, 10);
    }

    // Folder filter
    if (selectedFolder !== null) {
      list = list.filter(s => (s.groupId || '') === selectedFolder);
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (SESSION_TYPE_META[s.type]?.label || '').includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'lastOpenedAt') return (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt);
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt;
      return 0;
    });

    return list;
  }, [sessions, activeTab, selectedFolder, search, sortBy]);

  // Group sessions by folder for display
  const sessionsByGroup = useMemo(() => {
    if (selectedFolder !== null) return null; // already filtered
    const map = new Map<string, Session[]>();
    map.set('', []);
    groups.forEach(g => map.set(g.id, []));
    filteredSessions.forEach(s => {
      const key = s.groupId || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filteredSessions, groups, selectedFolder]);

  /* ─── Handlers ─── */
  const handleCreate = () => {
    const defaultNames: Record<SessionType, string> = {
      'ghareeb': 'جلسة غريب',
      'ghareeb-review': 'مراجعة الغريب',
      'ghareeb-read': 'قراءة الغريب',
      'tahfeez': 'جلسة تحفيظ',
      'tahfeez-test': 'اختبار تخزين',
      'tahfeez-auto': 'اختبار تلقائي',
      'tahfeez-review': 'مراجعة الحفظ',
    };
    const name = newName.trim() || `${defaultNames[newType]} - ${new Date().toLocaleDateString('ar-SA')}`;
    const start = parseInt(newStartPage) || 1;
    const end = newEndPage ? parseInt(newEndPage) || undefined : undefined;
    const gId = newGroupId && newGroupId !== 'none' ? newGroupId : undefined;
    const id = store.createSession(name, newType, start, end, gId);
    setShowCreate(false);
    setNewName('');
    setNewStartPage('1');
    setNewEndPage('');
    setNewGroupId('');
    toast.success('تم إنشاء الجلسة');
    // Navigate
    const portal = SESSION_TYPE_META[newType]?.portal || '/mushaf';
    localStorage.setItem(portal === '/mushaf' ? 'quran-app-ghareeb-start-page' : 'quran-app-tahfeez-start-page', String(start));
    store.setActiveSession(id);
    navigate(portal);
  };

  const handleContinue = (session: Session) => {
    store.setActiveSession(session.id);
    store.markSessionResumed(session.id);
    const portal = SESSION_TYPE_META[session.type]?.portal || '/mushaf';
    // Also set localStorage as fallback
    localStorage.setItem(
      portal === '/mushaf' ? 'quran-app-ghareeb-start-page' : 'quran-app-tahfeez-start-page',
      String(session.currentPage)
    );
    // Navigate with sessionId and resume flag in search params
    navigate(`${portal}?sessionId=${session.id}&resume=1`);
  };

  const handleRename = () => {
    if (!showRename || !renameValue.trim()) return;
    store.updateSession(showRename.id, { name: renameValue.trim() });
    setShowRename(null);
    toast.success('تم تغيير الاسم');
  };

  const handleMove = () => {
    if (!showMove) return;
    store.moveSessionToGroup(showMove.id, moveTargetGroup && moveTargetGroup !== 'none' ? moveTargetGroup : undefined);
    setShowMove(null);
    toast.success('تم نقل الجلسة');
  };

  const handleDuplicate = (session: Session) => {
    store.createSession(
      `${session.name} (نسخة)`,
      session.type,
      session.startPage || 1,
      session.endPage,
      session.groupId
    );
    toast.success('تم نسخ الجلسة');
  };

  const handleDelete = () => {
    if (!showDelete) return;
    store.deleteSession(showDelete.id);
    setShowDelete(null);
    toast.success('تم حذف الجلسة');
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    store.addGroup(newFolderName.trim());
    setNewFolderName('');
    setShowFolderCreate(false);
    toast.success('تم إنشاء المجلد');
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'ghareeb', label: 'الغريب' },
    { key: 'tahfeez', label: 'الحفظ' },
    { key: 'recent', label: 'الأخيرة' },
    { key: 'archived', label: 'الأرشيف' },
  ];

  const sessionTypes: { type: SessionType; label: string; desc: string; icon: React.ReactNode }[] = [
    { type: 'ghareeb-review', label: 'مراجعة الغريب', desc: 'مراجعة الكلمات الغريبة مع إخفاء المعاني', icon: <Brain className="w-6 h-6" /> },
    { type: 'ghareeb-read', label: 'قراءة الغريب', desc: 'قراءة المصحف مع تظليل الغريب ومعانيه', icon: <BookOpen className="w-6 h-6" /> },
    { type: 'tahfeez-test', label: 'اختبار تخزين', desc: 'اختبار الحفظ بإخفاء كلمات من الآيات', icon: <FileText className="w-6 h-6" /> },
    { type: 'tahfeez-auto', label: 'اختبار تلقائي', desc: 'ظهور تلقائي تدريجي للكلمات', icon: <Zap className="w-6 h-6" /> },
    { type: 'tahfeez-review', label: 'مراجعة الحفظ', desc: 'مراجعة ذكية للآيات المحفوظة', icon: <BookMarked className="w-6 h-6" /> },
  ];

  const renderSessions = (list: Session[]) =>
    list.map(s => (
      <SessionCard
        key={s.id}
        session={s}
        groups={groups}
        onContinue={handleContinue}
        onRename={(s) => { setShowRename(s); setRenameValue(s.name); }}
        onDuplicate={handleDuplicate}
        onMove={(s) => { setShowMove(s); setMoveTargetGroup(s.groupId || ''); }}
        onDelete={(s) => setShowDelete(s)}
        onStats={(s) => setShowStats(s)}
        onArchive={(s) => { store.archiveSession(s.id); toast.success('تم الأرشفة'); }}
      />
    ));

  const statsForDialog = showStats ? store.getSessionCompletionStats(showStats.id) : null;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted/60 transition-colors shrink-0">
            <ArrowRight className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold font-arabic text-foreground flex-1">بوابة الجلسات</h1>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1 text-xs font-arabic">
            <Plus className="w-4 h-4" />
            جلسة جديدة
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-20">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الجلسات..."
            className="pr-9 font-arabic text-sm"
            dir="rtl"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedFolder(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-arabic whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {t.label}
              {t.key === 'archived' && sessions.filter(s => s.archived).length > 0 &&
                ` (${sessions.filter(s => s.archived).length})`
              }
            </button>
          ))}
        </div>

        {/* Sort & Folder controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-auto h-8 text-xs font-arabic gap-1 border-border/50">
              <SortAsc className="w-3 h-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastOpenedAt">آخر استخدام</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="type">النوع</SelectItem>
              <SelectItem value="createdAt">تاريخ الإنشاء</SelectItem>
            </SelectContent>
          </Select>

          {/* Folder filter chips */}
          {groups.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`text-[10px] font-arabic px-2 py-1 rounded-md border transition-colors ${
                  selectedFolder === null ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setSelectedFolder('')}
                className={`text-[10px] font-arabic px-2 py-1 rounded-md border transition-colors ${
                  selectedFolder === '' ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                غير مصنفة
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedFolder(g.id)}
                  className={`text-[10px] font-arabic px-2 py-1 rounded-md border transition-colors flex items-center gap-0.5 ${
                    selectedFolder === g.id ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FolderOpen className="w-2.5 h-2.5" />
                  {g.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowFolderCreate(true)}
            className="text-[10px] font-arabic text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-2 py-1 rounded-md border border-dashed border-border/50 hover:border-border transition-colors"
          >
            <FolderPlus className="w-3 h-3" />
            مجلد جديد
          </button>
        </div>

        {/* Folder management inline */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-0.5 text-[10px] bg-muted/40 rounded px-1.5 py-0.5">
                {editingGroupId === g.id ? (
                  <Input
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                    className="h-5 text-[10px] font-arabic w-20 p-1"
                    dir="rtl"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { store.renameGroup(g.id, editGroupName); setEditingGroupId(null); }
                      if (e.key === 'Escape') setEditingGroupId(null);
                    }}
                    onBlur={() => { store.renameGroup(g.id, editGroupName); setEditingGroupId(null); }}
                  />
                ) : (
                  <span className="font-arabic text-foreground">{g.name}</span>
                )}
                <button onClick={() => { setEditingGroupId(g.id); setEditGroupName(g.name); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => { if (confirm('حذف المجلد؟ ستنتقل الجلسات إلى "غير مصنفة".')) store.deleteGroup(g.id); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sessions list */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-arabic text-muted-foreground">
              {search ? 'لا توجد نتائج' : 'لا توجد جلسات بعد'}
            </p>
            {!search && (
              <Button variant="outline" onClick={() => setShowCreate(true)} className="font-arabic text-xs gap-1">
                <Plus className="w-4 h-4" />
                إنشاء جلسة جديدة
              </Button>
            )}
          </div>
        ) : selectedFolder !== null || activeTab === 'archived' ? (
          <div className="space-y-2">
            {activeTab === 'archived'
              ? filteredSessions.map(s => (
                  <Card key={s.id} className="overflow-hidden opacity-70">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-muted/50`}>
                        {SESSION_TYPE_META[s.type]?.icon || <BookOpen className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-arabic font-semibold truncate">{s.name}</p>
                        <p className="text-[10px] font-arabic text-muted-foreground">ص {s.currentPage}</p>
                      </div>
                      <button onClick={() => { store.unarchiveSession(s.id); toast.success('تم الاستعادة'); }} className="text-muted-foreground hover:text-foreground" title="استعادة">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowDelete(s)} className="text-muted-foreground hover:text-destructive" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </CardContent>
                  </Card>
                ))
              : renderSessions(filteredSessions)
            }
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grouped display */}
            {sessionsByGroup && Array.from(sessionsByGroup.entries()).map(([gId, list]) => {
              if (list.length === 0) return null;
              const group = groups.find(g => g.id === gId);
              return (
                <div key={gId || '__ungrouped'} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-arabic font-bold text-muted-foreground">
                      {group?.name || 'غير مصنفة'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">({list.length})</span>
                  </div>
                  <div className="space-y-2">
                    {renderSessions(list)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create Session Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">جلسة جديدة</DialogTitle>
            <DialogDescription className="font-arabic text-center text-xs">اختر نوع الجلسة ثم حدد الإعدادات</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Session type picker */}
            <div>
              <Label className="font-arabic text-xs">نوع الجلسة</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {sessionTypes.map(st => (
                  <button
                    key={st.type}
                    onClick={() => setNewType(st.type)}
                    className={`p-3 rounded-lg border text-right flex items-center gap-3 transition-all ${
                      newType === st.type ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${SESSION_TYPE_META[st.type].color}`}>
                      {st.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-arabic font-semibold">{st.label}</p>
                      <p className="text-[10px] font-arabic text-muted-foreground">{st.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label className="font-arabic text-xs">اسم الجلسة (اختياري)</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="سيتم إنشاء اسم تلقائي إن تُرك فارغًا"
                className="font-arabic text-sm mt-1"
                dir="rtl"
              />
            </div>

            {/* Group */}
            {groups.length > 0 && (
              <div>
                <Label className="font-arabic text-xs">المجلد (اختياري)</Label>
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger className="mt-1 font-arabic text-sm">
                    <SelectValue placeholder="بدون مجلد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مجلد</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Page range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-arabic text-xs">من صفحة</Label>
                <Input type="number" min={1} max={604} value={newStartPage} onChange={e => setNewStartPage(e.target.value)} className="mt-1 text-center" />
              </div>
              <div>
                <Label className="font-arabic text-xs">إلى صفحة (اختياري)</Label>
                <Input type="number" min={1} max={604} value={newEndPage} onChange={e => setNewEndPage(e.target.value)} placeholder="604" className="mt-1 text-center" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} className="w-full font-arabic gap-2">
              <Plus className="w-4 h-4" />
              إنشاء الجلسة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rename Dialog ─── */}
      <Dialog open={!!showRename} onOpenChange={() => setShowRename(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">تغيير اسم الجلسة</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="font-arabic" dir="rtl" onKeyDown={e => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button onClick={handleRename} disabled={!renameValue.trim()} className="w-full font-arabic">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Move Dialog ─── */}
      <Dialog open={!!showMove} onOpenChange={() => setShowMove(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">نقل إلى مجلد</DialogTitle>
          </DialogHeader>
          <Select value={moveTargetGroup} onValueChange={setMoveTargetGroup}>
            <SelectTrigger className="font-arabic">
              <SelectValue placeholder="اختر المجلد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون مجلد</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleMove} className="w-full font-arabic">نقل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Completion Stats Dialog ─── */}
      <Dialog open={!!showStats} onOpenChange={() => setShowStats(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">إحصاءات الختم</DialogTitle>
            <DialogDescription className="font-arabic text-center text-xs">{showStats?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 font-arabic">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/50 border border-border/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">منذ الإنشاء</p>
                <p className="text-xl font-bold text-foreground">{statsForDialog?.total || 0}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                <p className="text-[11px] text-primary/80">هذا الشهر</p>
                <p className="text-xl font-bold text-primary">{statsForDialog?.thisMonth || 0}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="grid grid-cols-2 bg-muted/50 px-3 py-2 text-xs font-bold text-muted-foreground">
                <span>الشهر</span>
                <span className="text-left">عدد الختمات</span>
              </div>
              {(statsForDialog?.byMonth.length || 0) > 0 ? statsForDialog!.byMonth.map(row => (
                <div key={row.month_key} className="grid grid-cols-2 px-3 py-2 text-sm border-t border-border/40">
                  <span className="font-mono">{row.month_key}</span>
                  <span className="text-left">{row.count} مرات</span>
                </div>
              )) : (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد ختمات مسجلة بعد</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">حذف الجلسة</DialogTitle>
            <DialogDescription className="font-arabic text-center">
              هل أنت متأكد من حذف "{showDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDelete(null)} className="flex-1 font-arabic">إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} className="flex-1 font-arabic">حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Folder Create Dialog ─── */}
      <Dialog open={showFolderCreate} onOpenChange={setShowFolderCreate}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">مجلد جديد</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="اسم المجلد"
            className="font-arabic"
            dir="rtl"
            onKeyDown={e => e.key === 'Enter' && handleAddFolder()}
          />
          <DialogFooter>
            <Button onClick={handleAddFolder} disabled={!newFolderName.trim()} className="w-full font-arabic gap-1">
              <FolderPlus className="w-4 h-4" />
              إنشاء المجلد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}