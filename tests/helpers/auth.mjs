import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

export const mailPreload = resolve('tests/helpers/mock-mail.mjs');
export const mailEnv = (dir) => ({ MAIL_NOTIFICATIONS_ENABLED:'true', SMTP_HOST:'test', SMTP_PORT:'465', SMTP_SECURE:'true', SMTP_USER:'test', SMTP_PASSWORD:'test', SMTP_FROM:'from@example.test', SMTP_TO:'admin@example.test', TEST_MAIL_FILE:join(dir, 'mail.json') });
export async function login(base, origin, dir) {
  const headers = { origin, 'content-type':'application/json' };
  const response = await fetch(`${base}/api/auth/login`, { method:'POST', headers, body:JSON.stringify({ username:'tester', password:'old-password-123' }) });
  assert.equal(response.status, 200);
  const { challenge } = await response.json();
  const code = JSON.parse(await readFile(join(dir, 'mail.json'), 'utf8')).text.match(/\b\d{6}\b/)[0];
  const verified = await fetch(`${base}/api/auth/login/verify`, { method:'POST', headers, body:JSON.stringify({ challenge, code }) });
  assert.equal(verified.status, 200);
  return verified.headers.get('set-cookie').split(';')[0];
}
