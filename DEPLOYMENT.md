# Campusly Production Deployment

## Minimum requirements
- Node.js 22+ or Docker
- HTTPS reverse proxy
- Persistent volume for `campusly.sqlite`
- Server-side environment variables

## Docker

1. Copy `.env.example` to `.env` and fill real secrets.
2. Run `docker compose up -d --build`.
3. Put HTTPS reverse proxy in front of port 8787.
4. Verify `/api/health` returns `ok: true`.
5. Configure Google OAuth redirect URI to the exact HTTPS callback.

## Important
- Never commit `.env` or the SQLite database.
- Back up the persistent SQLite volume before upgrades.
- For horizontal scaling, move user/session storage to a managed database and shared session strategy.
- Background push requires a real HTTPS deployment and a push subscription service; the current reminder system is in-app/browser-notification based.
