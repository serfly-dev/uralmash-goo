import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeSocialUrl } from '../app/lib/social-links.mjs';

test('only valid HTTPS social links become clickable', () => {
  assert.equal(safeSocialUrl('  https://t.me/example  '), 'https://t.me/example');
  for (const value of ['', undefined, 'javascript:alert(1)', 'http://example.com', 'invalid']) {
    assert.equal(safeSocialUrl(value), null);
  }
});
