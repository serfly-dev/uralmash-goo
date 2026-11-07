import { mailPreload, mailEnv, login } from './helpers/auth.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

test('policy editing requires authentication and saved text is public; callback requires consent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'privacy-policy-'));
  await mkdir(join(dir, 'server'));
  await copyFile(resolve('server/index.mjs'), join(dir, 'server/index.mjs'));
  await symlink(resolve('node_modules'), join(dir, 'node_modules'));
  const listener = net.createServer();
  await new Promise((r) => listener.listen(0, '127.0.0.1', r));
  const port = listener.address().port;
  await new Promise((r) => listener.close(r));
  const origin = 'https://example.test', base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', mailPreload, 'server/index.mjs'], { cwd: dir, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'development', API_HOST: '127.0.0.1', API_PORT: String(port), SQLITE_PATH: join(dir, 'test.sqlite'), REQUEST_ENCRYPTION_KEY: 'a'.repeat(64), ADMIN_USERNAME: 'tester', ADMIN_PASSWORD: 'old-password-123', APP_ORIGIN: origin, ...mailEnv(dir) } });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(`${base}/api/auth/me`); break; } catch { if (i === 99) throw new Error('server did not start'); await new Promise((r) => setTimeout(r, 50)); } }
    const headers = { origin, 'content-type': 'application/json' };
    assert.equal((await fetch(`${base}/api/admin/privacy-policy`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/privacy-policy`, { method: 'PUT', headers, body: JSON.stringify({ text: 'Текст' }) })).status, 401);
    assert.deepEqual(await (await fetch(`${base}/api/public/privacy-policy`)).json(), { text: '' });
    headers.cookie = await login(base, origin, dir);
    assert.equal((await fetch(`${base}/api/admin/privacy-policy`, { method: 'PUT', headers, body: JSON.stringify({ text: '  ' }) })).status, 400);
    for (const text of ['Первый текст\nВторая строка', 'Обновлённый текст']) {
      assert.equal((await fetch(`${base}/api/admin/privacy-policy`, { method: 'PUT', headers, body: JSON.stringify({ text }) })).status, 204);
      assert.deepEqual(await (await fetch(`${base}/api/public/privacy-policy`)).json(), { text });
    }
    const callback = await fetch(`${base}/api/callback`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Иван', phone: '+79991234567', intent: 'general', sourcePath: '/', consent: false }) });
    assert.equal(callback.status, 400);
    assert.match((await callback.json()).error, /согласие/i);
  } finally {
    if (child.exitCode === null) { child.kill(); await new Promise((r) => child.once('exit', r)); }
    await rm(dir, { recursive: true, force: true });
  }
});
