# Campusly QA Checklist

## Verified locally
- [x] app.js syntax
- [x] server.js syntax
- [x] API health
- [x] Email/password registration
- [x] Login/session
- [x] Authenticated sync GET/PUT
- [x] Unauthorized sync rejection
- [x] SQLite durable storage
- [x] Legacy JSON migration path
- [x] Global search across tasks, notes, schedule, calendar, documents, thesis
- [x] Reminder create/delete/persistence
- [x] Reminder notification scheduling while page is open
- [x] TXT extraction
- [x] PDF extraction via pdftotext
- [x] DOCX extraction via LibreOffice
- [x] XLSX extraction via LibreOffice
- [x] Security headers and request-size limits
- [x] PWA manifest + service-worker cache asset update
- [x] Keyboard focus styling
- [x] prefers-reduced-motion support
- [x] Capacitor configuration contract present

## Pending external/integration QA
- [ ] Google OAuth with real client credentials
- [ ] Production HTTPS redirect/callback
- [ ] Production database hosting/migrations
- [ ] Background push reminders on deployed HTTPS origin
- [ ] Google Workspace integrations
- [ ] Full Chrome/Edge/mobile browser interaction matrix
- [ ] Screen-reader audit
- [ ] Full accessibility contrast/ARIA audit
- [ ] Penetration/security configuration audit
- [ ] Android SDK + Capacitor release build
- [ ] Production deployment and rollback test
