const { isExpired } = require('./session');

function requireAuth(session, now) {
  if (!session) return { status: 401, body: 'no session' };
  if (isExpired(session.expiresAt, now)) return { status: 401, body: 'expired' };
  return { status: 200, body: session.userId };
}

module.exports = { requireAuth };
