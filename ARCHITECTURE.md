# Campusly Architecture

## Frontend
- Responsive vanilla JS application shell
- Centralized local state in `localStorage`
- PWA manifest + service worker
- Mobile bottom navigation and desktop sidebar
- Feature views for academic, productivity, finance, thesis, documents, AI, and settings

## Backend
- Node.js 22 HTTP server
- SQLite (`node:sqlite`) in WAL mode
- Tables: users, user_data, sessions
- Per-user ownership enforced at API layer
- Expiring hashed bearer sessions
- Rate limiting on authentication endpoints
- Request body/file limits
- Security response headers

## Authentication
- Email/password using Node `scrypt`
- Google OAuth authorization-code flow with state validation
- Provider credentials are server-side environment variables

## AI
Frontend → `/api/ai` → secure provider gateway → provider

Provider API keys are never shipped to the browser.

## Document pipeline
Browser upload → authenticated `/api/documents/extract` → type-aware extraction:
- text formats: direct UTF-8
- PDF: `pdftotext`
- Office/OpenDocument: LibreOffice conversion

Large documents are capped at the API boundary. A future production deployment should move heavy extraction to an isolated worker.

## Sync
Local state remains responsive-first. Authenticated users can PUT/GET the complete state to/from the durable SQLite backend. Production can replace SQLite with managed PostgreSQL without changing the frontend contract.

## Android
`capacitor.config.json` defines the packaging identity and web directory. A release APK/AAB requires the Android SDK and Capacitor CLI/runtime in a build environment.

## Security baseline
- No frontend provider secrets
- Password hashing with scrypt
- Session expiry
- OAuth state validation
- User-scoped data
- Request limits
- Security headers
- `frame-ancestors 'none'`
- Reduced-motion accessibility support

## Production blockers
Credentials, HTTPS domain, managed database hosting, push service, Google OAuth configuration, and Android SDK/release signing are external environment dependencies.
