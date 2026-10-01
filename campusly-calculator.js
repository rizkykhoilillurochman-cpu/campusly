const FUNCTIONS = Object.freeze({ sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, sqrt: Math.sqrt });

export function evaluateExpression(source) {
  const input = String(source ?? '').replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|[()+\-*/^]/gi) || [];
  if (tokens.join('') !== input.replace(/\s+/g, '')) throw new Error('Ekspresi berisi karakter yang tidak didukung.');
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const primary = () => {
    const token = take();
    if (token === '(') { const value = sum(); if (take() !== ')') throw new Error('Tanda kurung belum lengkap.'); return value; }
    if (token && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) return Number(token);
    if (token?.toLowerCase() === 'pi') return Math.PI;
    if (Object.hasOwn(FUNCTIONS, token?.toLowerCase())) {
      const name = token.toLowerCase();
      if (take() !== '(') throw new Error(`Pakai ${name}(...) untuk fungsi ini.`);
      const value = sum(); if (take() !== ')') throw new Error('Tanda kurung belum lengkap.');
      return FUNCTIONS[name](value);
    }
    throw new Error('Ekspresi belum lengkap.');
  };
  const power = () => { let value = primary(); if (peek() === '^') { take(); value **= unary(); } return value; };
  const unary = () => { if (peek() === '+') { take(); return unary(); } if (peek() === '-') { take(); return -unary(); } return power(); };
  const product = () => { let value = unary(); while (peek() === '*' || peek() === '/') { const op = take(), rhs = unary(); value = op === '*' ? value * rhs : value / rhs; } return value; };
  const sum = () => { let value = product(); while (peek() === '+' || peek() === '-') { const op = take(), rhs = product(); value = op === '+' ? value + rhs : value - rhs; } return value; };
  if (!tokens.length) throw new Error('Masukkan perhitungan dulu.');
  const value = sum();
  if (cursor !== tokens.length) throw new Error('Ekspresi tidak valid.');
  if (!Number.isFinite(value)) throw new Error('Hasil tidak bisa dihitung.');
  return value;
}
