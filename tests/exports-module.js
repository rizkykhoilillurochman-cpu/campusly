const assert = require('node:assert/strict');
const { createExports } = require('../server/exports.cjs');

const exportsApi = createExports({
  Document: class {}, Packer: {}, Paragraph: class {}, TextRun: class {},
  HeadingLevel: {}, AlignmentType: {}, TableOfContents: class {}, PageNumber: {},
  Footer: class {}, PageBreak: class {}, PDFDocument: class {}, PptxGenJS: class {},
  fs: { existsSync: () => false }, text: value => String(value || '').trim(),
  cleanFormal: value => String(value || ''), gemini: async () => ({ text: '{}' }),
  modeInstruction: () => '', jsonInstruction: () => ({}), pptSchema: {}, fetchJson: async () => ({})
});

for (const name of ['makeDoc', 'makePdf', 'buildPpt', 'makePpt', 'themeOf', 'clampBullet']) {
  assert.equal(typeof exportsApi[name], 'function', `${name} is exported`);
}
assert.equal(exportsApi.themeOf('minimal').bg, 'F8FAFC');
assert.equal(exportsApi.clampBullet('  satu   dua  tiga '), 'satu dua tiga');
console.log('export builders module: ok');
