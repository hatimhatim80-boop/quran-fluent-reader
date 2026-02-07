import React, { useState } from 'react';
import { X, Edit3, ArrowRight, Ban, Check, Copy, Users, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCorrectionsStore, CorrectionType, DuplicateScope, WordCorrection } from '@/stores/correctionsStore';
import { MismatchEntry } from '@/utils/matchingValidator';
import { toast } from 'sonner';

interface CorrectionDialogProps {
  mismatch: MismatchEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: number) => void;
  allWords?: Array<{ word: string; surah: number; ayah: number; wordIndex: number; page: number }>;
}

const CORRECTION_TYPES: { value: CorrectionType; label: string; description: string }[] = [
  { value: 'page_override', label: 'تصحيح الصفحة فقط', description: 'تحديد الصفحة الصحيحة للكلمة' },
  { value: 'full_match', label: 'تصحيح المطابقة بالكامل', description: 'تعديل السورة/الآية/الكلمة' },
  { value: 'meaning_override', label: 'تصحيح المعنى', description: 'تحديد المعنى الصحيح يدوياً' },
];

const DUPLICATE_SCOPES: { value: DuplicateScope; label: string }[] = [
  { value: 'single', label: 'هذه الكلمة فقط' },
  { value: 'same_page', label: 'نفس الكلمة في نفس الصفحة' },
  { value: 'all_pages', label: 'نفس الكلمة في كل الصفحات' },
  { value: 'same_surah_ayah', label: 'نفس الموقع (سورة/آية/مؤشر)' },
];

