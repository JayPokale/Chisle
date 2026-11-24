// Whole-cent money helpers. Amounts are integers in cents throughout.
/** Rounds a fractional cent amount to whole cents (half away from zero for positives). */
const roundCents = (x) => Math.round(x);
/** Sums an array of cent amounts. */
const sumCents = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Formats cents for display: formatMoney(123456) is "$1,234.56".
 * @param {number} cents integer cents, may be negative
 * @param {string} [symbol="$"] prefix placed after the sign
 */
function formatMoney(cents, symbol = "$") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(abs % 100).padStart(2, "0");
  return sign + symbol + whole + "." + frac;
}

module.exports = { roundCents, sumCents, formatMoney };
