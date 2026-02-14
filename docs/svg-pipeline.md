# SVG Word Boxes Extraction Pipeline

## Overview

This pipeline extracts word bounding boxes from Quran SVG pages (مصحف المدينة) and outputs JSON files for interactive overlay rendering.

## Setup Steps (Run Locally)

### 1. Install Dependencies

```bash
npm install playwright fs-extra ts-node
npx playwright install chromium
```

### 2. Download QPC SVG Files

Download SVG pages from [Quran.com QPC repository](https://github.com/nicholasgasior/quran-svg) or similar source.

Place them in:
```
public/qpc-svg/
  page-001.svg
  page-002.svg
  ...
  page-604.svg
```

### 3. Generate Word Layout

This creates `pageWords.json` from existing `mushaf.txt` + `quran-tanzil.txt`:

```bash
npx ts-node scripts/generate_page_words.ts
```

Output: `src/data/mushaf-layout/pageWords.json`

### 4. Extract Bounding Boxes

```bash
npx ts-node scripts/extract_qpc_word_boxes.ts
```

Output: `src/data/qpc_word_boxes/page-001.json` ... `page-604.json`

### 5. Copy to Public (for Runtime Loading)

```bash
cp -r src/data/qpc_word_boxes public/data/qpc_word_boxes
```

## JSON Output Format

Each page JSON:
```json
{
  "page": 1,
  "viewBox": { "w": 1000, "h": 1414 },
  "words": [
    {
      "key": "1:1:1",
      "text": "بِسْمِ",
      "box": { "x": 0.71, "y": 0.08, "w": 0.06, "h": 0.03 }
    }
  ],
  "debug": {
    "wordsCount": 28,
    "boxesCount": 28
  }
}
```

## Runtime Usage

In the app, select "صورة + إحداثيات" (SVG Overlay) display mode in Settings → Display.

The app will:
1. Load SVG as background image
2. Load word boxes JSON for current page
3. Render transparent click targets over each word
4. Enable word highlighting, click-to-meaning, and autoplay

## Debug Mode

Enable debug mode in Settings to see:
- Word bounding boxes outlined on the page
- Hover info (key, coordinates, index)
- Mismatch warnings (words vs boxes count)
