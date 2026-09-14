#!/usr/bin/env node
// Shared significance helpers. Two arms, binary outcome per cell, so the honest
// test is Fisher's exact on the 2x2 table -- no normal approximation, which
// matters at the cell counts these suites actually run.
//
// A difference this suite cannot separate from noise is reported as such.
// Publishing "84% vs 76%" off 25 cells an arm without the p-value would be
// exactly the kind of number this project exists to not print.

const lgamma = (x) => {                       // Lanczos
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
};
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

// Two-sided Fisher exact p for [[a,b],[c,d]].
function fisher(a, b, c, d) {
  const n = a + b + c + d;
  const lp = (x) => lchoose(a + b, x) + lchoose(c + d, a + c - x) - lchoose(n, a + c);
  const obs = lp(a);
  const lo = Math.max(0, a + c - (c + d));
  const hi = Math.min(a + b, a + c);
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const v = lp(x);
    if (v <= obs + 1e-9) p += Math.exp(v);
  }
  return Math.min(1, p);
}

// Wilson score interval -- honest at small n, unlike the textbook normal one.
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, z2 = z * z;
  const den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / den;
  return [Math.max(0, c - half), Math.min(1, c + half)];
}

const fmtP = (p) => (p < 0.001 ? '<0.001' : p.toFixed(3));

module.exports = { fisher, wilson, fmtP };
