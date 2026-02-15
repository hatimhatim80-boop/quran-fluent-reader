import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Plus, Play, Archive, Trash2, RotateCcw, Clock, ChevronDown, ChevronUp, Save, FolderOpen } from 'lucide-react';
import { useSessionsStore, Session, SessionSection } from '@/stores/sessionsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { pickSaveFile, autoSaveToFile, downloadAsFile, isFileSystemAccessSupported, hasActiveFileHandle } from '@/services/fileAutoSave';

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

function SectionsList({ session }: { session: Session }) {
  const { addSection, removeSection, updateSection } = useSessionsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('1');
  const [newEnd, setNewEnd] = useState('');

  const sections = session.sections || [];

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addSection(session.id, newTitle.trim(), parseInt(newStart) || 1, newEnd ? parseInt(newEnd) || undefined : undefined);
    setNewTitle('');
    setNewStart('1');
    setNewEnd('');
    setShowAdd(false);
  };

  if (sections.length === 0 && !showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        className="text-[9px] font-arabic text-muted-foreground hover:text-primary transition-colors"
      >
        + قسم فرعي
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[10px] font-arabic text-muted-foreground hover:text-foreground">
        {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        {sections.length} قسم فرعي
      </button>

      {expanded && (
        <div className="space-y-1 mr-3 border-r border-border/50 pr-2">
          {sections.map(sec => (
            <div key={sec.id} className="flex items-center gap-2 text-[10px] font-arabic">
              <span className="font-semibold text-foreground truncate flex-1">{sec.title}</span>
              <span className="text-muted-foreground">ص{sec.startPage}{sec.endPage ? `→${sec.endPage}` : ''}</span>
              <button onClick={() => removeSection(session.id, sec.id)} className="text-destructive hover:text-destructive/80">
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button onClick={() => setShowAdd(true)} className="text-[9px] font-arabic text-primary hover:text-primary/80">
            + إضافة قسم
          </button>
        </div>
      )}

      {showAdd && (
        <div className="mr-3 border-r border-border/50 pr-2 space-y-1.5 py-1.5">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="عنوان القسم" className="h-7 text-xs font-arabic" dir="rtl" />
          <div className="flex gap-1.5">
            <Input type="number" min={1} max={604} value={newStart} onChange={e => setNewStart(e.target.value)} placeholder="من" className="h-7 text-xs text-center w-16" />
            <Input type="number" min={1} max={604} value={newEnd} onChange={e => setNewEnd(e.target.value)} placeholder="إلى" className="h-7 text-xs text-center w-16" />
            <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newTitle.trim()} className="h-7 text-xs font-arabic px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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
    createSession(newName.trim(), newType, start, end);
    setShowCreate(false);
    setNewName('');
    setNewStartPage('1');
    setNewEndPage('');
    navigate(newType === 'ghareeb' ? '/mushaf' : '/tahfeez');
  };

  const handleContinue = (session: Session) => {
    setActiveSession(session.id);
    navigate(session.type === 'ghareeb' ? '/mushaf' : '/tahfeez');
  };

  const handleSaveToFile = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions,
    };
    if (isFileSystemAccessSupported() && !hasActiveFileHandle()) {
      const ok = await pickSaveFile();
      if (ok) {
        await autoSaveToFile(data);
        toast.success('تم ربط الملف - سيتم الحفظ التلقائي');
      }
    } else if (hasActiveFileHandle()) {
      await autoSaveToFile(data);
      toast.success('تم الحفظ');
    } else {
      downloadAsFile(data);
      toast.success('تم تحميل الملف');
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-arabic text-foreground">الجلسات</h3>
        <div className="flex gap-1.5">
          <button
            onClick={handleSaveToFile}
            className="text-[10px] font-arabic text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            title="حفظ في ملف"
          >
            <Save className="w-3 h-3" />
            حفظ
          </button>
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
        <div key={session.id} className="page-frame p-3 space-y-1 group">
          <div className="flex items-center gap-3">
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
              <SectionsList session={session} />
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
        </div>
      ))}

      {/* Archived sessions */}
      {showArchived && archivedSessions.map(session => (
        <div key={session.id} className="page-frame p-3 flex items-center gap-3 opacity-60 group">
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
              <Label className="font-arabic text-xs">اسم الجلسة (العنوان الرئيسي)</Label>
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
