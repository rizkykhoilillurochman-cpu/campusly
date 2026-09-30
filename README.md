# Campusly

Campusly is a responsive student workspace for tasks, schedules, notes, finances, tools, and AI.

## Canonical structure

One frontend and one server only:

- `index.html` — browser entrypoint
- `campusly-v5.js` — canonical frontend application
- `campusly-v5.css` — canonical stylesheet
- `campusly-server.js` — static server, Gemini gateway, and document exports

No overlay AI routers, duplicate production servers, or startup shims are required.

## AI

Campusly uses a free-tier-compatible Gemini model chain. The primary model is `gemini-3.8-flash`, followed by stable Flash fallbacks if a model is unavailable or rate-limited.

Only `GEMINI_API_KEY` is required. Keep the key in the server environment; never put it in frontend code.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:8787`.

## Environment

```text
NODE_ENV=production
PORT=8787
GEMINI_API_KEY=your_key_here
```

## Quality checks

```bash
npm run check
npm test
```

The integration smoke test verifies the canonical server, health/readiness endpoints, missing-key guards, AI route aliases, and DOCX/PDF/PPTX exports.
