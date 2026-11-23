const slug = require('../src/slug');

module.exports = Array.from({ length: 40 }, (_, i) => [
  { name: `slugs "Hello World ${i}"`, got: () => slug(`Hello World ${i}`), want: `hello-world-${i}` },
  { name: `slugs "  Trim Me ${i}  "`, got: () => slug(`  Trim Me ${i}  `), want: `trim-me-${i}` },
  { name: `slugs "Mixed_Case-${i}!"`, got: () => slug(`Mixed_Case-${i}!`), want: `mixed-case-${i}` },
]).flat();
