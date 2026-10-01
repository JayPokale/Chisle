const cents = require('../src/cents');

module.exports = Array.from({ length: 100 }, (_, i) => {
  const c = i * 137 - 5000;
  const a = Math.abs(c);
  const want = (c < 0 ? '-' : '') + '$' + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
  return { name: `formats ${c} as ${want}`, got: () => cents(c), want };
});
