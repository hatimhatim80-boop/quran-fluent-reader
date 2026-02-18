import React, { useEffect, useState } from 'react';
import { subscribeAutoPlayDebug, AutoPlayDebugState } from '@/hooks/useAutoPlay';

/**
 * مؤشر Debug مرئي يظهر في الزاوية العلوية اليسرى
 * يتحدث تلقائياً عند كل خطوة advance()
 * يُعرض فقط عند تفعيل debugMode أو في بيئة التطوير
 */
export function AutoPlayDebugPanel({ visible }: { visible: boolean }) {
  const [state, setState] = useState<AutoPlayDebugState | null>(null);

  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeAutoPlayDebug((s) => setState({ ...s }));
    return unsub;
  }, [visible]);

  if (!visible || !state) return null;

  const row = (label: string, value: string | number | boolean) => (
    <div className="flex justify-between gap-3">
      <span className="opacity-60">{label}</span>
      <span className={
        typeof value === 'boolean'
          ? value ? 'text-green-400 font-bold' : 'text-red-400 font-bold'
          : 'text-yellow-300 font-bold'
      }>
        {typeof value === 'boolean' ? (value ? '✅ true' : '❌ false') : String(value)}
      </span>
    </div>
  );

  return (
    <div
      className="fixed top-16 left-2 z-[9999] bg-black/90 text-white text-[11px] font-mono px-3 py-2 rounded-xl shadow-2xl min-w-[220px] space-y-1 border border-white/10"
      dir="ltr"
    >
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1 border-b border-white/10 pb-1">
        AutoPlay Debug
      </div>
      {row('portal', state.portal)}
      {row('currentPage', state.currentPage)}
      {row('itemsOnPage', state.itemsCount)}
      {row('index', state.index)}
      {row('endDetected', state.endDetected)}
      {row('goNextCalled', state.goNextCalled)}
      {row('autoPlayBefore', state.autoPlayBefore)}
      {row('autoPlayAfter', state.autoPlayAfter)}
    </div>
  );
}
