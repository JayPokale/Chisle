// Statements also format inline.
function statementRow(label, cents) {
  return label + '\t' + '$' + (cents / 100).toFixed(2);
}

module.exports = { statementRow };
