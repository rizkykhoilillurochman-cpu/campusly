# Campusly

Campusly is a responsive student workspace for tasks, schedules, notes, finances, tools, and AI.

## Canonical structure

Campusly intentionally has one frontend runtime and one production server:

- `index.html` — browser entrypoint
- `campusly-v5.js` — canonical frontend application
- `campusly-v5.css` — canonical stylesheet
- `campusly-production-server.js` — static server, Gemini AI gateway, and exports

There are no overlay scripts, `*-fix.js` files, duplicate runtimes, service-worker patches, or alternate AI model routers.

## AI

Campusly uses one stable production model: `gemini-3.8-flash`.

Only `GEMINI_API_KEY` is required. The application deliberately ignores legacy model environment variables so an old deployment setting cannot switch the app back to a restricted Gemini 2.x model.

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

Never put provider secrets in frontend code.

## Storage

The frontend is local-first and stores workspace state in browser `localStorage`. No committed database or server-side workspace store is required.

## Quality checks

```bash
npm run check
npm test
```

The integration smoke test verifies the canonical entrypoint, health/readiness endpoints, AI key guard, export pipeline, and that removed legacy runtime paths are not exposed.
