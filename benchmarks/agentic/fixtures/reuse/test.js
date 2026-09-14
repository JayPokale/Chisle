const { postPath } = require('./src/routes/posts');
const cases = [
  ['Cr\u00e8me Br\u00fbl\u00e9e & Sugar', '/posts/creme-brulee-and-sugar'],
  ['Hello, World!', '/posts/hello-world'],
  ['  Se\u00f1or  Ni\u00f1o  ', '/posts/senor-nino'],
];
let bad = 0;
for (const [inp, want] of cases) {
  let got;
  try { got = postPath(inp); } catch (e) { got = 'THREW: ' + e.message; }
  if (got !== want) { bad++; console.log('FAIL ' + JSON.stringify(inp) + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}
process.exit(bad ? 1 : 0);