export function CorrectionDialog({ mismatch, isOpen, onClose, onNavigate, allWords = [] }: CorrectionDialogProps) {
  const { addCorrection, applyToDuplicates, getCorrection } = useCorrectionsStore();
  
  const [correctionType, setCorrectionType] = useState<CorrectionType>('page_override');
  const [duplicateScope, setDuplicateScope] = useState<DuplicateScope>('single');
  const [applyToDuplicatesChecked, setApplyToDuplicatesChecked] = useState(false);
  
  // Page correction
  const [correctedPage, setCorrectedPage] = useState('');
  
  // Full match correction
  const [correctedSurah, setCorrectedSurah] = useState('');
  const [correctedAyah, setCorrectedAyah] = useState('');
  const [correctedWordIndex, setCorrectedWordIndex] = useState('');
  
  // Meaning correction
  const [meaningText, setMeaningText] = useState('');
  const [meaningNotes, setMeaningNotes] = useState('');

  // Reset form when mismatch changes
  React.useEffect(() => {
    if (mismatch) {
      setCorrectedPage(mismatch.foundInPages?.[0]?.toString() || '');
      setCorrectedSurah(mismatch.word.surahNumber.toString());
      setCorrectedAyah(mismatch.word.verseNumber.toString());
      setCorrectedWordIndex(mismatch.word.wordIndex.toString());
      setMeaningText(mismatch.word.meaning || '');
      
      // Check if correction exists
      const existing = getCorrection(mismatch.word.uniqueKey);
      if (existing) {
        setCorrectionType(existing.type);
        if (existing.correctedPage) setCorrectedPage(existing.correctedPage.toString());
        if (existing.meaningTextOverride) setMeaningText(existing.meaningTextOverride);
      }
    }
  }, [mismatch, getCorrection]);

  if (!mismatch) return null;

  const handleSave = () => {
    const word = mismatch.word;
    
    const correctionData: Omit<WordCorrection, 'id' | 'createdAt' | 'updatedAt'> = {
      originalKey: word.uniqueKey,
      originalWord: word.wordText,
      originalSurah: word.surahNumber,
      originalAyah: word.verseNumber,
      originalWordIndex: word.wordIndex,
      originalPage: word.pageNumber,
      type: correctionType,
      ignored: false,
    };

    // Apply based on type
    if (correctionType === 'page_override') {
      const page = parseInt(correctedPage);
      if (isNaN(page) || page < 1 || page > 604) {
        toast.error('رقم صفحة غير صالح');
        return;
      }
      correctionData.correctedPage = page;
    } else if (correctionType === 'full_match') {
      const surah = parseInt(correctedSurah);
      const ayah = parseInt(correctedAyah);
      const widx = parseInt(correctedWordIndex);
      if (isNaN(surah) || isNaN(ayah)) {
        toast.error('بيانات غير صالحة');
        return;
      }
      correctionData.correctedSurah = surah;
      correctionData.correctedAyah = ayah;
      correctionData.correctedWordIndex = widx || 1;
    } else if (correctionType === 'meaning_override') {
      if (!meaningText.trim()) {
        toast.error('المعنى مطلوب');
        return;
      }
      correctionData.meaningTextOverride = meaningText.trim();
      correctionData.notes = meaningNotes.trim() || undefined;
    }

    // Add correction
    addCorrection(correctionData);
    
    // Apply to duplicates if checked
    if (applyToDuplicatesChecked && duplicateScope !== 'single') {
      const count = applyToDuplicates(
        { ...correctionData, id: '', createdAt: '', updatedAt: '' } as WordCorrection,
        duplicateScope,
        allWords
      );
      toast.success(`تم تطبيق التصحيح على ${count + 1} كلمة`);
    } else {
      toast.success('تم حفظ التصحيح');
    }

    onClose();
  };

  const handleIgnore = () => {
    const word = mismatch.word;
    addCorrection({
      originalKey: word.uniqueKey,
      originalWord: word.wordText,
      originalSurah: word.surahNumber,
      originalAyah: word.verseNumber,
      originalWordIndex: word.wordIndex,
      originalPage: word.pageNumber,
      type: 'page_override',
      ignored: true,
    });
    toast.success('تم تجاهل الكلمة');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            تصحيح الكلمة
          </DialogTitle>
        </DialogHeader>

        {/* Word Info */}
        <div className="page-frame p-4 space-y-2">
          <div className="text-center">
            <span className="text-2xl font-arabic font-bold">{mismatch.word.wordText}</span>
          </div>
          <div className="text-sm text-muted-foreground font-arabic text-center">
            {mismatch.word.surahName} - آية {mismatch.word.verseNumber} - صفحة {mismatch.word.pageNumber}
          </div>
          <div className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded text-center font-arabic">
            <AlertTriangle className="w-3 h-3 inline ml-1" />
            {mismatch.detail}
          </div>
        </div>

        {/* Correction Type */}
        <div className="space-y-3">
          <Label className="font-arabic font-bold">نوع التصحيح</Label>
          <RadioGroup value={correctionType} onValueChange={(v) => setCorrectionType(v as CorrectionType)}>
            {CORRECTION_TYPES.map((type) => (
              <div key={type.value} className="flex items-start gap-2">
                <RadioGroupItem value={type.value} id={type.value} className="mt-1" />
                <div>
                  <Label htmlFor={type.value} className="font-arabic cursor-pointer">{type.label}</Label>
                  <p className="text-xs text-muted-foreground font-arabic">{type.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Page Override Form */}
        {correctionType === 'page_override' && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <Label className="font-arabic">الصفحة الصحيحة</Label>
            <Input
              type="number"
              min={1}
              max={604}
              value={correctedPage}
              onChange={(e) => setCorrectedPage(e.target.value)}
              placeholder="1-604"
            />
            {mismatch.foundInPages && mismatch.foundInPages.length > 0 && (
              <div className="text-xs text-muted-foreground font-arabic">
                مقترح: {mismatch.foundInPages.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Full Match Form */}
        {correctionType === 'full_match' && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="font-arabic text-xs">السورة</Label>
                <Input
                  type="number"
                  min={1}
                  max={114}
                  value={correctedSurah}
                  onChange={(e) => setCorrectedSurah(e.target.value)}
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">الآية</Label>
                <Input
                  type="number"
                  min={1}
                  value={correctedAyah}
                  onChange={(e) => setCorrectedAyah(e.target.value)}
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">ترتيب الكلمة</Label>
                <Input
                  type="number"
                  min={1}
                  value={correctedWordIndex}
                  onChange={(e) => setCorrectedWordIndex(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Meaning Override Form */}
        {correctionType === 'meaning_override' && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <Label className="font-arabic">المعنى الصحيح</Label>
            <Textarea
              value={meaningText}
              onChange={(e) => setMeaningText(e.target.value)}
              placeholder="أدخل المعنى الصحيح..."
              className="font-arabic"
              rows={3}
            />
            <Label className="font-arabic">ملاحظات (اختياري)</Label>
            <Input
              value={meaningNotes}
              onChange={(e) => setMeaningNotes(e.target.value)}
              placeholder="سبب التصحيح..."
              className="font-arabic"
            />
          </div>
        )}

        {/* Apply to Duplicates */}
        <div className="space-y-3 p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-duplicates"
              checked={applyToDuplicatesChecked}
              onCheckedChange={(v) => setApplyToDuplicatesChecked(!!v)}
            />
            <Label htmlFor="apply-duplicates" className="font-arabic cursor-pointer flex items-center gap-1">
              <Users className="w-4 h-4" />
              تطبيق على كل التكرارات
            </Label>
          </div>
          
          {applyToDuplicatesChecked && (
            <Select value={duplicateScope} onValueChange={(v) => setDuplicateScope(v as DuplicateScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUPLICATE_SCOPES.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    <span className="font-arabic">{scope.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="gap-1 flex-1">
            <Check className="w-4 h-4" />
            <span className="font-arabic">تطبيق</span>
          </Button>
          <Button variant="outline" onClick={() => onNavigate(mismatch.word.pageNumber)} className="gap-1">
            <ArrowRight className="w-4 h-4" />
            <span className="font-arabic">انتقل</span>
          </Button>
          <Button variant="ghost" onClick={handleIgnore} className="gap-1 text-muted-foreground">
            <Ban className="w-4 h-4" />
            <span className="font-arabic">تجاهل</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
