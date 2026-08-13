import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boundedIntegerSetting, strictIntegerSetting } from '../runtime-config.js';

const bounds = { fallback: 50, min: 20, max: 100 };

test('integer runtime settings use defaults and stay inside explicit bounds', () => {
  assert.equal(boundedIntegerSetting(undefined, bounds), 50);
  assert.equal(boundedIntegerSetting(null, bounds), 50);
  assert.equal(boundedIntegerSetting('', bounds), 50);
  assert.equal(boundedIntegerSetting(' \t\n ', bounds), 50);
  assert.equal(boundedIntegerSetting('not-a-number', bounds), 50);
  assert.equal(boundedIntegerSetting('Infinity', bounds), 50);
  assert.equal(boundedIntegerSetting('42.9', bounds), 42);
  assert.equal(boundedIntegerSetting('0', bounds), 20);
  assert.equal(boundedIntegerSetting(0, bounds), 20);
  assert.equal(boundedIntegerSetting('-500', bounds), 20);
  assert.equal(boundedIntegerSetting('10000', bounds), 100);
});

test('invalid integer runtime bounds fail during startup configuration', () => {
  assert.throws(
    () => boundedIntegerSetting('50', { fallback: 50, min: 60, max: 100 }),
    /min <= fallback <= max/
  );
  assert.throws(
    () => boundedIntegerSetting('50', { fallback: 50.5, min: 20, max: 100 }),
    /min <= fallback <= max/
  );
});

test('strict integer settings accept only exact decimal integers inside their bounds', () => {
  const portBounds = { fallback: 8787, min: 0, max: 65535 };
  assert.equal(strictIntegerSetting(undefined, portBounds, 'PORT'), 8787);
  assert.equal(strictIntegerSetting('  ', portBounds, 'PORT'), 8787);
  assert.equal(strictIntegerSetting('0', portBounds, 'PORT'), 0);
  assert.equal(strictIntegerSetting(8787, portBounds, 'PORT'), 8787);
  assert.equal(strictIntegerSetting('+65535', portBounds, 'PORT'), 65535);

  for (const value of ['1.5', '1e3', '0x20', '-1', '65536', 'not-a-port', 'Infinity']) {
    assert.throws(
      () => strictIntegerSetting(value, portBounds, 'PORT'),
      /PORT must be an integer from 0 to 65535/
    );
  }
});
