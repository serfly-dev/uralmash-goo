import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import sharp from 'sharp';

test('origin and upload limits protect the API', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'security-boundaries-'));
  await mkdir(join(dir, 'server'));
  await copyFile(resolve('server/index.mjs'), join(dir, 'server/index.mjs'));
  await symlink(resolve('node_modules'), join(dir, 'node_modules'));
  const listener = net.createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r));
  const port = listener.address().port; await new Promise(r => listener.close(r));
  const origin = 'http://localhost:3000';
  const child = spawn(process.execPath, ['server/index.mjs'], { cwd:dir, stdio: 'ignore', env: { ...process.env, NODE_ENV:'development', API_HOST:'127.0.0.1', API_PORT:String(port), SQLITE_PATH:join(dir,'test.sqlite'), REQUEST_ENCRYPTION_KEY:'a'.repeat(64), ADMIN_USERNAME:'tester', ADMIN_PASSWORD:'old-password-123', APP_ORIGIN:origin, MAIL_NOTIFICATIONS_ENABLED:'false' } });
  const base = `http://127.0.0.1:${port}`;
  const open = [];
  try {
    for (let i=0;i<100;i++) { try { await fetch(`${base}/api/auth/me`); break; } catch { if (i===99) throw new Error('server did not start'); await new Promise(r=>setTimeout(r,50)); } }
    await t.test('rejects a different localhost origin', async () => {
      const response = await fetch(`${base}/api/auth/login`, { method:'OPTIONS', headers:{origin:'http://localhost:9999','access-control-request-method':'POST'} });
      assert.equal(response.status,403);
      assert.equal(response.headers.get('access-control-allow-origin'),null);
    });
    const login = await fetch(`${base}/api/auth/login`, { method:'POST', headers:{origin,'content-type':'application/json'}, body:JSON.stringify({username:'tester',password:'old-password-123'}) });
    assert.equal(login.status,200); const cookie=login.headers.get('set-cookie').split(';')[0];
    await t.test('limits body buffering and releases slots after abort', async () => {
      for (let i=0;i<2;i++) {
        const req=http.request(`${base}/api/admin/media`, { method:'POST', headers:{origin,cookie,'content-type':'video/mp4','content-length':'100000'} });
        req.on('error',()=>{}); req.write('partial'); open.push(req);
      }
      await new Promise(r=>setTimeout(r,200));
      const blocked=await fetch(`${base}/api/admin/media`,{method:'POST',headers:{origin,cookie,'content-type':'video/mp4'},body:'invalid'});
      assert.equal(blocked.status,503);
      open[0].destroy(); await new Promise(r=>setTimeout(r,200));
      const afterAbort=await fetch(`${base}/api/admin/media`,{method:'POST',headers:{origin,cookie,'content-type':'video/mp4'},body:'invalid'});
      assert.equal(afterAbort.status,415);
    });
    await t.test('accepts supported files and releases slots after completion', async () => {
      open[1].destroy(); await new Promise(r=>setTimeout(r,200));
      const image=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
      for (const [type, body] of [['image/png', image], ['video/mp4', Buffer.from('0000ftyp')], ['image/png', image]]) {
        const response=await fetch(`${base}/api/admin/media`,{method:'POST',headers:{origin,cookie,'content-type':type},body});
        assert.equal(response.status,201);
      }
    });
  } finally {
    for(const req of open) req.destroy();
    if(child.exitCode===null){child.kill(); await new Promise(r=>child.once('exit',r));}
    await rm(dir,{recursive:true,force:true});
  }
});
