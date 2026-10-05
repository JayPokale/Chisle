const assert = require('assert');
const { quoteShipment, buildManifest, auditQuote } = require('../src/route-planner');

assert.equal(quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 4 }).code, 'BJ-GRD');
assert.equal(quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 4 }).cents, 1195);
assert.equal(quoteShipment({ origin: 'SEA', destination: 'PDX', service: 'priority', weightKg: 7 }).code, 'SP-PRI');
assert.equal(quoteShipment({ origin: 'MIA', destination: 'ATL', service: 'cold', weightKg: 8 }).code, 'MA-COLD');

const manifest = buildManifest([
  { id: 'a-1', origin: 'DEN', destination: 'PHX', service: 'overnight', weightKg: 3 },
  { id: 'a-2', origin: 'LAX', destination: 'SFO', service: 'returns', weightKg: 2 },
]);
assert.deepEqual(manifest.map((item) => item.id), ['a-1', 'a-2']);
assert.ok(manifest.every((item) => item.status === 'ready'));
assert.equal(manifest[0].cents, 2085);
assert.equal(auditQuote({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 4 }).cents, 1195);
assert.equal(quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: -1 }).error, 'INVALID_WEIGHT');
