import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, PenLine, Link2, X } from 'lucide-react';
import { GhareebWord } from '@/types/quran';

interface MeaningAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordText: string;
  positionKey: string;
  identityKey: string;
  pageNumber: number;
  lineIndex?: number;
  tokenIndex?: number;
  surahNumber?: number;
  verseNumber?: number;
  wordIndex?: number;
  ghareebWords: GhareebWord[]; // Available meanings to choose from
  onAssignMeaning: (params: {
    meaningText?: string;
    meaningId?: string;
  }) => void;
  onCancel: () => void;
}

export function MeaningAssignDialog({
  open,
  onOpenChange,
  wordText,
  positionKey,
  identityKey,
  pageNumber,
  ghareebWords,
  onAssignMeaning,
  onCancel,
}: MeaningAssignDialogProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'custom'>('existing');
  const [searchQuery, setSearchQuery] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const [selectedMeaningId, setSelectedMeaningId] = useState<string | null>(null);

  // Filter ghareeb words by search
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) {
      return ghareebWords.slice(0, 50); // Show first 50
    }
    
    const query = searchQuery.toLowerCase();
    return ghareebWords.filter(
      (w) =>
        w.wordText.includes(searchQuery) ||
        w.meaning?.toLowerCase().includes(query) ||
        w.surahName.includes(searchQuery)
    ).slice(0, 50);
  }, [ghareebWords, searchQuery]);

  const handleAssign = () => {
    if (activeTab === 'custom' && customMeaning.trim()) {
      onAssignMeaning({ meaningText: customMeaning.trim() });
    } else if (activeTab === 'existing' && selectedMeaningId) {
      onAssignMeaning({ meaningId: selectedMeaningId });
    }
  };

  const handleCancel = () => {
    setSearchQuery('');
    setCustomMeaning('');
    setSelectedMeaningId(null);
    onCancel();
  };

  const isValid = (activeTab === 'custom' && customMeaning.trim()) ||
                  (activeTab === 'existing' && selectedMeaningId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-arabic text-xl flex items-center gap-2">
            <PenLine className="w-5 h-5" />
            إسناد معنى للكلمة
          </DialogTitle>
          <DialogDescription className="text-right">
            الكلمة:{' '}
            <span className="font-arabic text-lg text-primary font-bold">
              {wordText}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'custom')}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="existing" className="gap-1 text-sm">
              <Link2 className="w-4 h-4" />
              إسناد معنى موجود
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1 text-sm">
              <PenLine className="w-4 h-4" />
              إدخال معنى يدوي
            </TabsTrigger>
          </TabsList>

          {/* Existing Meanings Tab */}
          <TabsContent value="existing" className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في المعاني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 text-right font-arabic"
              />
            </div>

            <ScrollArea className="h-[250px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredWords.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد نتائج
                  </div>
                ) : (
                  filteredWords.map((word) => (
                    <button
                      key={word.uniqueKey}
                      type="button"
                      onClick={() => setSelectedMeaningId(word.uniqueKey)}
                      className={`w-full text-right p-2 rounded-md transition-colors ${
                        selectedMeaningId === word.uniqueKey
                          ? 'bg-primary/20 border-primary border'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {word.surahNumber}:{word.verseNumber}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-arabic text-sm font-bold truncate">
                            {word.wordText}
                          </div>
                          <div className="font-arabic text-xs text-muted-foreground line-clamp-2">
                            {word.meaning || 'لا يوجد معنى'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedMeaningId && (
              <div className="p-2 bg-primary/10 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">المعنى المختار:</div>
                <div className="font-arabic text-sm">
                  {ghareebWords.find((w) => w.uniqueKey === selectedMeaningId)?.meaning || '—'}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Custom Meaning Tab */}
          <TabsContent value="custom" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="customMeaning" className="font-arabic">
                أدخل المعنى يدوياً
              </Label>
              <Textarea
                id="customMeaning"
                placeholder="اكتب معنى الكلمة هنا..."
                value={customMeaning}
                onChange={(e) => setCustomMeaning(e.target.value)}
                className="min-h-[120px] text-right font-arabic"
                dir="rtl"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              سيتم حفظ هذا المعنى كتعديل يدوي ويظهر عند النقر على الكلمة.
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button
            variant="default"
            onClick={handleAssign}
            disabled={!isValid}
            className="gap-1"
          >
            <PenLine className="w-4 h-4" />
            إسناد المعنى
          </Button>
          <Button variant="outline" onClick={handleCancel} className="gap-1">
            <X className="w-4 h-4" />
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
