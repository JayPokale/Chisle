const { slugify } = require('../utils/slugify');

function userPath(displayName) {
  return `/users/${slugify(displayName)}`;
}

module.exports = { userPath };
