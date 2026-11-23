// Display conversion from USD cents. Rates are fixed per release.
const { roundCents } = require("./money");

const FX_RATES = {
  "USD": 1,
  "CAD": 1.37,
  "EUR": 0.92,
  "GBP": 0.79,
  "JPY": 151.2,
  "AUD": 1.52,
  "NZD": 1.66,
  "CHF": 0.88,
  "SEK": 10.6,
  "NOK": 10.8,
  "DKK": 6.87,
  "PLN": 3.98,
  "CZK": 23.1,
  "HUF": 362,
  "MXN": 17.1,
  "BRL": 5.05,
  "INR": 83.3,
  "SGD": 1.35,
  "HKD": 7.82,
  "KRW": 1345,
};

function convertCents(cents, currency) {
  const rate = FX_RATES[currency];
  if (rate === undefined) throw new Error("unknown currency: " + currency);
  return roundCents(cents * rate);
}

module.exports = { FX_RATES, convertCents };
