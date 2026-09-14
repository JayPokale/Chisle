const { requireAuth } = require('./src/auth/middleware');
const { canRefresh } = require('./src/api/refresh');
const { pruneSessions } = require('./src/jobs/cleanup');

const T = 1000;
const s = { userId: 'u1', expiresAt: T };
let bad = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};

// At the expiry instant: rejected on every path.
check('middleware@exp', requireAuth(s, T).status, 401);
check('refresh@exp', canRefresh(s, T), false);
check('cleanup@exp', pruneSessions([s], T).length, 0);

// One millisecond before expiry: still live on every path.
check('middleware@exp-1', requireAuth(s, T - 1).status, 200);
check('refresh@exp-1', canRefresh(s, T - 1), true);
check('cleanup@exp-1', pruneSessions([s], T - 1).length, 1);

process.exit(bad ? 1 : 0);
