#!/usr/bin/env node
/**
 * OTA ZIP Builder — Cross-platform script
 * Usage: node scripts/ota-zip.mjs
 * 
 * 1. Runs `npm run build`
 * 2. Zips dist/* → public/updates/app.zip (contents at root, not dist/)
 * 3. Updates public/updates/ota-manifest.json with new version (timestamp)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const UPDATES_DIR = join(ROOT, 'public', 'updates');
const ZIP_PATH = join(UPDATES_DIR, 'app.zip');
const MANIFEST_PATH = join(UPDATES_DIR, 'ota-manifest.json');
const BASE_URL = 'https://quran-fluent-reader.lovable.app/updates/app.zip';

// ── 1. Build ──
console.log('🔨 Building project...');
execSync('npm run build', { stdio: 'inherit', cwd: ROOT });

if (!existsSync(DIST)) {
  console.error('❌ dist/ folder not found after build!');
  process.exit(1);
}

// ── 2. Ensure updates dir exists ──
if (!existsSync(UPDATES_DIR)) {
  mkdirSync(UPDATES_DIR, { recursive: true });
}

// ── 3. Delete old zip if exists ──
if (existsSync(ZIP_PATH)) {
  const { unlinkSync } = await import('fs');
  unlinkSync(ZIP_PATH);
  console.log('🗑️  Removed old app.zip');
}

// ── 4. Create ZIP (cross-platform) ──
console.log('📦 Creating app.zip from dist/*...');
const isWindows = platform() === 'win32';

if (isWindows) {
  // PowerShell: Compress-Archive — zip contents of dist (not the folder itself)
  const psCmd = `Compress-Archive -Path "${DIST}\\*" -DestinationPath "${ZIP_PATH}" -Force`;
  execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
} else {
  // macOS/Linux: cd into dist then zip so paths are relative
  execSync(`cd "${DIST}" && zip -r "${ZIP_PATH}" .`, { stdio: 'inherit' });
}

if (!existsSync(ZIP_PATH)) {
  console.error('❌ Failed to create app.zip!');
  process.exit(1);
}

// ── 5. Update ota-manifest.json ──
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // e.g. 20260213153045
const manifest = {
  version,
  url: BASE_URL,
  updatedAt: new Date().toISOString(),
  notes: `OTA ${version}`,
};

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log('');
console.log('✅ OTA package ready!');
console.log(`   📄 ZIP:      public/updates/app.zip`);
console.log(`   📋 Manifest: public/updates/ota-manifest.json`);
console.log(`   🔖 Version:  ${version}`);
console.log('');
console.log('👉 Next: Publish/deploy the project so the files are live.');
