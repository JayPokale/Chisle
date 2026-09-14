const { uniqueIds } = require('./src/importer');
let bad = 0;
const got = uniqueIds(['b', 'a', 'b', 'c', 'a']);
if (JSON.stringify(got) !== JSON.stringify(['b', 'a', 'c'])) { bad++; console.log('FAIL order -> ' + JSON.stringify(got)); }
const empty = uniqueIds([]);
if (JSON.stringify(empty) !== '[]') { bad++; console.log('FAIL empty -> ' + JSON.stringify(empty)); }
process.exit(bad ? 1 : 0);
