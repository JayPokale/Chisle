const { isExpired } = require('../auth/session');

// A refresh token can only be traded in while the session is still live.
function canRefresh(session, now) {
  return !isExpired(session.expiresAt, now);
}

module.exports = { canRefresh };
