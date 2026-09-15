'use strict';

// OMP entry point. OMP only maps `module.exports` onto `default` for modules it
// classifies as graph-owned CommonJS, and its classifier excludes the entry file
// itself unless the filename ends in `.cjs` (see isGraphOwnedCommonJsModule in
// oh-my-pi's legacy-pi-compat.ts). A CommonJS entry named `.js` is imported as
// ESM, so `default` is undefined and the factory lookup fails with
// "Extension does not export a valid factory function".
//
// Requiring index.js from here makes it a graph-owned dependency, which the
// classifier does handle, so both runtimes get the same factory. Pi keeps
// loading index.js directly via the `pi` manifest block below.
module.exports = require('./index.js');
