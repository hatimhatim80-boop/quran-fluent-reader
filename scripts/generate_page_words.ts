/**
 * Generate pageWords.json from mushaf.txt + quran-tanzil.txt
 * 
 * Usage (run locally after git pull):
 *   npx ts-node scripts/generate_page_words.ts
 * 
 * Input:
 *   - public/data/mushaf.txt (page-delimited Quran text)
 *   - public/data/quran-tanzil.txt (surah|ayah|text format)
 * 
 * Output:
 *   - src/data/mushaf-layout/pageWords.json
 */

import fs from "fs-extra";
import path from "path";

interface WordEntry {
  key: string; // surah:ayah:wordIndex
  text: string;
}

interface PageWords {
  page: number;
  words: WordEntry[];
}

// Parse Tanzil format to get ayah texts with surah/ayah numbers
function parseTanzil(text: string): Array<{ surah: number; ayah: number; text: string }> {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split("|");
      if (parts.length < 3) return null;
      return {
        surah: parseInt(parts[0], 10),
        ayah: parseInt(parts[1], 10),
        text: parts.slice(2).join("|"),
      };
    })
    .filter(Boolean) as Array<{ surah: number; ayah: number; text: string }>;
}

// Remove diacritics for comparison
function stripDiacritics(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, "").trim();
}

// Parse mushaf.txt into pages (empty lines = page breaks)
function parseMushafPages(text: string): string[][] {
  const lines = text.split("\n");
  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
      }
      continue;
    }
    currentPage.push(line);
  }
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  return pages;
}

// Load page-mapping to know which surah/ayah starts on each page
async function loadPageMapping(): Promise<Record<string, { surah: number; ayah: number }>> {
  const mapPath = path.resolve("public/data/page-mapping.json");
  if (await fs.pathExists(mapPath)) {
    return await fs.readJson(mapPath);
  }
  return {};
}

async function main() {
  const outDir = path.resolve("src/data/mushaf-layout");
  await fs.ensureDir(outDir);

  // Load source files
  const mushafText = await fs.readFile(
    path.resolve("public/data/mushaf.txt"),
    "utf8"
  );
  const tanzilText = await fs.readFile(
    path.resolve("public/data/quran-tanzil.txt"),
    "utf8"
  );

  const mushafPages = parseMushafPages(mushafText);
  const tanzilAyahs = parseTanzil(tanzilText);

  console.log(`Parsed ${mushafPages.length} mushaf pages`);
  console.log(`Parsed ${tanzilAyahs.length} tanzil ayahs`);

  // Build a word-level index from Tanzil
  // Each word gets: surah:ayah:wordIndex
  const allTanzilWords: Array<{
    surah: number;
    ayah: number;
    wordIndex: number;
    text: string;
    stripped: string;
  }> = [];

  for (const ayah of tanzilAyahs) {
    const words = ayah.text.trim().split(/\s+/);
    words.forEach((w, idx) => {
      allTanzilWords.push({
        surah: ayah.surah,
        ayah: ayah.ayah,
        wordIndex: idx + 1,
        text: w,
        stripped: stripDiacritics(w),
      });
    });
  }

  console.log(`Total Tanzil words: ${allTanzilWords.length}`);

  // Process each mushaf page
  const result: PageWords[] = [];
  let tanzilPointer = 0;

  for (let pageIdx = 0; pageIdx < mushafPages.length; pageIdx++) {
    const pageNum = pageIdx + 1;
    const pageLines = mushafPages[pageIdx];
    const pageWords: WordEntry[] = [];

    for (const line of pageLines) {
      // Skip surah headers
      if (line.startsWith("سُورَةُ") || line.startsWith("سورة ")) {
        continue;
      }

      // Extract words (split by whitespace)
      const words = line.trim().split(/\s+/).filter((w) => w.length > 0);

      for (const word of words) {
        // Skip verse number markers ﴿١﴾
        if (/^[﴿﴾\u0660-\u0669\d]+$/.test(word.replace(/[﴿﴾]/g, ""))) {
          continue;
        }
        // Clean the word (remove verse markers if attached)
        const cleanWord = word.replace(/[﴿﴾۝]/g, "").trim();
        if (!cleanWord) continue;

        // Try to match with Tanzil word at current pointer
        if (tanzilPointer < allTanzilWords.length) {
          const tw = allTanzilWords[tanzilPointer];
          pageWords.push({
            key: `${tw.surah}:${tw.ayah}:${tw.wordIndex}`,
            text: cleanWord,
          });
          tanzilPointer++;
        } else {
          // Fallback: no more Tanzil words
          pageWords.push({
            key: `p${pageNum}-w${pageWords.length}`,
            text: cleanWord,
          });
        }
      }
    }

    result.push({ page: pageNum, words: pageWords });

    if (pageNum % 100 === 0) {
      console.log(`✅ Processed page ${pageNum}`);
    }
  }

  // Write output
  const outPath = path.join(outDir, "pageWords.json");
  await fs.writeJson(outPath, result, { spaces: 2 });
  console.log(`\n✅ Written ${result.length} pages to ${outPath}`);
  console.log(
    `   Tanzil pointer: ${tanzilPointer}/${allTanzilWords.length} words consumed`
  );

  if (tanzilPointer !== allTanzilWords.length) {
    console.warn(
      `⚠️ Word count mismatch: consumed ${tanzilPointer}, total ${allTanzilWords.length}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
