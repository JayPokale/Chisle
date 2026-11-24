// Sales tax by region, applied to the amount actually charged.
const { roundCents } = require("./money");

const TAX_RATES = {
  "CA-AB": 0.05,
  "CA-BC": 0.12,
  "CA-MB": 0.12,
  "CA-NB": 0.15,
  "CA-NL": 0.15,
  "CA-NS": 0.14,
  "CA-ON": 0.13,
  "CA-PE": 0.15,
  "CA-QC": 0.14975,
  "CA-SK": 0.11,
  "US-AL": 0.04,
  "US-AZ": 0.056,
  "US-CA": 0.0725,
  "US-CO": 0.029,
  "US-FL": 0.06,
  "US-GA": 0.04,
  "US-IL": 0.0625,
  "US-MA": 0.0625,
  "US-MI": 0.06,
  "US-MN": 0.06875,
  "US-NJ": 0.06625,
  "US-NY": 0.04,
  "US-OH": 0.0575,
  "US-OR": 0,
  "US-PA": 0.06,
  "US-TX": 0.0625,
  "US-WA": 0.065,
  "DE": 0.19,
  "FR": 0.2,
  "ES": 0.21,
  "IT": 0.22,
  "NL": 0.21,
  "IE": 0.23,
  "PT": 0.23,
  "SE": 0.25,
  "DK": 0.25,
  "FI": 0.255,
  "PL": 0.23,
  "AT": 0.2,
  "BE": 0.21,
};

function computeTax(cents, region) {
  const rate = TAX_RATES[region];
  if (rate === undefined) throw new Error("unknown region: " + region);
  return roundCents(cents * rate);
}

module.exports = { TAX_RATES, computeTax };
