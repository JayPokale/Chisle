// Shared skip option for tests that need to create a symlink. Windows only
// allows that with Developer Mode or an elevated shell (EPERM otherwise); any
// other failure is a real error and is left to surface in the test itself.
const fs = require('fs');
const os = require('os');
const path = require('path');

function symlinksSupported() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-symlink-probe-'));
  try {
    fs.symlinkSync(path.join(dir, 'target'), path.join(dir, 'link'));
    return true;
  } catch (e) {
    if (e.code === 'EPERM') return false;
    throw e;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { symlinkSkip: symlinksSupported() ? false : 'creating symlinks needs Developer Mode or admin on Windows (EPERM)' };
