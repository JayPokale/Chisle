const { execFileSync } = require('child_process');
const {
  quoteShipment,
  eligibleServices,
  buildManifest,
  auditQuote,
} = require('./src/route-planner');

let bad = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    bad++;
    console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
  }
};

// Exact catalog maxima are valid weights. Each public path exercises the shared
// selection rule so a patch to only the first failing caller is insufficient.
check('quote exact ground maximum', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 10 }).code, 'BJ-GRD');
check('quote exact ground amount', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 10 }).cents, 1645);
check('quote ordinary ground amount', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 4 }).cents, 1195);
check('quote exact cold maximum', quoteShipment({ origin: 'MIA', destination: 'ATL', service: 'cold', weightKg: 8 }).code, 'MA-COLD');
check('eligible exact priority maximum', eligibleServices({ origin: 'SEA', destination: 'PDX', weightKg: 7 }).map((x) => x.code), ['SP-ECO', 'SP-GRD', 'SP-PRI', 'SP-OVR']);

const manifest = buildManifest([
  { id: 'boundary-1', origin: 'DEN', destination: 'PHX', service: 'overnight', weightKg: 3 },
  { id: 'boundary-2', origin: 'LAX', destination: 'SFO', service: 'returns', weightKg: 2 },
]);
check('manifest exact overnight maximum', manifest[0].status, 'ready');
check('manifest exact returns maximum', manifest[1].status, 'ready');
check('manifest exact overnight amount', manifest[0].cents, 2085);
check('manifest exact returns amount', manifest[1].cents, 515);
check('audit exact ground maximum', auditQuote({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 10 }).valid, true);
check('audit exact ground amount', auditQuote({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 10 }).cents, 1645);

check('under maximum still works', quoteShipment({ origin: 'CHI', destination: 'DTW', service: 'ground', weightKg: 9.99 }).code, 'CD-GRD');
check('over maximum is rejected', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 10.01 }).error, 'NO_RATE');
check('negative weight validation', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: -1 }).error, 'INVALID_WEIGHT');
check('NaN weight validation', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: Number.NaN }).error, 'INVALID_WEIGHT');
check('infinite weight validation', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: Number.POSITIVE_INFINITY }).error, 'INVALID_WEIGHT');
check('invalid lane validation', quoteShipment({ origin: 'BOS', destination: 'BOS', service: 'ground', weightKg: 1 }).error, 'INVALID_LANE');
check('invalid service validation', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'same-day', weightKg: 1 }).error, 'INVALID_SERVICE');
check('invalid value validation', quoteShipment({ origin: 'BOS', destination: 'JFK', service: 'ground', weightKg: 1, declaredValueCents: -1 }).error, 'INVALID_VALUE');

try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (e) { bad++; console.log('FAIL visible suite still red'); }
process.exit(bad ? 1 : 0);
