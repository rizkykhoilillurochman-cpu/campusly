const assert = require('node:assert/strict');
const fs = require('node:fs');

const files = ['campusly-v5.css', 'campusly-ai-v2.css'];
const css = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const definitions = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
const references = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]));
const missing = [...references].filter(name => !definitions.has(name));
assert.deepEqual(missing, [], `Undefined CSS tokens: ${missing.join(', ')}`);
assert.doesNotMatch(css, /var\(\s*--[\w-]+\s*,\s*#[\da-f]{3,8}\s*\)/i, 'AI styles do not hide missing tokens behind hard-coded fallbacks');

function contrast(hexA, hexB) {
  const luminance = hex => {
    const rgb = hex.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const values = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

const themes = [...css.matchAll(/--bubble-user-bg:(#[\da-f]{6});--bubble-user-fg:(#[\da-f]{6})/gi)];
assert.equal(themes.length, 2, 'user chat bubble colors are defined for dark and light themes');
for (const [, background, foreground] of themes) assert.ok(contrast(background, foreground) >= 4.5, `user bubble contrast ${background}/${foreground} meets WCAG AA`);
console.log('CSS tokens and user-bubble AA contrast checks passed.');
