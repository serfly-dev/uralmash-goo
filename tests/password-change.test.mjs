import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync } from 'node:crypto';

test('password change requires an emailed code and old password, and survives restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'admin-password-'));
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port; await new Promise(r => server.close(r));
  const mailFile = join(dir, 'mail.json');
  const preload = join(dir, 'mail-mock.mjs');
  await writeFile(preload, `import nodemailer from ${JSON.stringify(resolve('node_modules/nodemailer/dist/esm/nodemailer.js'))};\nimport {writeFile} from 'node:fs/promises';\nconst realNow=Date.now; let offset=0; Date.now=()=>realNow()+offset; process.on('SIGUSR2',()=>{offset+=61_000});\nnodemailer.createTransport=()=>({sendMail: async (mail)=>{await writeFile(process.env.TEST_MAIL_FILE, JSON.stringify(mail));}});`);
  const env = { ...process.env, NODE_ENV: 'development', API_HOST:'127.0.0.1', API_PORT:String(port), SQLITE_PATH:join(dir,'test.sqlite'), REQUEST_ENCRYPTION_KEY:'a'.repeat(64), ADMIN_USERNAME:'tester', ADMIN_PASSWORD:'old-password-123', APP_ORIGIN:'https://example.test', MAIL_NOTIFICATIONS_ENABLED:'true', SMTP_HOST:'test', SMTP_PORT:'465', SMTP_SECURE:'true', SMTP_USER:'test', SMTP_PASSWORD:'test', SMTP_FROM:'from@example.test', SMTP_TO:'admin@example.test', TEST_MAIL_FILE:mailFile };
  let child;
  async function start() {
    child = spawn(process.execPath, ['--import', preload, 'server/index.mjs'], { env, stdio:'ignore' });
    for (let i=0;i<100;i++) { try { await fetch(`http://127.0.0.1:${port}/api/auth/me`); return; } catch { await new Promise(r=>setTimeout(r,50)); } }
    throw new Error('server did not start');
  }
  async function stop() { if (child && child.exitCode === null) { child.kill(); await new Promise(r=>child.once('exit',r)); } }
  let cookie = '';
  async function post(path, body) { return fetch(`http://127.0.0.1:${port}/api/auth/${path}`, { method:'POST', headers:{ origin:'https://example.test', 'content-type':'application/json', cookie }, body:JSON.stringify(body) }); }
  try {
    await start();
    const db = new DatabaseSync(join(dir, 'test.sqlite'));
    const initial = db.prepare('SELECT password_hash, password_salt FROM admin_account').get();
    assert.match(initial.password_hash, /^\$2[aby]\$12\$/);
    assert.equal(initial.password_salt, 'bcrypt-sha256');
    const legacySalt = 'legacy-salt';
    const legacyHash = scryptSync('old-password-123', legacySalt, 64).toString('hex');
    db.prepare('UPDATE admin_account SET password_hash=?, password_salt=?').run(legacyHash, legacySalt);
    assert.equal((await post('login', {username:'tester', password:'wrong'})).status, 401);
    assert.equal(db.prepare('SELECT password_hash FROM admin_account').get().password_hash, legacyHash);
    let response = await post('login', {username:'tester', password:'old-password-123'}); assert.equal(response.status,200); cookie=response.headers.get('set-cookie').split(';')[0];
    assert.match(db.prepare('SELECT password_hash FROM admin_account').get().password_hash, /^\$2[aby]\$12\$/);
    response=await post('password/change', {currentPassword:'old-password-123', newPassword:'new-password-456'}); assert.equal(response.status,403);
    response=await post('password/code', {}); assert.equal(response.status,200);
    const mail=JSON.parse(await readFile(mailFile,'utf8')); assert.equal(mail.to,'admin@example.test'); const code=mail.text.match(/\b\d{6}\b/)[0];
    const firstCookie = cookie;
    response=await post('login', {username:'tester', password:'old-password-123'}); assert.equal(response.status,200); cookie=response.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('password/code', {})).status,429);
    child.kill('SIGUSR2'); await new Promise(r=>setTimeout(r,100));
    assert.equal((await post('password/code', {})).status,200);
    const secondCode=JSON.parse(await readFile(mailFile,'utf8')).text.match(/\b\d{6}\b/)[0];
    assert.equal((await post('password/verify', {code:secondCode})).status,200);
    cookie=firstCookie;
    response=await post('password/verify', {code:'not-a-code'}); assert.equal(response.status,400);
    response=await post('password/verify', {code: code === '000000' ? '000001' : '000000'}); assert.equal(response.status,400);
    response=await post('password/verify', {code}); assert.equal(response.status,200);
    cookie=response.headers.get('set-cookie')?.split(';')[0] || firstCookie;
    // The second session cannot use the first session's verification.
    const secondLogin=await post('login', {username:'tester', password:'old-password-123'}); const thirdCookie=secondLogin.headers.get('set-cookie').split(';')[0];
    cookie=thirdCookie; assert.equal((await post('password/change', {currentPassword:'old-password-123',newPassword:'new-password-456'})).status,403);
    cookie=firstCookie;
    response=await post('password/change', {currentPassword:'wrong', newPassword:'new-password-456'}); assert.equal(response.status,401);
    response=await post('password/change', {currentPassword:'old-password-123', newPassword:'new-password-456'}); assert.equal(response.status,200);
    assert.equal((await post('password/change', {currentPassword:'new-password-456', newPassword:'another-password'})).status,401);
    assert.match(db.prepare('SELECT password_hash FROM admin_account').get().password_hash, /^\$2[aby]\$12\$/);
    db.close();
    await stop(); await start(); cookie='';
    assert.equal((await post('login', {username:'tester', password:'new-password-456'})).status,200);
  } finally { await stop(); await rm(dir,{recursive:true,force:true}); }
});
