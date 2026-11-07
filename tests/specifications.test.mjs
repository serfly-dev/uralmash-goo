import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import net from 'node:net';
import { mailPreload, mailEnv, login } from './helpers/auth.mjs';

test('existing product characteristics enter the common directory without altering products', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'specifications-'));
  await mkdir(join(dir, 'server')); await copyFile(resolve('server/index.mjs'), join(dir, 'server/index.mjs')); await symlink(resolve('node_modules'), join(dir, 'node_modules'));
  const listener = net.createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r)); const port = listener.address().port; await new Promise(r => listener.close(r));
  const origin = 'https://example.test', base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, NODE_ENV:'development', API_HOST:'127.0.0.1', API_PORT:String(port), SQLITE_PATH:join(dir,'test.sqlite'), REQUEST_ENCRYPTION_KEY:'a'.repeat(64), ADMIN_USERNAME:'tester', ADMIN_PASSWORD:'old-password-123', APP_ORIGIN:origin, ...mailEnv(dir) };
  let child;
  async function start() { child = spawn(process.execPath, ['--import', mailPreload, 'server/index.mjs'], { cwd:dir, env, stdio:'ignore' }); for (let i=0;i<100;i++) { try { await fetch(`${base}/api/auth/me`); return; } catch { await new Promise(r=>setTimeout(r,50)); } } throw Error('server did not start'); }
  async function stop() { if (child && child.exitCode === null) { child.kill(); await new Promise(r=>child.once('exit',r)); } }
  try {
    await start(); const cookie = await login(base, origin, dir);
    const headers = { origin, cookie, 'content-type':'application/json' };
    const payload = { characteristics:{'Мощность':'до 15 кВт'}, variants:[{slug:'one', priceRub:100, characteristics:{'Масса':10}}] };
    const created = await fetch(`${base}/api/admin/content/products`, {method:'POST',headers,body:JSON.stringify({title:'Товар',slug:'test',payload,published:true})}); assert.equal(created.status,201);
    const invalidRange = await fetch(`${base}/api/admin/content/products`, {method:'POST',headers,body:JSON.stringify({title:'Неверный диапазон',slug:'bad',payload:{characteristics:{'Объём':{min:10,max:5}},variants:[]}})}); assert.equal(invalidRange.status,400);
    await stop(); await start();
    const specs = await (await fetch(`${base}/api/public/specifications`)).json();
    assert.deepEqual(specs.map(s=>s.title).sort(), ['Масса','Мощность']);
    const power = specs.find(s=>s.title === 'Мощность');
    const duplicate = await fetch(`${base}/api/admin/content/specifications`, {method:'POST',headers,body:JSON.stringify({title:'мощность',slug:'duplicate',payload:{valueType:'text'}})}); assert.equal(duplicate.status,409);
    const renamed = await fetch(`${base}/api/admin/content/specifications/${power.id}`, {method:'PUT',headers,body:JSON.stringify({title:'Новая мощность',slug:power.slug,payload:power.payload,published:true})}); assert.equal(renamed.status,409);
    assert.equal((await fetch(`${base}/api/admin/content/specifications/${power.id}`, {method:'DELETE',headers})).status,409);
    const products = await (await fetch(`${base}/api/public/products`)).json();
    assert.equal(products[0].characteristics['Мощность'], 'до 15 кВт');
    assert.equal(products[0].variants[0].characteristics['Масса'], 10);
    await stop(); await start();
    assert.equal((await (await fetch(`${base}/api/public/specifications`)).json()).length, 2);
    const db = new DatabaseSync(join(dir,'test.sqlite'), {readOnly:true}); assert.equal(db.prepare("SELECT payload_json FROM admin_content WHERE type='products'").get().payload_json,JSON.stringify(payload)); db.close();
  } finally { await stop(); await rm(dir,{recursive:true,force:true}); }
});
