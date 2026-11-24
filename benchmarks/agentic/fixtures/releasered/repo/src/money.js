// Whole-cent money helpers. Amounts are integers in cents throughout.
const roundCents = (x) => Math.round(x);
const sumCents = (xs) => xs.reduce((a, b) => a + b, 0);

function formatMoney(cents, symbol = "$") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return sign + symbol + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
}

module.exports = { roundCents, sumCents, formatMoney };
