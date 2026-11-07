import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

test('legal contact details are editable, public only when published, and validated', async () => {
  const dir=await mkdtemp(join(tmpdir(),'legal-contacts-'));
  await mkdir(join(dir,'server')); await copyFile(resolve('server/index.mjs'),join(dir,'server/index.mjs')); await symlink(resolve('node_modules'),join(dir,'node_modules'));
  const listener=net.createServer(); await new Promise(r=>listener.listen(0,'127.0.0.1',r)); const port=listener.address().port; await new Promise(r=>listener.close(r));
  const origin='http://localhost:3000', base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server/index.mjs'],{cwd:dir,stdio:'ignore',env:{...process.env,NODE_ENV:'development',API_HOST:'127.0.0.1',API_PORT:String(port),SQLITE_PATH:join(dir,'test.sqlite'),REQUEST_ENCRYPTION_KEY:'a'.repeat(64),ADMIN_USERNAME:'tester',ADMIN_PASSWORD:'old-password-123',APP_ORIGIN:origin,MAIL_NOTIFICATIONS_ENABLED:'false'}});
  try {
    for(let i=0;i<100;i++){try{await fetch(`${base}/api/auth/me`);break;}catch{if(i===99)throw new Error('server did not start');await new Promise(r=>setTimeout(r,50));}}
    const headers={origin,'content-type':'application/json'};
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers,body:JSON.stringify({username:'tester',password:'old-password-123'})}); assert.equal(login.status,200);
    headers.cookie=login.headers.get('set-cookie').split(';')[0];
    const payload={legalName:'ООО «Пример»',inn:'1234567890',ogrn:'1234567890123',legalAddress:'г. Екатеринбург, ул. Примерная, 1'};
    const body={slug:'contacts',title:'Контакты',payload,published:true};
    const created=await fetch(`${base}/api/admin/content/contacts`,{method:'POST',headers,body:JSON.stringify(body)}); assert.equal(created.status,201); const {id}=await created.json();
    let contacts=await (await fetch(`${base}/api/public/contacts`)).json(); assert.deepEqual(contacts[0].payload,payload);
    const invalid=await fetch(`${base}/api/admin/content/contacts/${id}`,{method:'PUT',headers,body:JSON.stringify({...body,payload:{...payload,inn:{value:'123'}}})}); assert.equal(invalid.status,400);
    const invalidOgrn=await fetch(`${base}/api/admin/content/contacts/${id}`,{method:'PUT',headers,body:JSON.stringify({...body,payload:{...payload,ogrn:'123'}})}); assert.equal(invalidOgrn.status,400);
    const hidden=await fetch(`${base}/api/admin/content/contacts/${id}`,{method:'PUT',headers,body:JSON.stringify({...body,published:false})}); assert.equal(hidden.status,204);
    contacts=await (await fetch(`${base}/api/public/contacts`)).json(); assert.equal(contacts.length,0);
  } finally {if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
