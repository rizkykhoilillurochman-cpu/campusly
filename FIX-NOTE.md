# Temporary deployment note

Frontend asset cache-busting was advanced to `20260930-0301` after the export/preview fixes. If the deployed page still shows raw HTML in the PPT preview, the browser is serving an older JS bundle and must receive the current `campusly-v5.js` deployment.
