// A session is valid until its expiry instant. At the expiry instant it is over.
function isExpired(expiresAt, now = Date.now()) {
  return now > expiresAt;
}

module.exports = { isExpired };
