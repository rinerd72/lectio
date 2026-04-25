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
  date: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
  dayNum: v => Number.isInteger(v) && v > 0,
  tags: v => Array.isArray(v),
  revision: v => Number.isInteger(v) && v >= 1,
};

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
    if (seen.has(fm.date)) fail(`duplicate date ${fm.date}`);
    seen.add(fm.date);
    if (!f.startsWith(fm.date)) warn(`filename doesn't match date (expected ${fm.date}.md)`);
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
