import { useState, useEffect } from 'react';
import { SvgPageData } from '@/types/svgWordBoxes';

const cache = new Map<number, SvgPageData>();

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * Load SVG word boxes for a specific page.
 * Loads from /data/qpc_word_boxes/page-XXX.json (lazy, cached).
 */
export function useSvgWordBoxes(pageNumber: number, enabled: boolean = true) {
  const [data, setData] = useState<SvgPageData | null>(cache.get(pageNumber) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    if (cache.has(pageNumber)) {
      setData(cache.get(pageNumber)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/data/qpc_word_boxes/page-${pad3(pageNumber)}.json`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: SvgPageData) => {
        if (cancelled) return;
        cache.set(pageNumber, json);
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setData(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, enabled]);

  return { data, loading, error };
}
