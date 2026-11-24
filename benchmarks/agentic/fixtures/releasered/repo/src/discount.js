// Discount codes: a percentage off, or a flat amount in cents.
const { roundCents } = require("./money");

const DISCOUNT_CODES = {
  "SPRING10": { pct: 10 },
  "SUMMER15": { pct: 15 },
  "AUTUMN20": { pct: 20 },
  "WINTER25": { pct: 25 },
  "WELCOME5": { pct: 5 },
  "LOYAL12": { pct: 12 },
  "STAFF30": { pct: 30 },
  "STUDENT10": { pct: 10 },
  "BULK8": { pct: 8 },
  "FLASH40": { pct: 40 },
  "TAKE5": { flat: 500 },
  "TAKE10": { flat: 1000 },
  "TAKE20": { flat: 2000 },
  "SHIPFREE": { flat: 799 },
  "REFER15": { flat: 1500 },
  "VIP50": { pct: 50 },
  "HALFOFF": { pct: 50 },
  "NEWYEAR18": { pct: 18 },
  "BLACKFRI35": { pct: 35 },
  "CYBER22": { pct: 22 },
};

function applyDiscountCode(subtotal, code) {
  if (!code) return 0;
  const d = DISCOUNT_CODES[code];
  if (!d) throw new Error("unknown code: " + code);
  const off = d.pct ? roundCents((subtotal * d.pct) / 100) : d.flat;
  return Math.min(off, subtotal);
}

module.exports = { DISCOUNT_CODES, applyDiscountCode };
