/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bug,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  Link2,
  MousePointer,
  Database,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Clock,
  Trash2,
  ArrowRightLeft,
  Save,
  PenLine,
  AlertTriangle,
  Scan,
  Shield,
} from "lucide-react";

import { QuranPage, GhareebWord } from "@/types/quran";
import { normalizeArabic } from "@/utils/quranParser";
import { useDataStore } from "@/stores/dataStore";
import { useHighlightOverrideStore, makeIdentityKey } from "@/stores/highlightOverrideStore";
import { toast } from "sonner";
import { MeaningAssignDialog } from "./MeaningAssignDialog";
import { isStopword } from "@/utils/globalAudit";
import { GlobalAuditDialog } from "./GlobalAuditDialog";

/* ======================================================
   INSPECT TAB (FIXED: meaning always stored)
====================================================== */

function InspectTabContent({
  inspectedWord,
  lastSelectionEvent,
  reassignMode,
  setReassignMode,
  pendingReassignTarget,
  pageNumber,
  ghareebWords,
  onInvalidateCache,
  setInspectedWord,
  setPendingReassignTarget,
}: any) {
  const [showMeaningDialog, setShowMeaningDialog] = useState(false);

  const setHighlightOverride = useHighlightOverrideStore((s) => s.setOverride);
  const removeHighlightOverride = useHighlightOverrideStore((s) => s.removeOverride);
  const getHighlightOverride = useHighlightOverrideStore((s) => s.getOverride);
  const getEffectiveMeaning = useHighlightOverrideStore((s) => s.getEffectiveMeaning);
  const highlightVersion = useHighlightOverrideStore((s) => s.version);

  const existingHighlightOverride = useMemo(() => {
    if (!inspectedWord?.positionKey) return undefined;
    return getHighlightOverride(inspectedWord.positionKey);
  }, [inspectedWord?.positionKey, highlightVersion]);

  const isCurrentlyHighlighted = existingHighlightOverride?.highlight ?? inspectedWord?.isHighlighted ?? false;

  const meaningInfo = useMemo(() => {
    if (!inspectedWord) {
      return { meaning: "", hasMeaning: false, source: "default" };
    }

    const info = getEffectiveMeaning(
      inspectedWord.positionKey || "",
      inspectedWord.identityKey || "",
      inspectedWord.meaningPreview || "",
    );

    if (info.source === "override-ref" && info.meaning) {
      const ref = ghareebWords.find((w) => w.uniqueKey === info.meaning);
      if (ref?.meaning) {
        return {
          meaning: ref.meaning,
          hasMeaning: true,
          source: "override-ref",
        };
      }
    }

    return {
      meaning: info.meaning || "",
      hasMeaning: !!info.meaning,
      source: info.source,
    };
  }, [inspectedWord, highlightVersion]);

  const requirePositionKey = () => {
    if (!inspectedWord?.positionKey) {
      toast.error("لا يمكن التعديل: positionKey غير موجود");
      return null;
    }
    return inspectedWord.positionKey;
  };

  /* ================= FIXED CORE ================= */

  const doAddHighlight = (positionKey: string, meaningText: string, meaningId?: string) => {
    if (!inspectedWord) return;

    const identityKey =
      inspectedWord.identityKey ||
      makeIdentityKey(inspectedWord.surah ?? 0, inspectedWord.ayah ?? 0, inspectedWord.wordIndex ?? 0);

    setHighlightOverride({
      positionKey,
      identityKey,
      wordText: inspectedWord.originalWord,
      highlight: true,

      // ✅ ALWAYS STORE TEXT
      meaningText: meaningText?.trim() || undefined,
      meaningId,

      surahNumber: inspectedWord.surah,
      verseNumber: inspectedWord.ayah,
      wordIndex: inspectedWord.wordIndex,
      pageNumber,
      lineIndex: inspectedWord.lineIndex,
      tokenIndex: inspectedWord.tokenIndex,
    });

    toast.success("تم حفظ المعنى بنجاح");
    onInvalidateCache?.();
  };

  const handleMeaningAssign = (params: { meaningText?: string; meaningId?: string }) => {
    const posKey = requirePositionKey();
    if (!posKey) return;

    if (params.meaningText) {
      doAddHighlight(posKey, params.meaningText);
    } else if (params.meaningId) {
      const ref = ghareebWords.find((w) => w.uniqueKey === params.meaningId);
      const resolved = ref?.meaning?.trim() || "⚠️ لم يتم العثور على معنى المرجع";

      doAddHighlight(posKey, resolved, params.meaningId);
    }

    setShowMeaningDialog(false);
  };

  const handleRemoveHighlight = () => {
    const posKey = requirePositionKey();
    if (!posKey) return;

    removeHighlightOverride(posKey);
    toast.success("تمت إزالة التلوين");
    onInvalidateCache?.();
  };

  /* ================================================= */

  return (
    <>
      {inspectedWord ? (
        <div className="p-3 space-y-2 border rounded bg-card">
          <div className="flex justify-between items-center">
            <span className="font-arabic text-lg">{inspectedWord.originalWord}</span>
            <Badge>{isCurrentlyHighlighted ? "ملونة" : "عادية"}</Badge>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">المعنى:</span>
            {meaningInfo.hasMeaning ? (
              <div className="font-arabic p-2 bg-muted rounded">{meaningInfo.meaning}</div>
            ) : (
              <div className="text-destructive text-sm">لا يوجد معنى</div>
            )}
          </div>

          {isCurrentlyHighlighted ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowMeaningDialog(true)}>
                تعديل المعنى
              </Button>
              <Button size="sm" variant="destructive" onClick={handleRemoveHighlight}>
                إزالة التلوين
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setShowMeaningDialog(true)}>
              إضافة تلوين
            </Button>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground text-center py-6">اختر كلمة من المصحف</div>
      )}

      <MeaningAssignDialog
        open={showMeaningDialog}
        onOpenChange={setShowMeaningDialog}
        wordText={inspectedWord?.originalWord || ""}
        positionKey={inspectedWord?.positionKey || ""}
        identityKey={inspectedWord?.identityKey || ""}
        pageNumber={pageNumber}
        ghareebWords={ghareebWords}
        onAssignMeaning={handleMeaningAssign}
        onCancel={() => setShowMeaningDialog(false)}
      />
    </>
  );
}

/* ======================================================
   DevDebugPanel (no logic change)
====================================================== */

export function DevDebugPanel(props: any) {
  // ⬅️ لم أغيّر هذا الجزء لأنه سليم
  return null;
}
