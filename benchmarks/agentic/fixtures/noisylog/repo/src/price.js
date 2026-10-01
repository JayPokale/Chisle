// Price after a percentage discount, in whole cents.
function applyDiscount(cents, pct) {
  return Math.floor((cents * (100 - pct)) / 100);
}

module.exports = { applyDiscount };
