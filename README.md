# 🚛 ilvolAI

AI-powered load extraction tool for freight dispatchers. Chrome extension that captures load details from broker calls/emails/chats and formats them into a clean handoff for drivers.

## Status

🚧 **Pre-MVP** — early scaffold. Floating button + panel shell only.

## Stack

- Vanilla JavaScript (no framework yet — keeps it light)
- Chrome Manifest V3
- TBD: AI provider for extraction (OpenAI / Anthropic / local)
- TBD: Speech-to-text for mic feature

## Local development

1. `git clone` this repo
2. Open Chrome → `chrome://extensions`
3. Toggle **Developer mode** (top right)
4. Click **Load unpacked** → select this folder
5. Open any webpage — look for the 🚛 button bottom-right

## Keyboard shortcut

`⌘⇧L` (Command + Shift + L) — toggle the panel

## Roadmap

- [ ] Floating button + panel shell *(done)*
- [ ] Load fields form (PU, DEL, commodity, etc.)
- [ ] Paste-from-clipboard → AI extraction
- [ ] Mic recording → AI extraction
- [ ] Confidence % per field
- [ ] Copy driver-ready message
- [ ] User accounts + subscription
