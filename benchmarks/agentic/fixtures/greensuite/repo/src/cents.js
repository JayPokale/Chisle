module.exports = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2);
