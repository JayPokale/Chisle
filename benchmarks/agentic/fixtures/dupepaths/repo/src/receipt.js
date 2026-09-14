// Receipts format inline rather than going through money.js.
function receiptTotal(cents) {
  return 'TOTAL ' + '$' + (cents / 100).toFixed(2);
}

module.exports = { receiptTotal };
