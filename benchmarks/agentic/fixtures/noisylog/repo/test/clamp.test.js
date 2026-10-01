const clamp = require('../src/clamp');

module.exports = Array.from({ length: 120 }, (_, k) => {
  const i = k - 10;
  const want = i < 0 ? 0 : i > 100 ? 100 : i;
  return { name: `clamps ${i} into [0, 100] → ${want}`, got: () => clamp(i, 0, 100), want };
});
