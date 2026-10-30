import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
const dbPath = resolve(process.env.SQLITE_PATH || `${root}/data/site.sqlite`);
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS health_check (id INTEGER PRIMARY KEY, checked_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_content (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(type, slug)
  );
  CREATE TABLE IF NOT EXISTS callback_requests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Новая' CHECK(status IN ('Новая','В работе','Обработана')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const hasAdmin = Boolean(db.prepare('SELECT id FROM admin_account WHERE id = 1').get());
if (!hasAdmin && username && password && password.length < 12) {
  throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
}
if (username && password && !hasAdmin) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  db.prepare('INSERT INTO admin_account (id, username, password_hash, password_salt, created_at) VALUES (1, ?, ?, ?, ?)')
    .run(username, passwordHash, salt, new Date().toISOString());
}
db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
const localDevHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
function isAllowedOrigin(origin) {
  if (origin === appOrigin) return true;
  if (process.env.NODE_ENV === 'production' || !origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && localDevHosts.has(parsed.hostname) && parsed.origin === origin;
  } catch {
    return false;
  }
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = isAllowedOrigin(origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');
    return res.sendStatus(allowedOrigin ? 204 : 403);
  }
  next();
});
const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => {
  const index = part.indexOf('=');
  if (index < 0) return ['', ''];
  const key = part.slice(0, index).trim();
  const value = part.slice(index + 1).trim();
  try { return [key, decodeURIComponent(value)]; } catch { return [key, '']; }
}));
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const cookieName = 'uralgoo_admin';
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const sessionCookie = (token, maxAge) => `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie}`;
const sessionFor = (req) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const hash = hashToken(token);
  const session = db.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').get(hash, new Date().toISOString());
  if (!session) return null;
  return { tokenHash: hash, account: db.prepare('SELECT username FROM admin_account WHERE id = 1').get() };
};
const requireAdmin = (req, res, next) => {
  const session = sessionFor(req);
  if (!session?.account) return res.status(401).json({ error: 'Требуется вход в админ-панель.' });
  req.adminSession = session;
  next();
};
const attempts = new Map();
app.post('/api/auth/login', (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const ip = req.ip;
  const now = Date.now();
  const state = attempts.get(ip) || { count: 0, start: now };
  if (now - state.start > 15 * 60 * 1000) { state.count = 0; state.start = now; }
  if (state.count >= 5) return res.status(429).json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' });
  const { username: enteredUsername, password: enteredPassword } = req.body || {};
  const account = db.prepare('SELECT username, password_hash, password_salt FROM admin_account WHERE id = 1').get();
  let valid = false;
  if (account && typeof enteredUsername === 'string' && typeof enteredPassword === 'string' && enteredPassword.length <= 256) {
    const attempted = scryptSync(enteredPassword, account.password_salt, 64);
    valid = enteredUsername === account.username && timingSafeEqual(attempted, Buffer.from(account.password_hash, 'hex'));
  }
  if (!valid) {
    state.count += 1; attempts.set(ip, state);
    return res.status(401).json({ error: 'Неверный логин или пароль.' });
  }
  attempts.delete(ip);
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);
  db.prepare('INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), createdAt.toISOString(), expiresAt.toISOString());
  res.setHeader('Set-Cookie', sessionCookie(token, 12 * 60 * 60));
  res.json({ username: account.username });
});
app.get('/api/auth/me', requireAdmin, (req, res) => res.json({ username: req.adminSession.account.username }));
app.post('/api/auth/logout', (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const session = sessionFor(req);
  if (session) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(session.tokenHash);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.sendStatus(204);
});
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  res.json({ sections: ['Каталог', 'Заявки', 'Услуги', 'Отзывы', 'Работы', 'Контакты'] });
});
const contentTypes = new Set(['products','categories','tags','specifications','services','reviews','works','contacts']);
function validPayload(type,payload){
  if(type==='products'&&payload.variants!==undefined){if(!Array.isArray(payload.variants))return false;const seen=new Set();for(const v of payload.variants){if(!v||typeof v.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)||seen.has(v.slug)||!Number.isInteger(v.priceRub)||v.priceRub<0)return false;seen.add(v.slug);}}
  if(type==='reviews'&&(!payload.authorName||!payload.text))return false;
  if(type==='categories'&&payload.parentId!=null&&!Number.isInteger(payload.parentId))return false;
  return true;
}
function categoryParentWouldCycle(categoryId, parentId) {
  if (parentId == null) return false;
  const categories = db.prepare("SELECT id,payload_json FROM admin_content WHERE type='categories'").all();
  const parents = new Map(categories.map((row) => [Number(row.id), JSON.parse(row.payload_json).parentId == null ? null : Number(JSON.parse(row.payload_json).parentId)]));
  const visited = new Set([Number(categoryId)]);
  let current = Number(parentId);
  while (current != null) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = parents.get(current) ?? null;
  }
  return false;
}
function validCategoryParent(categoryId, parentId) {
  if (parentId == null) return true;
  if (!Number.isInteger(parentId) || !db.prepare("SELECT id FROM admin_content WHERE id=? AND type='categories'").get(parentId)) return false;
  return categoryId == null || !categoryParentWouldCycle(categoryId, parentId);
}
const originGuard = (req,res,next) => isAllowedOrigin(req.headers.origin) ? next() : res.sendStatus(403);
app.get('/api/admin/content/:type', requireAdmin, (req,res) => {
  if (!contentTypes.has(req.params.type)) return res.sendStatus(404);
  const rows=db.prepare('SELECT * FROM admin_content WHERE type=? ORDER BY sort_order,id').all(req.params.type);
  res.json(rows.map(r=>({...r,published:Boolean(r.published),payload:JSON.parse(r.payload_json)})));
});
app.post('/api/admin/content/:type', originGuard, requireAdmin, (req,res) => {
  const {type}=req.params,{slug,title,payload={},published=false,sortOrder=0}=req.body||{};
  if(!contentTypes.has(type))return res.sendStatus(404);
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||typeof title!=='string'||!title.trim()||typeof payload!=='object'||Array.isArray(payload)||!validPayload(type,payload))return res.status(400).json({error:type==='products'?'Варианты должны иметь уникальный slug и целую цену в рублях.':'Проверьте название, адрес и данные записи.'});
  if(type==='categories'&&!validCategoryParent(null,payload.parentId))return res.status(400).json({error:'Выберите существующую родительскую категорию.'});
  const now=new Date().toISOString();
  try{const result=db.prepare('INSERT INTO admin_content(type,slug,title,payload_json,published,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(type,slug,title.trim(),JSON.stringify(payload),published?1:0,Number(sortOrder)||0,now,now);res.status(201).json({id:Number(result.lastInsertRowid)});}catch(e){res.status(409).json({error:'Такая ссылка уже используется в этом разделе.'});}
});
app.put('/api/admin/content/:type/:id', originGuard, requireAdmin, (req,res)=>{
  const {type,id}=req.params,{slug,title,payload={},published=false,sortOrder=0}=req.body||{};
  if(!contentTypes.has(type))return res.sendStatus(404);
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||typeof title!=='string'||!title.trim()||typeof payload!=='object'||Array.isArray(payload)||!validPayload(type,payload))return res.status(400).json({error:type==='products'?'Варианты должны иметь уникальный slug и целую цену в рублях.':'Проверьте название, адрес и данные записи.'});
  if(type==='categories'&&!validCategoryParent(Number(id),payload.parentId))return res.status(400).json({error:'Выберите существующую категорию и не создавайте вложенность в саму себя или её подразделение.'});
  try{const r=db.prepare('UPDATE admin_content SET slug=?,title=?,payload_json=?,published=?,sort_order=?,updated_at=? WHERE id=? AND type=?').run(slug,title.trim(),JSON.stringify(payload),published?1:0,Number(sortOrder)||0,new Date().toISOString(),Number(id),type);if(!r.changes)return res.sendStatus(404);res.sendStatus(204);}catch(e){res.status(409).json({error:'Такая ссылка уже используется в этом разделе.'});}
});
app.delete('/api/admin/content/:type/:id', originGuard, requireAdmin, (req,res)=>{const {type,id}=req.params;if(!contentTypes.has(type))return res.sendStatus(404);if(type==='categories'){const children=db.prepare("SELECT id,payload_json FROM admin_content WHERE type='categories' AND id<>?").all(Number(id));const products=db.prepare("SELECT id,payload_json FROM admin_content WHERE type='products'").all();if(children.some(x=>JSON.parse(x.payload_json).parentId===Number(id))||products.some(x=>(JSON.parse(x.payload_json).categoryIds||[]).includes(Number(id))))return res.status(409).json({error:'Сначала перенесите товары и подкатегории из этого раздела.'});}const r=db.prepare('DELETE FROM admin_content WHERE id=? AND type=?').run(Number(id),type);return r.changes?res.sendStatus(204):res.sendStatus(404);});
app.post('/api/callback',originGuard,(req,res)=>{const {name,phone}=req.body||{};if(typeof name!=='string'||!name.trim()||name.trim().length>120||typeof phone!=='string'||phone.trim().length<6||phone.trim().length>40)return res.status(400).json({error:'Укажите имя и корректный телефон.'});const now=new Date().toISOString();const r=db.prepare('INSERT INTO callback_requests(name,phone,created_at,updated_at) VALUES(?,?,?,?)').run(name.trim(),phone.trim(),now,now);res.status(201).json({id:Number(r.lastInsertRowid),status:'Новая',notification:'Заявка сохранена. Почтовое уведомление пока не настроено.'});});
function serializePublicProduct(row) {
  const payload=JSON.parse(row.payload_json);
  const variants=(payload.variants||[]).map((variant)=>({
    ...variant,
    characteristics:{...(payload.characteristics||{}),...(variant.characteristics||{})},
    media:variant.media?.length?variant.media:(payload.media||[]),
    href:`/product/${row.slug}/${variant.slug}`
  }));
  return {id:Number(row.id),slug:row.slug,title:row.title,description:payload.description||'',featuredOnHome:payload.featuredOnHome===true,media:payload.media||[],characteristics:payload.characteristics||{},categories:payload.categoryIds||[],tags:payload.tagIds||[],priceFromRub:variants.length?Math.min(...variants.map(v=>v.priceRub)):null,variants,sortOrder:row.sort_order,updatedAt:row.updated_at};
}
app.get('/api/public/:type', (req,res)=>{if(!contentTypes.has(req.params.type))return res.sendStatus(404);const rows=db.prepare('SELECT id,type,slug,title,payload_json,sort_order,updated_at FROM admin_content WHERE type=? AND published=1 ORDER BY sort_order,id').all(req.params.type);res.json(rows.map(r=>req.params.type==='products'?serializePublicProduct(r):({...r,payload:JSON.parse(r.payload_json)})));});
app.get('/api/public/products/:productSlug', (req,res)=>{
  const row=db.prepare("SELECT id,type,slug,title,payload_json,sort_order,updated_at FROM admin_content WHERE type='products' AND slug=? AND published=1").get(req.params.productSlug);
  if(!row)return res.sendStatus(404);
  res.json({product:serializePublicProduct(row)});
});
app.get('/api/public/products/:productSlug/variants/:variantSlug', (req,res)=>{
  const row=db.prepare("SELECT id,type,slug,title,payload_json,sort_order,updated_at FROM admin_content WHERE type='products' AND slug=? AND published=1").get(req.params.productSlug);
  if(!row)return res.sendStatus(404);
  const product=serializePublicProduct(row);
  const variant=product.variants.find((item)=>item.slug===req.params.variantSlug);
  if(!variant)return res.sendStatus(404);
  res.json({product,variant});
});
app.get('/api/admin/requests',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM callback_requests ORDER BY id DESC').all()));
app.put('/api/admin/requests/:id',originGuard,requireAdmin,(req,res)=>{const status=req.body?.status;if(!['Новая','В работе','Обработана'].includes(status))return res.status(400).json({error:'Неизвестный статус.'});const r=db.prepare('UPDATE callback_requests SET status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),Number(req.params.id));return r.changes?res.sendStatus(204):res.sendStatus(404);});
app.post('/api/admin/media',originGuard,requireAdmin,express.raw({type:['image/jpeg','image/png','image/webp','video/mp4','video/webm'],limit:'100mb'}),(req,res)=>{
  const mime=req.headers['content-type'];const b=req.body;if(!Buffer.isBuffer(b)||!b.length)return res.status(400).json({error:'Файл пуст.'});
  const valid=(mime==='image/jpeg'&&b[0]===0xff&&b[1]===0xd8)||(mime==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')||(mime==='video/mp4'&&b.toString('ascii',4,8)==='ftyp')||(mime==='video/webm'&&b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])));
  if(!valid)return res.status(415).json({error:'Тип файла не поддерживается или содержимое не соответствует формату.'});
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[mime];const filename=`${randomBytes(20).toString('hex')}.${ext}`;const dir=resolve(root,'uploads');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,filename),b,{flag:'wx'});let original='Файл';try{original=decodeURIComponent(String(req.headers['x-file-name']||''))||original;}catch{}original=original.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180);const result=db.prepare('INSERT INTO media_files(filename,original_name,mime_type,size,created_at) VALUES(?,?,?,?,?)').run(filename,original,mime,b.length,new Date().toISOString());res.status(201).json({id:Number(result.lastInsertRowid),url:`/media/${filename}`,name:original,type:mime,size:b.length});
});
app.get('/api/admin/media',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT id,filename,original_name AS name,mime_type AS type,size,created_at FROM media_files ORDER BY id DESC').all().map(x=>({...x,url:`/media/${x.filename}`}))));
app.get('/media/:filename',(req,res)=>{if(!/^[a-f0-9]{40}\.(jpg|png|webp|mp4|webm)$/.test(req.params.filename))return res.sendStatus(404);const row=db.prepare('SELECT mime_type FROM media_files WHERE filename=?').get(req.params.filename);if(!row)return res.sendStatus(404);res.type(row.mime_type).sendFile(resolve(root,'uploads',req.params.filename));});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});
const port = Number(process.env.API_PORT || 4000);
app.listen(port, () => console.log(`Express API listening on http://localhost:${port}`));
