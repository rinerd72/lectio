// build.mjs — turns Markdown devotions into the JSON the Lectio app fetches.
//
//   node scripts/build.mjs           # one-shot
//   node scripts/build.mjs --watch   # rebuild on save
//
// Reads:  content/*.md
// Writes: public/days/*.json + public/index.json

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import matter from 'gray-matter';

// ─── Configure these ──────────────────────────────────────────────
const AUDIO_BASE = 'https://pub-e458b684eff145fcaf376abfe21f66f4.r2.dev/audio/';
const ART_BASE   = 'https://pub-e458b684eff145fcaf376abfe21f66f4.r2.dev/art/';
const PUBLISH_TZ = 'America/Chicago';
const DEFAULT_PUBLISH_TIME = '6:00 AM';
// ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'public');
const OUT_DAYS = path.join(OUT, 'days');

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function parsePublishTime(value) {
  const raw = String(value || DEFAULT_PUBLISH_TIME).trim().toUpperCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) {
    throw new Error(`invalid publishTime "${value}" (try "6:00 AM")`);
  }

  let hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2]);
  const period = match[3];
  if (minute < 0 || minute > 59) {
    throw new Error(`invalid publishTime "${value}" (minutes must be 00-59)`);
  }
  if (period) {
    if (hour < 1 || hour > 12) throw new Error(`invalid publishTime "${value}"`);
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
  } else if (hour < 0 || hour > 23) {
    throw new Error(`invalid publishTime "${value}"`);
  }

  return { hour, minute };
}

function formatPublishedAt(dateStr, publishTime) {
  const { hour, minute } = parsePublishTime(publishTime);
  // Chicago is UTC-5 (CDT) or UTC-6 (CST). For a publishing pipeline
  // a fixed -05:00 offset is fine since we only care about ordering.
  return `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`;
}

// Pulls "## Heading" sections out of markdown body.
function splitSections(body) {
  const sections = {};
  const re = /^##\s+(.+)$/gm;
  const matches = [...body.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim().toLowerCase();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    sections[name] = body.slice(start, end).trim();
  }
  return sections;
}

// Scripture: each non-empty line becomes a verse. Lines starting with
// "> N text" or "N. text" or "N text" are parsed for verse number.
function parseScripture(raw) {
  const out = [];
  for (const line of raw.split('\n').map(l => l.replace(/^>\s*/, '').trim()).filter(Boolean)) {
    const m = line.match(/^(\d+)[\.\s]\s*(.+)$/);
    if (m) out.push({ n: parseInt(m[1], 10), text: m[2].trim() });
    else if (out.length) out[out.length - 1].text += ' ' + line; // continuation
    else out.push({ n: null, text: line });
  }
  return out;
}

// Reflection: paragraphs separated by blank lines.
function parseParagraphs(raw) {
  return raw.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Prayer: a single block of prose; collapse newlines.
function parsePrayer(raw) {
  return raw.replace(/\s+/g, ' ').trim();
}

function buildOne(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const { data: fm, content } = matter(src);
  if (!fm.date) throw new Error(`${filePath}: missing 'date' frontmatter`);
  const date = normalizeDate(fm.date);

  const sections = splitSections(content);
  const out = {
    id: date,
    revision: fm.revision || 1,
    publishedAt: fm.publishedAt || formatPublishedAt(date, fm.publishTime),
    dayNum: fm.dayNum,
    season: fm.season || null,
    title: fm.title,
    subtitle: fm.subtitle || null,

    scripture: {
      ref: fm.scriptureRef,
      translation: fm.translation || 'NET',
      verses: sections.scripture ? parseScripture(sections.scripture) : [],
      sourceUrl: fm.scriptureSource || null,
      source: fm.scriptureSource ? 'remote' : 'bundled',
    },

    audio: fm.audio
      ? { url: AUDIO_BASE + fm.audio, duration: fm.audioDuration || null }
      : null,

    art: fm.art
      ? {
          url: ART_BASE + fm.art,
          caption: fm.artCaption || null,
          alt: fm.artAlt || fm.artCaption || fm.title,
        }
      : null,

    body: sections.reflection ? parseParagraphs(sections.reflection) : [],
    prayer: sections.prayer ? parsePrayer(sections.prayer) : '',

    tags: fm.tags || [],
  };

  return out;
}

function buildAll() {
  if (!fs.existsSync(CONTENT)) {
    console.error(`No content/ directory at ${CONTENT}`);
    process.exit(1);
  }
  ensureDir(OUT_DAYS);

  const files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md')).sort();
  const days = [];
  for (const f of files) {
    try {
      const day = buildOne(path.join(CONTENT, f));
      fs.writeFileSync(path.join(OUT_DAYS, day.id + '.json'), JSON.stringify(day, null, 2));
      days.push({
        id: day.id,
        publishedAt: day.publishedAt,
        title: day.title,
        scriptureRef: day.scripture.ref,
        revision: day.revision,
      });
      console.log(`  ✓ ${day.id} · ${day.title}`);
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }

  // index.json — manifest the app fetches first.
  const index = {
    generatedAt: new Date().toISOString(),
    publishTz: PUBLISH_TZ,
    defaultPublishTime: DEFAULT_PUBLISH_TIME,
    latest: days.length ? days[days.length - 1].id : null,
    days: days.reverse(), // newest first
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nWrote ${days.length} day(s) → public/`);
}

// Optional watch mode.
if (process.argv.includes('--watch')) {
  buildAll();
  fs.watch(CONTENT, { recursive: true }, () => {
    console.log('\n[change detected] rebuilding…');
    try { buildAll(); } catch (e) { console.error(e); }
  });
  console.log('\nWatching content/ for changes. Ctrl-C to stop.\n');
} else {
  buildAll();
}
