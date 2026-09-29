# Campusly

Campusly is a responsive student workspace for tasks, schedules, notes, finances, tools, and AI.

## Canonical structure

The project intentionally keeps one frontend runtime and one production server:

- `index.html` — single browser entrypoint
- `campusly-v5.js` — canonical frontend application
- `campusly-v5.css` — canonical stylesheet
- `campusly-production-server.js` — public server, AI gateway, and exports
- `server.js` — internal static/core server

Do not add overlay scripts, `*-fix.js`, duplicate runtimes, or versioned service workers. Fix the canonical file instead.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:8787`.

## Environment

Set `GEMINI_API_KEY` on the server for AI features. Optional variables include `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, and `GEMINI_IMAGE_MODEL`.

Never put provider secrets in frontend code.

## Storage

The current frontend is local-first and stores the workspace state in browser `localStorage`. No committed SQLite database or server-side JSON data store is part of the canonical baseline.

## Quality checks

```bash
npm run check
npm test
```

The integration smoke test verifies the canonical entrypoint, health endpoint, AI gateway behavior without a key, and that removed legacy runtime paths are not exposed.
