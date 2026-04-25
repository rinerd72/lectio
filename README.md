# Lectio · Content Publishing Pipeline

A backend-less publishing system for the Lectio devotional iOS app.
Write devotions in Markdown, run one command, push to GitHub.
The app fetches the resulting JSON.

## Folder layout

```
lectio-content/
├── content/                  # Published devotions (Markdown source)
│   ├── 2026-04-24.md
│   ├── 2026-04-25.md
│   └── …
├── drafts/                   # Work in progress (NOT published)
│   └── 2026-05-01.md
├── public/                   # Build output — what the app fetches
│   ├── index.json            # Manifest of published days
│   └── days/
│       ├── 2026-04-24.json
│       └── …
├── scripts/
│   └── build.mjs             # The build script
├── package.json
└── README.md
```

## Daily workflow

1. Write a new devotion in `drafts/YYYY-MM-DD.md`.
2. When ready, move it to `content/YYYY-MM-DD.md`.
3. Run `npm run build`.
4. Commit & push. The app picks it up at the publishedAt time.

## File format (Markdown + frontmatter)

See `content/2026-04-24.md` for a complete example. The frontmatter
fields the build script understands:

| Field | Required | Notes |
|---|---|---|
| `date` | yes | ISO date `YYYY-MM-DD` |
| `dayNum` | yes | Sequential day count |
| `season` | no | e.g. `Eastertide`, `Ordinary Time` |
| `title` | yes | Display title |
| `subtitle` | no | One-line summary |
| `scriptureRef` | yes | e.g. `1 Kings 19:11–13` |
| `translation` | yes | `ESV` |
| `scriptureSource` | no | URL for "Read in context" |
| `audio` | no | Filename only — base URL is set in `build.mjs` |
| `audioDuration` | no | e.g. `8 min · 32 sec` |
| `art` | no | Filename only — base URL is set in `build.mjs` |
| `artCaption` | no | Caption shown over the image |
| `artAlt` | no | Accessibility alt text |
| `tags` | no | Array, e.g. `[comfort, rest]` |
| `publishedAt` | no | ISO timestamp; defaults to 6:00 AM `America/Chicago` on `date` |
| `revision` | no | Bump when you edit a published day |

The body is split into three sections by `## Scripture`, `## Reflection`,
and `## Prayer`. Scripture verses are blockquote lines starting with
the verse number.

## URLs (set once in `scripts/build.mjs`)

```js
const AUDIO_BASE = 'https://your-bucket.r2.dev/audio/';
const ART_BASE   = 'https://your-bucket.r2.dev/art/';
```

The build composes full URLs from filenames in frontmatter.

## What the app fetches

- `https://raw.githubusercontent.com/YOU/lectio-content/main/public/index.json`
- `https://raw.githubusercontent.com/YOU/lectio-content/main/public/days/YYYY-MM-DD.json`

Or, if you'd rather have a real CDN: enable GitHub Pages on this repo
and the same files are served from `https://YOU.github.io/lectio-content/`.

## Bundled fallback

Copy a few `public/days/*.json` files into the iOS app bundle as
trusted fallback content. The app loads these when offline AND
no day has been cached yet (first launch with no network).
