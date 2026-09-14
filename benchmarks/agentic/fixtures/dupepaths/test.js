const { invoiceLine } = require('./src/invoice');
const { receiptTotal } = require('./src/receipt');
const { statementRow } = require('./src/statement');

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};

check('invoice-neg', invoiceLine({ name: 'Refund', cents: -450 }), 'Refund: -$4.50');
check('receipt-neg', receiptTotal(-450), 'TOTAL -$4.50');
check('statement-neg', statementRow('Credit', -450), 'Credit\t-$4.50');

check('invoice-pos', invoiceLine({ name: 'Widget', cents: 450 }), 'Widget: $4.50');
check('receipt-pos', receiptTotal(450), 'TOTAL $4.50');
check('statement-pos', statementRow('Charge', 450), 'Charge\t$4.50');

process.exit(bad ? 1 : 0);
