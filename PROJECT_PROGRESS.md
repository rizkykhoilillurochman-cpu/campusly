# Campusly Project Progress

## Project Status
PHASE 10 — AI academic workbench + production hardening

## Current Phase
Phase 10 — stabilize Campusly AI first, then ship scan-to-solve, academic document generation, exports, image generation, and final mobile QA.

## Completed Features
- Responsive application shell with desktop sidebar and mobile bottom navigation
- Mandatory 7-step onboarding with autosaved progress
- Real student profile, academic profile, goals, courses, and AI preferences
- Tasks, notes, class schedule, calendar month/week/day, semester summary
- GPA calculator/simulation with persistence
- Finance tracker and focus timer with real activity analytics
- Thesis project CRUD foundation
- Academic Tools hub
- Campusly AI UI with secure server-side provider boundary
- Document Center with browser text support and server extraction for TXT/MD/CSV/JSON/HTML/PDF/DOC/DOCX/PPT/PPTX/XLS/XLSX/ODT/ODS/ODP
- Notifications and persistent smart reminders while the page is open
- Global search across core entities
- JSON export/import with schema validation
- Email/password authentication with scrypt hashing
- Durable SQLite backend with WAL mode, user isolation, persisted sessions, and legacy JSON migration
- Authenticated cloud sync API
- Google OAuth authorization-code architecture with state validation and one-time exchange code; requires real Google credentials
- Server-side AI gateway; frontend never receives provider secrets
- Security headers, request size limits, rate limiting, expiring sessions
- PWA manifest and installable icon metadata
- Capacitor packaging configuration prepared for Android build
- Keyboard focus states and prefers-reduced-motion support
- Mobile menu rebuilt as a dedicated iOS-safe scrolling surface
- Fatal frontend error screen to avoid silent blank-page failures
- Automated GitHub Actions CI for Node 22 syntax checks and integration smoke tests
- AI gateway rebuilt around GEMINI_MODEL with a controlled fallback instead of hardcoded experimental model names
- AI context now receives real Campusly profile, tasks, schedule, GPA, and courses from the browser
- AI no longer falls back to hardcoded canned replies when no login token exists
- AI retry/error state added to the mobile chat
- Scan-soal endpoint added for image questions using Gemini multimodal input
- Image-generation endpoint added using a Gemini image model
- PDF export endpoint added for AI-generated text
- PPTX export endpoint added for AI-generated text
- New AI workspace actions: scan soal, makalah help, study plan, GPA analysis, PDF, PPT, image generation, clear chat
- Service-worker cache bumped so the new AI frontend is actually picked up on mobile

## Current Task
1. Verify the new AI gateway on production with the real GEMINI_API_KEY/GEMINI_MODEL environment.
2. Verify scan-to-solve with real iPhone camera/photo input.
3. Verify PDF and PPTX files open correctly on iPhone/Android/desktop.
4. Verify image generation availability/quota for the configured Gemini account.
5. Add richer academic document workflows: makalah template, citation/reference helper, and document-to-AI upload.
6. Harden cloud persistence on the free deployment target.
7. Finish full mobile QA without regressing Tasks or Calendar.

## Known Blockers / Limitations
- Production AI behavior still depends on the configured Gemini credentials/quota in the deployment environment.
- Google OAuth requires a Google Cloud OAuth Web Client and production redirect URI.
- Background push reminders require HTTPS + push service and are not claimed complete.
- Academic Tools contains several hub-level modules rather than full specialist implementations.
- Android APK/AAB is not claimed until Android SDK/Capacitor tooling produces a verified release build.
- The generated PDF writer intentionally uses a simple Helvetica text layout; richer academic typography and embedded images are a later enhancement.
- PPTX generation is intentionally lightweight; polished themes, charts, and embedded images are a later enhancement.
- Full browser interaction QA is still required on real iPhone Safari and Android Chrome.

## Test Status
- app.js syntax: PASS
- server.js syntax: PASS
- startup.js syntax: PASS
- blitz-entry.js syntax: PASS
- server-ai.js syntax: PASS
- ai-core.js syntax: PASS
- SQLite initialization: PASS
- registration/login/session: PASS
- authenticated sync GET/PUT: PASS
- unauthorized sync rejection: PASS
- PDF extraction: PASS
- DOCX extraction: PASS
- XLSX extraction: PASS
- TXT extraction: PASS
- manifest/shell smoke checks: PASS
- security headers: implemented and locally served
- GitHub Actions CI: configured; latest run must be observed after push
- Chromium headless browser run: previously attempted; environment process timed out before DOM output, so full browser interaction QA remains unverified
- OAuth token is no longer placed in the redirect URL; callback issues a short-lived one-time exchange code

## AI Architecture
Browser -> `/api/ai*` -> server-side Gemini gateway -> Gemini API.

The browser never receives the Gemini API key. AI context is sent as ordinary application data, while system instructions stay server-side. Chat has a controlled provider fallback only for transient/provider/model errors; there is no canned answer fallback.

## Deployment Status
Deployment is external. After each AI change, verify the live `campusly.blitz.cloud` build and hard-refresh/update the PWA cache before judging the result.
