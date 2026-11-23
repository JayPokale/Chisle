const { formatMoney, sumCents } = require("../src/money");

const cases = [];
for (const cents of [0, 1, 9, 10, 99, 100, 101, 999, 1000, 1050, 12345, 99999, 100000, -1, -250, -99999]) {
  const abs = Math.abs(cents);
  const want = (cents < 0 ? "-" : "") + "$" + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
  cases.push({ name: `formatMoney ${cents} → ${want}`, got: () => formatMoney(cents), want });
}
cases.push({ name: "sumCents of nothing → 0", got: () => sumCents([]), want: 0 });
cases.push({ name: "sumCents [100, 250, 5] → 355", got: () => sumCents([100, 250, 5]), want: 355 });
module.exports = cases;
