const { formatMoney } = require('./money');

function invoiceLine(item) {
  return item.name + ': ' + formatMoney(item.cents);
}

module.exports = { invoiceLine };
