// lint.mjs — validates Markdown frontmatter before publish.
//   node scripts/lint.mjs

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

const REQUIRED = ['date', 'dayNum', 'title', 'scriptureRef', 'translation'];
const TYPES = {
  date: v => /^\d{4}-\d{2}-\d{2}$/.test(normalizeDate(v)),
  dayNum: v => Number.isInteger(v) && v > 0,
  tags: v => Array.isArray(v),
  revision: v => Number.isInteger(v) && v >= 1,
  publishTime: v => isValidPublishTime(v),
};

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function isValidPublishTime(value) {
  const raw = String(value).trim().toUpperCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2]);
  if (minute < 0 || minute > 59) return false;
  if (match[3]) return hour >= 1 && hour <= 12;
  return hour >= 0 && hour <= 23;
}

let errors = 0, warnings = 0;
const seen = new Set();

for (const f of fs.readdirSync(CONTENT).filter(f => f.endsWith('.md')).sort()) {
  const src = fs.readFileSync(path.join(CONTENT, f), 'utf8');
  const { data: fm, content } = matter(src);
  const fail = (m) => { errors++; console.error(`  ✗ ${f}: ${m}`); };
  const warn = (m) => { warnings++; console.warn(`  ⚠ ${f}: ${m}`); };

  for (const k of REQUIRED) if (fm[k] == null) fail(`missing required field "${k}"`);
  for (const [k, fn] of Object.entries(TYPES)) if (fm[k] != null && !fn(fm[k])) fail(`invalid "${k}": ${JSON.stringify(fm[k])}`);

  if (fm.date) {
    const date = normalizeDate(fm.date);
    if (seen.has(date)) fail(`duplicate date ${date}`);
    seen.add(date);
    if (!f.startsWith(date)) warn(`filename doesn't match date (expected ${date}.md)`);
  }

  // body sections
  const body = content.toLowerCase();
  if (!body.includes('## scripture')) warn('no "## Scripture" section');
  if (!body.includes('## reflection')) warn('no "## Reflection" section');
  if (!body.includes('## prayer')) warn('no "## Prayer" section');

  // word count sanity check
  const words = content.split(/\s+/).filter(Boolean).length;
  if (words < 100) warn(`only ${words} words — looks short`);
  if (words > 1500) warn(`${words} words — looks long`);

  if (!errors) console.log(`  ✓ ${f}`);
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
