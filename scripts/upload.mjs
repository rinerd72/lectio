// upload.mjs — batch-uploads audio + art to Cloudflare R2.
//
// Usage:
//   node scripts/upload.mjs            # uploads anything new in /assets
//   node scripts/upload.mjs --force    # re-upload everything
//
// Setup once:
//   npm install @aws-sdk/client-s3
//   Create .env at repo root with:
//     R2_ACCOUNT_ID=...
//     R2_ACCESS_KEY_ID=...
//     R2_SECRET_ACCESS_KEY=...
//     R2_BUCKET=lectio
//
// Folder convention:
//   assets/audio/2026-04-24.mp3   →  https://<bucket>.r2.dev/audio/2026-04-24.mp3
//   assets/art/2026-04-24.jpg     →  https://<bucket>.r2.dev/art/2026-04-24.jpg

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Load .env (no dotenv dep needed)
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 credentials in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const MIME = { '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };
const force = process.argv.includes('--force');

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function uploadDir(localDir, prefix) {
  const dir = path.join(ROOT, 'assets', localDir);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    const key = `${prefix}/${file}`;
    if (!force && await exists(key)) { console.log(`  · ${key} (exists)`); continue; }
    const Body = fs.readFileSync(full);
    const ContentType = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body, ContentType, CacheControl: 'public, max-age=31536000, immutable' }));
    console.log(`  ✓ ${key}`);
  }
}

console.log(`Uploading to r2://${R2_BUCKET}/`);
await uploadDir('audio', 'audio');
await uploadDir('art', 'art');
console.log('Done.');
