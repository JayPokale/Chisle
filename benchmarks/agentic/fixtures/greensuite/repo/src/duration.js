// "1m30s" → 90000 ms. Units: ms, s, m. Throws on anything else.
const UNITS = { ms: 1, s: 1000, m: 60000 };

function parseDuration(str) {
  const s = String(str).trim();
  if (!/^(?:\d+(?:\.\d+)?(?:ms|s|m))+$/.test(s)) throw new Error('bad duration: ' + str);
  let total = 0;
  for (const [, n, unit] of s.matchAll(/(\d+(?:\.\d+)?)(ms|s|m)/g)) total += Number(n) * UNITS[unit];
  return Math.round(total);
}

module.exports = { parseDuration };
