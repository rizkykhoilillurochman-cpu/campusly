# Campusly

Campusly is a responsive student workspace for tasks, schedules, notes, finances, tools, and AI.

## Storage foundation (Phase 1A)

The frontend loads through a native ES module entrypoint (`campusly-bootstrap.js`)
and uses `campusly-store.js` as its shared, schema-v7 state owner. Existing
`campusly_state_v5` and `campusly_state_v6` data migrates to IndexedDB. Makalah and
presentations use a separate IndexedDB object store and are managed in Dokumenku.
JSON backups include those documents. Import validates the file and saves a local
recovery snapshot before applying it. Small storage markers coordinate state updates
between tabs. If IndexedDB
is unavailable, Campusly falls back to localStorage for the session and future loads.
The app requests persistent browser storage when that API is available. Legacy
entities receive `updatedAt` and `deletedAt` metadata during migration.

The frontend entrypoint and shared state are modular. The backend separates configuration, response security, static assets, rate limiting, route dispatch, AI prompts/providers, document and slide builders, Canva OAuth, and durable job coordination/storage. The built-in calculator parses a limited math grammar; it does not evaluate JavaScript.

The backend modules live under `server/`. The older AI page and its `MutationObserver`/`window.go` patch were
removed; the AI module now mounts through the normal route renderer, and its context
toggle lives in Settings. No third-party package was added. Deadline notifications
are not active; Campusly does not show a notification toggle until reminder delivery
is implemented.

Long-running generation jobs are written atomically to `DATA_DIR/jobs.json`, queued
with a two-job concurrency cap, and marked interrupted after restart. The API can
resume an interrupted job while its saved input is retained. The Dockerfile points
`DATA_DIR` at `/app/data`; verify with the hosting provider whether that volume survives
restarts before relying on job recovery. Job input and result data remain on the
server for up to 30 minutes. Canva OAuth sessions are written to
`DATA_DIR/sessions.json` so a server restart does not immediately disconnect Canva.
Both files can contain sensitive user material or tokens and use owner-only file
permissions; configure access to `DATA_DIR` accordingly. This local file storage is
not replicated or encrypted, and its survival depends on the host's disk policy.

Run `node tests/store.js` to check migration, state ownership, and cross-tab updates.

## AI v2

Set `AI_MOCK=1` to run deterministic local AI responses for integration tests without a Gemini key or external requests. Keep it off in production. The AI layer is built around one canonical server pipeline:

- Dynamic Gemini model discovery through `models.list`; only models advertising `generateContent` are eligible.
- `GEMINI_MODEL` is an optional preference, not a hard-coded requirement.
- Chat uses Gemini multi-turn `contents` with `user` / `model` roles, up to 12 recent clean turns, separate system instruction, optional minimized Campusly context, retry, timeout, and friendly errors. The context sent to AI is limited to preferred name, major, semester, and a small set of nearby tasks/classes; it excludes full name and student ID.
- Long paper/PPT generation is asynchronous through `/api/jobs` and `/api/jobs/:id`.
- Paper generation uses an outline, one writing pass per chapter, and grounded references. It skips repeated chapter rewrites and a second whole-document AI pass to reduce wait time; review the draft and citations before submitting it.
- PPT generation uses structured JSON instead of `SLIDE N:` parsing, multiple layouts, theme tokens, speaker notes, and native editable text/shapes. PPTX export uses local shapes and does not wait for external image searches.
- Vision shares the same Gemini call/retry/timeout path and validates image type/size.
- The phone layout uses compact home cards, a two-column AI tool grid, a keyboard-friendly full-height generator sheet, and explicit scan/export status messages.
- Export endpoints are rate limited and size limited.
- Canva integration uses OAuth 2.0 Authorization Code + PKCE and Canva Design Import when credentials are configured; otherwise PPTX download and manual import remain the fallback. Canva requires integration review before a public integration is available broadly; see [Canva's submission guidance](https://www.canva.dev/docs/connect/submitting-integrations/). Imported output should still be reviewed for layout fidelity.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:8787`.

## Environment

Required:

```text
GEMINI_API_KEY=your_key_here
```

Optional:

```text
GEMINI_MODEL=
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
GEMINI_IMAGE_MODEL=
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_REDIRECT_URI=https://your-domain.example/api/canva/callback
TRUST_PROXY=false
```

The server never sends the Gemini or Canva secret to the browser.

## Diagnostics

- `GET /api/ai/models` — eligible models, selected model, and key status.
- `GET /api/ai/check` — real generateContent smoke check using the dynamically selected model.
- `GET /api/health` and `GET /api/ready` — service health/readiness.

## Local data and recovery

Campusly has no user account or cloud sync. Browser data remains on that device and
can be lost if site data is cleared. Use **Pengaturan → Export data** regularly and
keep the JSON file somewhere safe. Import accepts files up to 15 MB, checks the
schema, and creates a local recovery snapshot first. This snapshot is on the same
device and is not a substitute for an external backup. Imported data replaces the
current app data. Do not put secrets in notes or AI prompts.

## Exports

- `POST /api/export/docx` — editable Word document from the shared document model.
- `POST /api/export/pdf` — Unicode-capable PDF using PDFKit and bundled/system serif fonts.
- `POST /api/export/pptx` — editable PowerPoint with native text/shapes and speaker notes.

The Docker image installs DejaVu serif fonts so Indonesian/Unicode text is not silently replaced by ASCII spaces.

## Canva setup

Create an app in the Canva Developer Portal and configure an Outside Canva redirect URL matching `CANVA_REDIRECT_URI`. Enable the `design:content:write` and `design:meta:read` scopes. Campusly uses Canva's Authorization Code + PKCE flow on the server, keeps tokens in an HTTP-only session, refreshes them when needed, then uploads generated PPTX files through the Design Import API.

If Canva credentials are absent, the UI shows a friendly fallback and the PPTX can still be downloaded and imported manually.

## Quality checks

```bash
npm run check
npm test
```

The integration test runs with `AI_MOCK=1` and covers health/readiness, model diagnostics, chat/vision validation, document exports, Unicode PDF output, rate limiting, job creation, and legacy route aliases.
