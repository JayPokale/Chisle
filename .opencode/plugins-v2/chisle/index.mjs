import { createRequire } from 'module';

import { Plugin } from '@opencode/plugin';

const require = createRequire(import.meta.url);
const setup = require('./setup.cjs');

export default Plugin.define({ id: 'chisle', setup });
