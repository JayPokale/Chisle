let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};
const fresh = () => { for (const k of Object.keys(require.cache)) delete require.cache[k]; return require('./src/client'); };

delete process.env.RETRY_COUNT;
check('default', fresh().retries(), 3);

process.env.RETRY_COUNT = '5';
check('override', fresh().retries(), 5);

process.env.RETRY_COUNT = '0';
check('zero', fresh().retries(), 0);

process.exit(bad ? 1 : 0);
