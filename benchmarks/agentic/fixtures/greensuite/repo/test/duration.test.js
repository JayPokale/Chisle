const { parseDuration } = require('../src/duration');

const outcome = (s) => { try { return parseDuration(s); } catch (_) { return 'throws'; } };
const cases = [];
const UNITS = { ms: 1, s: 1000, m: 60000 };
for (const n of [0, 1, 2, 5, 10, 15, 30, 45, 90, 120, 250, 999]) {
  for (const u of Object.keys(UNITS)) cases.push({ name: `parseDuration ${n}${u} → ${n * UNITS[u]}`, got: () => parseDuration(n + u), want: n * UNITS[u] });
}
for (const [s, want] of [['1m30s', 90000], ['2m5s', 125000], ['1s500ms', 1500], ['0.5s', 500], ['1.5m', 90000], ['10m10s10ms', 610010], [' 3s ', 3000]]) {
  cases.push({ name: `parseDuration "${s}" → ${want}`, got: () => parseDuration(s), want });
}
for (const s of ['', 'abc', '5', '5x', '3d', 'm5', '1 m', '-1s']) {
  cases.push({ name: `parseDuration rejects "${s}"`, got: () => outcome(s), want: 'throws' });
}
module.exports = cases;
