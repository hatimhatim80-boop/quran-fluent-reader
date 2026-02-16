/**
 * Fetch word-by-word data from Quran.com API and generate word box JSON files.
 * 
 * Usage:
 *   npx tsx scripts/fetch_qurancom_word_boxes.ts
 * 
 * Output:
 *   public/data/qpc_word_boxes/page-001.json ... page-604.json
 * 
 * This replaces the SVG extraction pipeline entirely by using
 * Quran.com's line_number + position data to compute word boxes.
 */

import fs from "fs-extra";
import path from "path";

const PAGES = 604;
const API_BASE = "https://api.quran.com/api/v4";
const OUT_DIR = path.resolve("public/data/qpc_word_boxes");
const DELAY_MS = 300; // Be nice to the API

/** Standard Madinah mushaf: 15 lines per page */
const LINES_PER_PAGE = 15;

/** Text area boundaries (normalized 0..1) matching HybridMushafPageView calibration */
const STANDARD_AREA = { top: 0.112, bottom: 0.930, left: 0.075, right: 0.925 };
const PAGE1_AREA = { top: 0.18, bottom: 0.53, left: 0.15, right: 0.85 };
const PAGE2_AREA = { top: 0.16, bottom: 0.55, left: 0.12, right: 0.88 };

function getArea(page: number) {
  if (page === 1) return PAGE1_AREA;
  if (page === 2) return PAGE2_AREA;
  return STANDARD_AREA;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip diacritics to estimate visual character width */
function baseCharCount(text: string): number {
  const base = text.replace(
    /[\u064B-\u0652\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g,
    ""
  );
  return Math.max(base.length, 1);
}

interface ApiWord {
  location: string; // "1:1:1"
  text_uthmani: string;
  line_number: number;
  position: number;
  char_type_name: string;
}

async function fetchPage(pageNumber: number): Promise<ApiWord[]> {
  const url = `${API_BASE}/verses/by_page/${pageNumber}?words=true&word_fields=line_number,text_uthmani,position,location&per_page=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for page ${pageNumber}`);
  const json = await res.json();

  const words: ApiWord[] = [];
  for (const verse of json.verses || []) {
    for (const w of verse.words || []) {
      words.push({
        location: w.location,
        text_uthmani: w.text_uthmani,
        line_number: w.line_number,
        position: w.position,
        char_type_name: w.char_type_name,
      });
    }
  }
  return words;
}

function computeBoxes(pageNumber: number, words: ApiWord[]) {
  const area = getArea(pageNumber);
  const areaW = area.right - area.left;
  const areaH = area.bottom - area.top;

  // Group by line
  const lineMap = new Map<number, ApiWord[]>();
  for (const w of words) {
    if (!lineMap.has(w.line_number)) lineMap.set(w.line_number, []);
    lineMap.get(w.line_number)!.push(w);
  }

  const lineNumbers = [...lineMap.keys()].sort((a, b) => a - b);
  const minLine = Math.min(...lineNumbers);
  const maxLine = Math.max(...lineNumbers);
  const lineSpan = maxLine - minLine + 1;
  const lineH = areaH / Math.max(lineSpan, 1);

  const result: Array<{ key: string; text: string; box: { x: number; y: number; w: number; h: number } }> = [];

  for (const ln of lineNumbers) {
    const lineWords = lineMap.get(ln)!;
    lineWords.sort((a, b) => a.position - b.position);

    const slotIndex = ln - minLine;
    const y = area.top + slotIndex * lineH;

    // Distribute words RTL using character weights
    const weights = lineWords.map((w) => baseCharCount(w.text_uthmani));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let cursorRight = area.right;

    for (let i = 0; i < lineWords.length; i++) {
      const w = lineWords[i];
      const proportion = weights[i] / totalWeight;
      const wordW = areaW * proportion;
      const x = cursorRight - wordW;
      cursorRight = x;

      result.push({
        key: w.location,
        text: w.text_uthmani,
        box: {
          x: round4(x),
          y: round4(y),
          w: round4(wordW),
          h: round4(lineH),
        },
      });
    }
  }

  return result;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function main() {
  await fs.ensureDir(OUT_DIR);

  let success = 0;
  let fail = 0;

  for (let pno = 1; pno <= PAGES; pno++) {
    try {
      const words = await fetchPage(pno);
      const boxes = computeBoxes(pno, words);

      const out = {
        page: pno,
        viewBox: { w: 1000, h: 1414 },
        words: boxes,
        debug: {
          wordsCount: words.length,
          boxesCount: boxes.length,
          source: "quran.com-api",
        },
      };

      await fs.writeJson(
        path.join(OUT_DIR, `page-${pad3(pno)}.json`),
        out,
        { spaces: 2 }
      );
      success++;

      if (pno % 50 === 0) {
        console.log(`✅ Progress: ${pno}/${PAGES}`);
      }

      await sleep(DELAY_MS);
    } catch (e: any) {
      console.error(`❌ Page ${pno}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
