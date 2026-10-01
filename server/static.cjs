const fs = require('node:fs');
const path = require('node:path');

function createStaticHandler(root, publicFiles, mimeTypes) {
  return function staticFile(res, pathname) {
    const fileName = publicFiles[pathname];
    if (!fileName) return false;
    const file = path.resolve(root, fileName);
    if (!file.startsWith(path.resolve(root) + path.sep)) return false;
    if (!fs.existsSync(file)) return false;
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': body.length
    });
    res.end(body);
    return true;
  };
}

module.exports = { createStaticHandler };
