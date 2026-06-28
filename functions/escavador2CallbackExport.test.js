import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

describe('Escavador2 callback export', () => {
  it('exports escavador2Callback and test helpers', () => {
    expect(mod.escavador2Callback).toBeDefined();
    expect(mod.__test.handleEscavador2CallbackLogic).toBeTypeOf('function');
    expect(mod.__test.buildEscavador2CallbackUrl).toBeTypeOf('function');
  });
});
