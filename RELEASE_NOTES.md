# Campusly v1.0.0-rc1

Release candidate built from the v0.9 checkpoint.

## Release hardening
- SQLite WAL persistence with configurable `DATA_DIR`.
- Email/password authentication and expiring sessions.
- Google OAuth state validation with one-time callback exchange codes.
- AI requests remain server-side; provider secrets are not exposed to the client.
- Document extraction endpoints with request-size limits.
- Security headers, rate limiting, and no-store API responses.
- `/api/health` and `/api/ready` endpoints.
- Docker packaging and persistent volume configuration.
- Automated integration test covering health/readiness, auth, sync, authorization, and logout invalidation.

## External requirements
Google OAuth, production AI, background push, Android signing, real HTTPS deployment, and device/browser matrix QA still require external credentials or infrastructure and are intentionally not marked as verified here.
