# Campusly

Campusly is a student operating system built as a responsive PWA with a Node.js API boundary.

## Run locally

```bash
npm start
```

Open `http://localhost:8787`.

## Production environment

Set the variables in `.env.example` before deploying. Never put provider secrets in the frontend.

## Storage

Campusly v1.0.0-rc1 uses SQLite with WAL mode for durable server-side user data and sessions. Existing `server-data.json` data is migrated automatically on first startup when the SQLite database is empty.

## Google OAuth

Configure a Google OAuth Web application with redirect URI:

`https://YOUR_DOMAIN/api/auth/google/callback`

Then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.

## Document extraction

TXT/MD/CSV/JSON/HTML are read directly. PDF uses `pdftotext`; Office/OpenDocument files use LibreOffice conversion. The deployed host must provide those binaries for server extraction.

## Android

`capacitor.config.json` is included as the packaging contract. An Android project/APK is not claimed as built until Capacitor/Android SDK tooling is installed and a release build succeeds.
