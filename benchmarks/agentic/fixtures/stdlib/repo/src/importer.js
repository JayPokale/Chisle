function parseIds(csvLine) {
  return csvLine.split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = { parseIds };
