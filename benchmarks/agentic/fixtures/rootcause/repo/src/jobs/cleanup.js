const { isExpired } = require('../auth/session');

function pruneSessions(sessions, now) {
  return sessions.filter((s) => !isExpired(s.expiresAt, now));
}

module.exports = { pruneSessions };
