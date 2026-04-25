# Lectio · daily workflow

## One-time setup

```bash
# 1. Create the GitHub repo (do this on github.com first), then:
git clone https://github.com/YOU/lectio-content.git
cd lectio-content

# 2. Drop in everything from this download
# 3. Install deps
npm install

# 4. Configure URLs in scripts/build.mjs (AUDIO_BASE, ART_BASE)

# 5. Configure R2 credentials in .env (see scripts/upload.mjs header)
echo "R2_ACCOUNT_ID=..." > .env
echo "R2_ACCESS_KEY_ID=..." >> .env
echo "R2_SECRET_ACCESS_KEY=..." >> .env
echo "R2_BUCKET=lectio" >> .env

# 6. First push
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

## Daily flow

```bash
# 1. Write tomorrow's devotion
$EDITOR drafts/2026-04-26.md

# 2. When ready, move to content/
mv drafts/2026-04-26.md content/

# 3. Drop the audio + art into assets/
cp ~/Downloads/2026-04-26.mp3 assets/audio/
cp ~/Downloads/2026-04-26.jpg assets/art/

# 4. Validate
npm run lint

# 5. Build the JSON
npm run build

# 6. Upload audio + art to Cloudflare R2
npm run upload

# 7. Commit & push (this triggers the GitHub Action to rebuild + commit JSON)
git add .
git commit -m "Add devotion: 2026-04-26"
git push
```

## Common commands

| What | Command |
|---|---|
| Lint frontmatter | `npm run lint` |
| Rebuild all JSON | `npm run build` |
| Watch mode while writing | `npm run build:watch` |
| Upload only new audio/art | `npm run upload` |
| Re-upload everything | `npm run upload -- --force` |
| Push changes to GitHub | `git add . && git commit -m "msg" && git push` |
| Pull latest from GitHub | `git pull` |
| Fix a typo & republish | edit `.md`, bump `revision: 2` in frontmatter, `git push` |

## Cloudflare R2 bucket setup

1. Cloudflare dashboard → R2 → Create bucket → name it `lectio`
2. Settings → Public access → Allow Access (gives you `https://pub-<id>.r2.dev/`)
3. Or attach a custom domain like `cdn.yourapp.com` for nicer URLs
4. R2 → Manage R2 API Tokens → Create API token (Object Read & Write)
5. Copy account ID, access key, secret into `.env`
6. Update `AUDIO_BASE` and `ART_BASE` in `scripts/build.mjs` to your bucket URL
