# Campusly

Campusly is a responsive student workspace for tasks, schedules, notes, finances, tools, and AI.

## AI v2

The AI layer is now built around one canonical server pipeline:

- Dynamic Gemini model discovery through `models.list`; only models advertising `generateContent` are eligible.
- `GEMINI_MODEL` is an optional preference, not a hard-coded requirement.
- Chat uses Gemini multi-turn `contents` with `user` / `model` roles, up to 12 recent clean turns, separate system instruction, optional Campusly context, safe markdown rendering, retry, timeout, and friendly errors.
- Long paper/PPT generation is asynchronous through `/api/jobs` and `/api/jobs/:id`.
- Paper generation uses an outline → chapter generation → grounded references → polish pipeline and one shared document model for DOCX/PDF.
- PPT generation uses structured JSON instead of `SLIDE N:` parsing, multiple layouts, theme tokens, speaker notes, native editable text/shapes, and optional Pexels images.
- Vision shares the same Gemini call/retry/timeout path and validates image type/size.
- Export endpoints are rate limited and size limited.
- Canva integration uses OAuth 2.0 Authorization Code + PKCE and Canva Design Import when credentials are configured; otherwise PPTX download remains the fallback.

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

The integration test covers health/readiness, dynamic model diagnostics without a key, chat/vision key guards, document exports, Unicode PDF output, rate limiting, job creation, and legacy route aliases.
