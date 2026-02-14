import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Plus, Play, Archive, Trash2, RotateCcw, Clock } from 'lucide-react';
import { useSessionsStore, Session } from '@/stores/sessionsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

export function SessionManager() {
  const { sessions, createSession, archiveSession, unarchiveSession, deleteSession, setActiveSession } = useSessionsStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'ghareeb' | 'tahfeez'>('ghareeb');
  const [newStartPage, setNewStartPage] = useState('1');
  const [newEndPage, setNewEndPage] = useState('');

  const activeSessions = sessions.filter(s => !s.archived);
  const archivedSessions = sessions.filter(s => s.archived);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const start = parseInt(newStartPage) || 1;
    const end = newEndPage ? parseInt(newEndPage) || undefined : undefined;
    const id = createSession(newName.trim(), newType, start, end);
    setShowCreate(false);
    setNewName('');
    setNewStartPage('1');
    setNewEndPage('');
    // Navigate to the portal
    navigate(newType === 'ghareeb' ? '/mushaf' : '/tahfeez');
  };

  const handleContinue = (session: Session) => {
    setActiveSession(session.id);
    navigate(session.type === 'ghareeb' ? '/mushaf' : '/tahfeez');
  };

  if (activeSessions.length === 0 && archivedSessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-arabic text-foreground">الجلسات</h3>
        <div className="flex gap-1.5">
          {archivedSessions.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-[10px] font-arabic text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Archive className="w-3 h-3" />
              الأرشيف ({archivedSessions.length})
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="text-[10px] font-arabic text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            جلسة جديدة
          </button>
        </div>
      </div>

      {/* Active sessions */}
      {activeSessions.map(session => (
        <div
          key={session.id}
          className="page-frame p-3 flex items-center gap-3 group"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            session.type === 'ghareeb' ? 'bg-primary/10' : 'bg-accent/50'
          }`}>
            {session.type === 'ghareeb' 
              ? <BookOpen className="w-4 h-4 text-primary" />
              : <GraduationCap className="w-4 h-4 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-arabic font-semibold text-foreground truncate">{session.name}</p>
            <p className="text-[10px] font-arabic text-muted-foreground">
              ص {session.currentPage}
              {session.endPage && ` → ${session.endPage}`}
              {' · '}
              <Clock className="w-2.5 h-2.5 inline" /> {timeAgo(session.updatedAt)}
            </p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => archiveSession(session.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="أرشفة"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => handleContinue(session)} className="shrink-0 gap-1 text-xs font-arabic">
            <Play className="w-3 h-3" />
            متابعة
          </Button>
        </div>
      ))}

      {/* Archived sessions */}
      {showArchived && archivedSessions.map(session => (
        <div
          key={session.id}
          className="page-frame p-3 flex items-center gap-3 opacity-60 group"
        >
          <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
            {session.type === 'ghareeb' 
              ? <BookOpen className="w-4 h-4 text-muted-foreground" />
              : <GraduationCap className="w-4 h-4 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-arabic font-semibold text-foreground truncate">{session.name}</p>
            <p className="text-[10px] font-arabic text-muted-foreground">
              ص {session.currentPage}{session.endPage && ` → ${session.endPage}`}
            </p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => unarchiveSession(session.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
              title="استعادة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteSession(session.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic text-center">جلسة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-arabic text-xs">اسم الجلسة</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="مثال: مراجعة الجزء 30"
                className="font-arabic text-sm mt-1"
                dir="rtl"
              />
            </div>

            <div>
              <Label className="font-arabic text-xs">النوع</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setNewType('ghareeb')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    newType === 'ghareeb' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <span className="text-xs font-arabic">غريب</span>
                </button>
                <button
                  onClick={() => setNewType('tahfeez')}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    newType === 'tahfeez' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <GraduationCap className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <span className="text-xs font-arabic">تحفيظ</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-arabic text-xs">من صفحة</Label>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={newStartPage}
                  onChange={e => setNewStartPage(e.target.value)}
                  className="mt-1 text-center"
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">إلى صفحة (اختياري)</Label>
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={newEndPage}
                  onChange={e => setNewEndPage(e.target.value)}
                  placeholder="604"
                  className="mt-1 text-center"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!newName.trim()} className="w-full font-arabic gap-2">
              <Plus className="w-4 h-4" />
              إنشاء الجلسة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
