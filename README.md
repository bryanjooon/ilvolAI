# 🚛 ilvolAI

AI-powered load extraction for freight dispatchers. Chrome extension that
captures load details from voice (Web Speech API) or pasted text and fills
the form via a Cloudflare Worker backend that calls Gemini through OpenRouter.

## How it works

1. Dispatcher signs in with Google (one-time, stored JWT)
2. Pastes a broker email/chat OR taps the mic and dictates the load
3. Transcript is sent to backend → OpenRouter → Gemini 2.5 Flash
4. Form fields fill in with per-field confidence %
5. Dispatcher reviews, edits if needed, hits **Copy driver message**
6. Clean text ready to send to the driver

## Components

- **`ilvolAI/`** — Chrome extension (Manifest V3)
- **`../ilvolAI-backend/`** — Cloudflare Worker that holds the API key, rate-limits per user, and proxies to OpenRouter

## Status

- ✅ Form panel + driver message formatting
- ✅ Backend extraction via OpenRouter
- ✅ Google sign-in
- ✅ Per-user JWT auth + 60/day quota
- ✅ Web Speech API mic
- ✅ Clipboard paste
- ✅ Per-field confidence %
- 🚧 First-user testing (Bryan controls invites)

## Local development

### 1. Run the backend

```bash
cd ../ilvolAI-backend
npm install
# Set up the OpenRouter key in .dev.vars (see backend README)
npm run dev
# -> http://127.0.0.1:8787
```

### 2. Load the extension

1. `chrome://extensions` → toggle **Developer mode** (top right)
2. Click **Load unpacked** → select this `ilvolAI/` folder
3. 🚛 button appears on every page

### 3. Configure the extension

Before loading, edit two files to point at your local backend:

- **`background.js`** line 13: `BACKEND_URL = "https://ilvolai-backend.REPLACE_ME.workers.dev"`
  → change to `http://127.0.0.1:8787` for local
- **`panel.js`** line 13: same `BACKEND_URL`

For local dev, also:

- **`manifest.json`** `"oauth2".client_id`: replace with your Google OAuth client id
  (Application type: **Chrome Extension**) from [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
- Backend's `wrangler.toml` `DEV_BYPASS_AUTH = "1"` is for testing the prompt
  with curl; real extension use goes through Google sign-in

## Keyboard shortcut

`⌘⇧L` (Command + Shift + L) — toggle the panel

## Roadmap (post-v1)

- [ ] Chrome Web Store unlisted listing for distribution
- [ ] Custom domain for backend (api.ilvolai.app)
- [ ] Load history (last N loads per user)
- [ ] Stripe / paid tier for power dispatchers
- [ ] Mobile app (using the same backend)
