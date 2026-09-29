# Campusly Architecture

## Runtime

- `app.js` — core application state, routing, rendering, and base features.
- `ui.js` — canonical navigation/icon presentation layer.
- `final-polish.js` — consolidated non-AI feature layer currently responsible for the richer Tasks, Notes, Schedule, Calendar, Semester, GPA, Finance, Reminders, Settings, backup, and global-search behavior.
- `ai-runtime.js` / `ai-fix.js` — AI runtime and AI-specific fixes; intentionally kept separate until the AI subsystem is rebuilt cleanly.
- `developer-contact.js` — developer/contact settings UI.

## Rule

Feature behavior must have one canonical implementation. Do not add overlay/override files for an existing feature. When a feature is rebuilt, remove the previous implementation after the replacement is verified.

## Current consolidation

Legacy duplicate layers `enhancements.js`, `non-ai-upgrade.js`, and `final-state-bridge.js` are retired. `index.html` exposes the canonical `state` from `app.js` directly before loading the consolidated feature layer.
