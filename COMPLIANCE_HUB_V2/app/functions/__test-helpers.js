/**
 * Test helpers that re-export internal functions from index.js
 * for unit testing. Only available when FUNCTIONS_EMULATOR is set.
 */
const indexPath = require.resolve('./index');

module.exports = new Proxy(
    {},
    {
        get(_target, prop) {
            process.env.FUNCTIONS_EMULATOR = 'true';
            delete require.cache[indexPath];
            const mod = require('./index');
            if (!mod.__test) return undefined;
            if (prop === '__test') return mod.__test;
            return mod.__test[prop];
        },
    }
);
