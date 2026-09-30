// Compatibility entrypoint for deployments that still reference the historical server filename.
// Keep the actual implementation in the canonical server so there is only one backend.
require('./campusly-server-clean.js');
