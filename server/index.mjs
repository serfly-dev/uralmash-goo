import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync, unlinkSync, renameSync, readdirSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink, writeFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
import bcrypt from 'bcrypt';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
const isProduction = process.env.NODE_ENV === 'production';
const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
const mailEnabled = process.env.MAIL_NOTIFICATIONS_ENABLED === 'true';
const mailEnvNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_TO'];
const providedMailSettings = mailEnvNames.filter((name) => Boolean(process.env[name]?.trim()));
let mailSettings = null;
if (process.env.MAIL_NOTIFICATIONS_ENABLED && !['true', 'false'].includes(process.env.MAIL_NOTIFICATIONS_ENABLED)) {
  console.warn('Mail notifications are disabled: MAIL_NOTIFICATIONS_ENABLED must be true or false.');
} else if (mailEnabled && providedMailSettings.length !== mailEnvNames.length) {
  console.warn('Mail notifications are disabled: SMTP configuration is incomplete.');
} else if (mailEnabled && providedMailSettings.length === mailEnvNames.length) {
  const port = Number(process.env.SMTP_PORT);
  const secureValue = process.env.SMTP_SECURE;
  const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  const configuredOrigin = (() => { try { return new URL(appOrigin); } catch { return null; } })();
  const valid = Number.isInteger(port) && port >= 1 && port <= 65535
    && ['true', 'false'].includes(secureValue)
    && emailPattern.test(process.env.SMTP_FROM) && emailPattern.test(process.env.SMTP_TO)
    && (configuredOrigin?.protocol === 'https:' || (!isProduction && configuredOrigin?.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(configuredOrigin.hostname)))
    && configuredOrigin.origin === appOrigin;
  if (valid) {
    mailSettings = {
      host: process.env.SMTP_HOST,
      port,
      secure: secureValue === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_TO,
      adminUrl: `${configuredOrigin.origin}/admin`,
    };
  } else {
    console.warn('Mail notifications are disabled: SMTP settings or APP_ORIGIN are invalid.');
  }
}
const mailTransport = mailSettings ? nodemailer.createTransport({
  host: mailSettings.host, port: mailSettings.port, secure: mailSettings.secure,
  requireTLS: !mailSettings.secure, auth: mailSettings.auth,
  tls: { rejectUnauthorized: true }, connectionTimeout: 10_000,
  greetingTimeout: 10_000, socketTimeout: 20_000, logger: false, debug: false,
}) : null;
const apiHost = process.env.API_HOST || 'localhost';
function isPrivateApiHost(host) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost') return true;
  if (isIP(value) === 4) {
    const [first, second] = value.split('.').map(Number);
    return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168) || (first === 169 && second === 254);
  }
  if (isIP(value) === 6) return value === '::1' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value);
  return false;
}
if (isProduction && !isPrivateApiHost(apiHost)) {
  throw new Error('API_HOST must be localhost or a private IP in production; place TLS termination in front of the API.');
}
const encryptionKeyHex = process.env.REQUEST_ENCRYPTION_KEY || '';
if (!/^[a-f0-9]{64}$/i.test(encryptionKeyHex)) {
  throw new Error('REQUEST_ENCRYPTION_KEY must be a unique 32-byte key encoded as 64 hexadecimal characters.');
}
const requestEncryptionKey = Buffer.from(encryptionKeyHex, 'hex');
const rateLimitKey = Buffer.from(hkdfSync('sha256', requestEncryptionKey, Buffer.from('uralmash-goo'), Buffer.from('callback-rate-limit'), 32));
const dbPath = resolve(process.env.SQLITE_PATH || `${root}/data/site.sqlite`);
const mediaStorageLimitMb = Number(process.env.MEDIA_STORAGE_LIMIT_MB || 5120);
if (!Number.isSafeInteger(mediaStorageLimitMb) || mediaStorageLimitMb < 1 || !Number.isSafeInteger(mediaStorageLimitMb * 1024 * 1024)) throw new Error('MEDIA_STORAGE_LIMIT_MB must be a positive whole number within the supported range.');
const mediaStorageLimitBytes = mediaStorageLimitMb * 1024 * 1024;
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA secure_delete = ON;
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
    updated_at TEXT NOT NULL,
    encrypted_payload TEXT,
    intent TEXT NOT NULL DEFAULT 'general',
    source_path TEXT NOT NULL DEFAULT '',
    subject_title TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS callback_rate_events (
    ip_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS callback_rate_events_hash_created ON callback_rate_events(ip_hash, created_at);
  CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);
// Preserve existing product values while making their names available in the shared directory.
{
  const known = new Set(db.prepare("SELECT title FROM admin_content WHERE type='specifications'").all().map((row) => row.title));
  const values = new Map();
  for (const row of db.prepare("SELECT payload_json FROM admin_content WHERE type='products'").all()) {
    const product = JSON.parse(row.payload_json);
    for (const characteristics of [product.characteristics, ...(Array.isArray(product.variants) ? product.variants.map((variant) => variant?.characteristics) : [])]) {
      if (!characteristics || typeof characteristics !== 'object' || Array.isArray(characteristics)) continue;
      for (const [title, value] of Object.entries(characteristics)) {
        if (!title.trim() || known.has(title) || value == null || value === '') continue;
        const type = typeof value === 'number' && Number.isFinite(value) ? 'number' : 'text';
        values.set(title, values.has(title) && values.get(title) !== type ? 'text' : type);
      }
    }
  }
  const insert = db.prepare("INSERT OR IGNORE INTO admin_content(type,slug,title,payload_json,published,sort_order,created_at,updated_at) VALUES('specifications',?,?,?,1,0,?,?)");
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [title, valueType] of values) insert.run(`existing-${createHash('sha256').update(title).digest('hex')}`, title, JSON.stringify({ valueType, unit: '', filterMode: 'values' }), now, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (mailEnabled) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS callback_mail_outbox (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES callback_requests(id),
      created_at INTEGER NOT NULL,
      next_attempt_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER,
      delivered_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS callback_mail_outbox_due ON callback_mail_outbox(delivered_at, next_attempt_at, lease_until);
  `);
}
function encryptRequestPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', requestEncryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
function decryptRequestPayload(value) {
  if (typeof value !== 'string') throw new Error('Encrypted request payload is missing.');
  const [version, encodedIv, encodedTag, encodedData, extra] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedData || extra !== undefined) throw new Error('Encrypted request payload has an invalid format.');
  const iv = Buffer.from(encodedIv, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Encrypted request payload has invalid parameters.');
  const decipher = createDecipheriv('aes-256-gcm', requestEncryptionKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encodedData, 'base64url')), decipher.final()]).toString('utf8');
  const payload = JSON.parse(plaintext);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Decrypted request payload has an invalid shape.');
  return payload;
}
const callbackColumns = new Set(db.prepare('PRAGMA table_info(callback_requests)').all().map((column) => column.name));
for (const [column, definition] of [
  ['encrypted_payload', 'TEXT'],
  ['intent', "TEXT NOT NULL DEFAULT 'general'"],
  ['source_path', "TEXT NOT NULL DEFAULT ''"],
  ['subject_title', "TEXT NOT NULL DEFAULT ''"],
]) {
  if (!callbackColumns.has(column)) db.exec(`ALTER TABLE callback_requests ADD COLUMN ${column} ${definition}`);
}
db.exec('BEGIN IMMEDIATE');
try {
  const legacyRequests = db.prepare("SELECT id, name, phone FROM callback_requests WHERE encrypted_payload IS NULL AND (length(name) > 0 OR length(phone) > 0)").all();
  const encryptLegacy = db.prepare("UPDATE callback_requests SET encrypted_payload=?, name='', phone='' WHERE id=? AND encrypted_payload IS NULL");
  for (const request of legacyRequests) {
    encryptLegacy.run(encryptRequestPayload({ name: request.name, phone: request.phone, message: '' }), request.id);
  }
  db.prepare("UPDATE callback_requests SET name='', phone='' WHERE encrypted_payload IS NOT NULL AND (length(name) > 0 OR length(phone) > 0)").run();
  const remainingPlaintext = db.prepare("SELECT COUNT(*) AS count FROM callback_requests WHERE length(name) > 0 OR length(phone) > 0").get().count;
  if (remainingPlaintext) throw new Error('Callback request migration left plaintext contact data in the database.');
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const hasAdmin = Boolean(db.prepare('SELECT id FROM admin_account WHERE id = 1').get());
if (username && password && !isProduction && password.length < 6) {
  throw new Error('ADMIN_PASSWORD must contain at least 6 characters in development.');
}
if (!hasAdmin && username && password && isProduction && password.length < 12) {
  throw new Error('ADMIN_PASSWORD must contain at least 12 characters in production.');
}
if (username && password && !hasAdmin) {
  if (!/^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:,.?]+$/.test(password)) throw new Error('ADMIN_PASSWORD contains unsupported characters.');
  const salt = 'bcrypt-sha256';
  const passwordHash = bcrypt.hashSync(createHash('sha256').update(password).digest('base64'), 12);
  db.prepare('INSERT INTO admin_account (id, username, password_hash, password_salt, created_at) VALUES (1, ?, ?, ?, ?)')
    .run(username, passwordHash, salt, new Date().toISOString());
}
db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
const uploadsPath = resolve(root, 'uploads');
if (existsSync(uploadsPath)) {
  for (const filename of readdirSync(uploadsPath).filter((item) => item.endsWith('.deleting'))) {
    const storedFilename = filename.slice(0, -'.deleting'.length);
    if (!/^[a-f0-9]{40}\.(jpg|png|webp|mp4|webm)$/.test(storedFilename)) continue;
    const tombstonePath = resolve(uploadsPath, filename);
    const originalPath = resolve(uploadsPath, storedFilename);
    const row = db.prepare('SELECT id FROM media_files WHERE filename=?').get(storedFilename);
    try {
      if (row && !existsSync(originalPath)) renameSync(tombstonePath, originalPath);
      else unlinkSync(tombstonePath);
    } catch {}
  }
}
const sessionCleanupTimer = setInterval(() => {
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
}, 60 * 60 * 1000);
sessionCleanupTimer.unref();
const app = express();
app.disable('x-powered-by');
const trustedProxyAddresses = (process.env.API_TRUSTED_PROXIES || '').split(',').map((value) => value.trim()).filter(Boolean);
if (trustedProxyAddresses.includes('*')) throw new Error('API_TRUSTED_PROXIES must list exact proxy IPs or CIDRs; wildcard trust is unsafe.');
function isTrustedProxyAddress(value) {
  const [address, prefix, extra] = value.split('/');
  const family = isIP(address);
  if (!family || extra !== undefined) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128);
}
if (trustedProxyAddresses.some((address) => !isTrustedProxyAddress(address))) {
  throw new Error('API_TRUSTED_PROXIES accepts only IP addresses or CIDRs.');
}
if (trustedProxyAddresses.length) app.set('trust proxy', trustedProxyAddresses);
if (isProduction) {
  let configuredAppOrigin;
  try { configuredAppOrigin = new URL(appOrigin); } catch { throw new Error('APP_ORIGIN must be a valid HTTPS origin in production.'); }
  if (configuredAppOrigin.protocol !== 'https:' || configuredAppOrigin.origin !== appOrigin) {
    throw new Error('APP_ORIGIN must be an HTTPS origin without a path in production.');
  }
  const publicApiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApiOrigin) {
    let configuredApiOrigin;
    try { configuredApiOrigin = new URL(publicApiOrigin); } catch { throw new Error('NEXT_PUBLIC_API_URL must be a valid HTTPS origin.'); }
    if (configuredApiOrigin.protocol !== 'https:' || configuredApiOrigin.username || configuredApiOrigin.password
      || configuredApiOrigin.pathname !== '/' || configuredApiOrigin.search || configuredApiOrigin.hash) {
      throw new Error('NEXT_PUBLIC_API_URL must be an HTTPS origin without a path in production.');
    }
  }
}
function isAllowedOrigin(origin) {
  return Boolean(origin) && origin === appOrigin;
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
  res.setHeader('Cache-Control', req.path.startsWith('/media/') ? 'public, max-age=31536000, immutable' : 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');
    return res.sendStatus(allowedOrigin ? 204 : 403);
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
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
const loginChallenges = new Map();
let activePasswordChecks = 0;
let activeImageProcesses = 0;
const loginWindowMs = 15 * 60 * 1000;
const maxTrackedLoginIps = 10_000;
function pruneLoginAttempts(now) {
  for (const [ip, state] of attempts) {
    if (now - state.start >= loginWindowMs) attempts.delete(ip);
  }
}
const derivePassword = (password, salt) => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
});
// Pre-hashing keeps bcrypt's 72-byte input limit from truncating long or Unicode passwords.
const bcryptInput = (password) => createHash('sha256').update(password).digest('base64');
const hashPassword = (password) => bcrypt.hash(bcryptInput(password), 12);
const verifyPassword = async (password, account) => {
  if (account.password_salt === 'bcrypt-sha256') return bcrypt.compare(bcryptInput(password), account.password_hash);
  const attempted = await derivePassword(password, account.password_salt);
  const stored = Buffer.from(account.password_hash, 'hex');
  return stored.length === attempted.length && timingSafeEqual(attempted, stored);
};
app.post('/api/auth/login', async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const ip = req.ip;
  const now = Date.now();
  pruneLoginAttempts(now);
  const knownState = attempts.get(ip);
  if (!knownState && attempts.size >= maxTrackedLoginIps) return res.status(503).json({ error: 'Сервер занят. Повторите попытку позже.' });
  const state = knownState || { count: 0, start: now };
  if (state.count >= 5) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((state.start + loginWindowMs - now) / 1000))));
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' });
  }
  // Reserve the attempt before asynchronous password hashing so parallel requests share the same limit.
  state.count += 1;
  attempts.set(ip, state);
  const { username: enteredUsername, password: enteredPassword } = req.body || {};
  const account = db.prepare('SELECT username, password_hash, password_salt FROM admin_account WHERE id = 1').get();
  let valid = false;
  if (account && typeof enteredUsername === 'string' && typeof enteredPassword === 'string' && enteredPassword.length <= 256) {
    if (activePasswordChecks >= 4) return res.status(503).json({ error: 'Сервер занят. Повторите попытку позже.' });
    activePasswordChecks += 1;
    try {
      valid = await verifyPassword(enteredPassword, account) && enteredUsername === account.username;
      if (valid && account.password_salt !== 'bcrypt-sha256') {
        const newHash = await hashPassword(enteredPassword);
        const result = db.prepare("UPDATE admin_account SET password_hash=?, password_salt='bcrypt-sha256' WHERE id=1 AND password_hash=? AND password_salt=?")
          .run(newHash, account.password_hash, account.password_salt);
        if (!result.changes) valid = false;
        else { account.password_hash = newHash; account.password_salt = 'bcrypt-sha256'; }
      }
      if (valid) valid = Boolean(db.prepare('SELECT 1 FROM admin_account WHERE id=1 AND username=? AND password_hash=? AND password_salt=?')
        .get(account.username, account.password_hash, account.password_salt));
    } catch {
      return res.status(500).json({ error: 'Не удалось проверить пароль.' });
    } finally {
      activePasswordChecks -= 1;
    }
  }
  if (!valid) {
    return res.status(401).json({ error: 'Неверный логин или пароль.' });
  }
  if (!mailTransport) return res.status(503).json({ error: 'Почта не настроена. Вход временно недоступен.' });
  for (const [key, pending] of loginChallenges) if (pending.expires <= now) loginChallenges.delete(key);
  if (loginChallenges.size >= maxTrackedLoginIps) return res.status(503).json({ error: 'Сервер занят. Повторите попытку позже.' });
  const challenge = randomBytes(32).toString('base64url');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const pending = { hash: createHmac('sha256', rateLimitKey).update(challenge + code).digest(), expires: Date.now() + 10 * 60_000, attempts: 0, username: account.username, passwordHash: account.password_hash, passwordSalt: account.password_salt };
  loginChallenges.set(hashToken(challenge), pending);
  try {
    await mailTransport.sendMail({ from: mailSettings.from, to: mailSettings.to, subject: 'Код для входа в админ-панель', text: `Код для входа в админ-панель: ${code}\nКод действует 10 минут. Если вы не пытались войти, проигнорируйте письмо.` });
    return res.json({ challenge });
  } catch {
    loginChallenges.delete(hashToken(challenge));
    return res.status(503).json({ error: 'Не удалось отправить код. Попробуйте позже.' });
  }
});
app.post('/api/auth/login/verify', (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const { challenge, code } = req.body || {};
  if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return res.status(403).json({ error: 'Код недействителен или истёк. Войдите заново.' });
  const key = hashToken(challenge);
  const pending = loginChallenges.get(key);
  if (!pending || pending.expires <= Date.now()) { loginChallenges.delete(key); return res.status(403).json({ error: 'Код недействителен или истёк. Войдите заново.' }); }
  pending.attempts++;
  const validCode = typeof code === 'string' && /^\d{6}$/.test(code) && timingSafeEqual(createHmac('sha256', rateLimitKey).update(challenge + code).digest(), pending.hash);
  if (!validCode) {
    if (pending.attempts >= 5) loginChallenges.delete(key);
    return res.status(400).json({ error: 'Неверный код. Проверьте письмо.' });
  }
  loginChallenges.delete(key);
  const account = db.prepare('SELECT username FROM admin_account WHERE id=1 AND username=? AND password_hash=? AND password_salt=?').get(pending.username, pending.passwordHash, pending.passwordSalt);
  if (!account) return res.status(403).json({ error: 'Данные для входа изменились. Войдите заново.' });
  attempts.delete(req.ip);
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);
  db.prepare('INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), createdAt.toISOString(), expiresAt.toISOString());
  res.setHeader('Set-Cookie', sessionCookie(token, 12 * 60 * 60));
  res.json({ username: account.username });
});
// Short-lived challenges are bound to authenticated sessions and never stored in plaintext.
const passwordChallenges = new Map();
let lastPasswordCodeRequest = 0;
app.post('/api/auth/password/code', requireAdmin, async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const purpose = req.body?.purpose ?? 'password';
  if (!['password', 'username'].includes(purpose)) return res.status(400).json({ error: 'Неизвестная операция.' });
  if (!mailTransport) return res.status(503).json({ error: 'Почта не настроена. Обратитесь к администратору сервера.' });
  const now = Date.now();
  if (now - lastPasswordCodeRequest < 60_000) return res.status(429).json({ error: 'Повторно запросить код можно через минуту.' });
  lastPasswordCodeRequest = now;
  for (const [session, pending] of passwordChallenges) if (pending.expires <= now) passwordChallenges.delete(session);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = { session: req.adminSession.tokenHash, purpose, hash: createHmac('sha256', rateLimitKey).update(code).digest(), expires: now + 10 * 60_000, attempts: 0, verified: false };
  passwordChallenges.set(challenge.session, challenge);
  try {
    const label = purpose === 'username' ? 'логина' : 'пароля';
    await mailTransport.sendMail({ from: mailSettings.from, to: mailSettings.to, subject: `Код для смены ${label}`, text: `Код для смены ${label} администратора: ${code}\nКод действует 10 минут. Если вы не запрашивали смену ${label}, проигнорируйте письмо.` });
    if (passwordChallenges.get(challenge.session) !== challenge) return res.status(409).json({ error: 'Запрос устарел. Запросите код снова.' });
    res.json({ ok: true });
  } catch {
    if (passwordChallenges.get(challenge.session) === challenge) passwordChallenges.delete(challenge.session);
    res.status(503).json({ error: 'Не удалось отправить письмо. Проверьте настройки почты и попробуйте позже.' });
  }
});
app.post('/api/auth/password/verify', requireAdmin, (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const challenge = passwordChallenges.get(req.adminSession.tokenHash);
  if (!challenge || challenge.session !== req.adminSession.tokenHash || challenge.expires <= Date.now() || challenge.verified) return res.status(403).json({ error: 'Код недействителен или истёк. Запросите новый.' });
  if (typeof req.body?.code !== 'string' || !/^\d{6}$/.test(req.body.code)) return res.status(400).json({ error: 'Введите шестизначный код.' });
  challenge.attempts++;
  const hash = createHmac('sha256', rateLimitKey).update(req.body.code).digest();
  if (!timingSafeEqual(hash, challenge.hash)) {
    if (challenge.attempts >= 5) passwordChallenges.delete(challenge.session);
    return res.status(400).json({ error: 'Неверный код.' });
  }
  challenge.verified = true;
  res.json({ ok: true });
});
app.post('/api/auth/password/change', requireAdmin, async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const challenge = passwordChallenges.get(req.adminSession.tokenHash);
  if (!challenge || challenge.purpose !== 'password' || challenge.session !== req.adminSession.tokenHash || !challenge.verified || challenge.expires <= Date.now()) return res.status(403).json({ error: 'Подтвердите смену пароля кодом из письма.' });
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || currentPassword.length > 256 || typeof newPassword !== 'string' || !/^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:,.?]{12,256}$/.test(newPassword)) return res.status(400).json({ error: 'Пароль должен содержать 12–256 символов: латинские буквы, цифры и знаки !@#$%^&*()_+-=[]{};:,.?' });
  if (challenge.checking) return res.status(429).json({ error: 'Дождитесь завершения проверки.' });
  if (activePasswordChecks >= 4) return res.status(503).json({ error: 'Сервер занят. Повторите попытку позже.' });
  challenge.checking = true;
  challenge.passwordAttempts = (challenge.passwordAttempts || 0) + 1;
  activePasswordChecks++;
  try {
    const account = db.prepare('SELECT password_hash, password_salt FROM admin_account WHERE id=1').get();
    const validPassword = await verifyPassword(currentPassword, account);
    if (passwordChallenges.get(challenge.session) !== challenge || challenge.expires <= Date.now() || !sessionFor(req)) return res.status(403).json({ error: 'Подтверждение истекло. Запросите новый код.' });
    if (!validPassword) {
      if (challenge.passwordAttempts >= 5) passwordChallenges.delete(challenge.session);
      return res.status(401).json({ error: 'Неверный текущий пароль.' });
    }
    const newHash = await hashPassword(newPassword);
    if (passwordChallenges.get(challenge.session) !== challenge || challenge.expires <= Date.now() || !sessionFor(req)) return res.status(403).json({ error: 'Подтверждение истекло. Запросите новый код.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare("UPDATE admin_account SET password_hash=?, password_salt='bcrypt-sha256' WHERE id=1 AND password_hash=? AND password_salt=?").run(newHash, account.password_hash, account.password_salt);
      if (!result.changes) throw new Error('Password changed concurrently.');
      db.prepare('DELETE FROM admin_sessions').run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    passwordChallenges.clear();
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Не удалось изменить пароль.' }); }
  finally { challenge.checking = false; activePasswordChecks--; }
});
app.post('/api/auth/username/change', requireAdmin, async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.sendStatus(403);
  const challenge = passwordChallenges.get(req.adminSession.tokenHash);
  if (!challenge || challenge.purpose !== 'username' || !challenge.verified || challenge.expires <= Date.now()) return res.status(403).json({ error: 'Подтвердите смену логина кодом из письма.' });
  const { currentPassword, newUsername } = req.body || {};
  if (typeof currentPassword !== 'string' || currentPassword.length > 256 || typeof newUsername !== 'string' || !/^[A-Za-z0-9._-]{3,64}$/.test(newUsername)) return res.status(400).json({ error: 'Логин должен содержать 3–64 латинские буквы, цифры или символы . _ -' });
  if (challenge.checking) return res.status(429).json({ error: 'Дождитесь завершения проверки.' });
  if (activePasswordChecks >= 4) return res.status(503).json({ error: 'Сервер занят. Повторите попытку позже.' });
  challenge.checking = true;
  challenge.passwordAttempts = (challenge.passwordAttempts || 0) + 1;
  activePasswordChecks++;
  try {
    const account = db.prepare('SELECT username, password_hash, password_salt FROM admin_account WHERE id=1').get();
    const validPassword = await verifyPassword(currentPassword, account);
    if (passwordChallenges.get(challenge.session) !== challenge || challenge.expires <= Date.now() || !sessionFor(req)) return res.status(403).json({ error: 'Подтверждение истекло. Запросите новый код.' });
    if (!validPassword) {
      if (challenge.passwordAttempts >= 5) passwordChallenges.delete(challenge.session);
      return res.status(401).json({ error: 'Неверный текущий пароль.' });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('UPDATE admin_account SET username=? WHERE id=1 AND username=? AND password_hash=? AND password_salt=?').run(newUsername, account.username, account.password_hash, account.password_salt);
      if (!result.changes) throw new Error('Account changed concurrently.');
      db.prepare('DELETE FROM admin_sessions').run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    passwordChallenges.clear();
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Не удалось изменить логин.' }); }
  finally { challenge.checking = false; activePasswordChecks--; }
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
  if(type==='products' && payload.priceIsFrom !== undefined && typeof payload.priceIsFrom !== 'boolean') return false;
  if(type==='products' && payload.priceRub != null && (!Number.isSafeInteger(payload.priceRub) || payload.priceRub < 0)) return false;
  if(type==='specifications' && (!['text','number','range'].includes(payload.valueType || 'text') || !['values','range'].includes(payload.filterMode || 'values') || (payload.unit !== undefined && typeof payload.unit !== 'string'))) return false;
  if(type==='products') {
    for(const characteristics of [payload.characteristics, ...(Array.isArray(payload.variants) ? payload.variants.map((variant) => variant?.characteristics) : [])]) {
      if(characteristics == null) continue;
      if(typeof characteristics !== 'object' || Array.isArray(characteristics)) return false;
      for(const value of Object.values(characteristics)) if(value && typeof value === 'object' && (Array.isArray(value) || !Number.isFinite(value.min) || !Number.isFinite(value.max) || value.min > value.max)) return false;
    }
  }
  if(type==='contacts'){
    for(const [key,max] of [['legalName',300],['inn',10],['ogrn',13],['legalAddress',500]]){
      if(payload[key]!==undefined && (typeof payload[key]!=='string' || payload[key].length>max))return false;
    }
    if(payload.inn?.trim() && !/^\d{10}$/.test(payload.inn))return false;
    if(payload.ogrn?.trim() && !/^\d{13}$/.test(payload.ogrn))return false;
  }
  if(type==='products'&&payload.variants!==undefined){if(!Array.isArray(payload.variants))return false;const seen=new Set();for(const v of payload.variants){if(!v||typeof v.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)||seen.has(v.slug)||!Number.isInteger(v.priceRub)||v.priceRub<0)return false;seen.add(v.slug);}}
  if(type==='reviews'&&(!payload.authorName||!payload.text))return false;
  if(type==='categories'&&payload.parentId!=null&&!Number.isInteger(payload.parentId))return false;
  return true;
}
function specificationInUse(title) {
  return db.prepare("SELECT payload_json FROM admin_content WHERE type='products'").all().some((row) => {
    const product = JSON.parse(row.payload_json);
    return [product.characteristics, ...(Array.isArray(product.variants) ? product.variants.map((variant) => variant?.characteristics) : [])].some((values) => values && Object.hasOwn(values, title));
  });
}
function duplicateSpecification(title, id = 0) {
  return db.prepare("SELECT id,title FROM admin_content WHERE type='specifications' AND id<>?").all(id).some((row) => row.title.toLocaleLowerCase('ru') === title.trim().toLocaleLowerCase('ru'));
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

app.get('/api/admin/privacy-policy', requireAdmin, (_req, res) => {
  const row = db.prepare("SELECT payload_json FROM admin_content WHERE type='privacy-policy' AND slug='privacy-policy'").get();
  res.json({ text: row ? JSON.parse(row.payload_json).text : '' });
});
app.put('/api/admin/privacy-policy', originGuard, requireAdmin, (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Укажите текст политики.' });
  const now = new Date().toISOString();
  db.prepare("INSERT INTO admin_content(type,slug,title,payload_json,published,sort_order,created_at,updated_at) VALUES('privacy-policy','privacy-policy','Политика обработки персональных данных',?,1,0,?,?) ON CONFLICT(type,slug) DO UPDATE SET payload_json=excluded.payload_json,published=1,updated_at=excluded.updated_at").run(JSON.stringify({ text: text.trim() }), now, now);
  res.sendStatus(204);
});
app.get('/api/public/privacy-policy', (_req, res) => {
  const row = db.prepare("SELECT payload_json FROM admin_content WHERE type='privacy-policy' AND slug='privacy-policy' AND published=1").get();
  res.json({ text: row ? JSON.parse(row.payload_json).text : '' });
});

function normalizeClientIp(value) {
  let ip = String(value || '').trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  const family = isIP(ip);
  if (!family) throw new Error('Could not determine a valid client IP address.');
  if (family === 6) return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  return ip;
}
function reserveCallbackRateSlot(req) {
  const ipHash = createHmac('sha256', rateLimitKey).update(normalizeClientIp(req.ip || req.socket.remoteAddress)).digest('hex');
  const now = Date.now();
  const cutoff = now - 60_000;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM callback_rate_events WHERE created_at <= ?').run(cutoff);
    const recent = db.prepare('SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM callback_rate_events WHERE ip_hash=? AND created_at>?').get(ipHash, cutoff);
    if (recent.count >= 2) {
      db.exec('COMMIT');
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((Number(recent.oldest) + 60_000 - now) / 1000)) };
    }
    db.prepare('INSERT INTO callback_rate_events(ip_hash, created_at) VALUES(?, ?)').run(ipHash, now);
    db.exec('COMMIT');
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
function cleanSourcePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.length > 500 || /[\\\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const parsed = new URL(value, 'https://request.invalid');
    return parsed.origin === 'https://request.invalid' ? parsed.pathname.slice(0, 400) : '';
  } catch {
    return '';
  }
}
function resolveRequestSubject(intent, body) {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if ((intent === 'repair' || intent === 'project') && body.serviceSlug !== undefined) {
    if (body.serviceSlug === '') return null;
    if (typeof body.serviceSlug !== 'string' || !slugPattern.test(body.serviceSlug)) return null;
    const service = db.prepare("SELECT title FROM admin_content WHERE type='services' AND slug=? AND published=1").get(body.serviceSlug);
    return service ? service.title.slice(0, 300) : null;
  }
  if (intent === 'purchase' && (body.productSlug !== undefined || body.variantSlug !== undefined)) {
    if (typeof body.productSlug !== 'string' || !slugPattern.test(body.productSlug)
      || typeof body.variantSlug !== 'string' || !slugPattern.test(body.variantSlug)) return null;
    const product = db.prepare("SELECT title, payload_json FROM admin_content WHERE type='products' AND slug=? AND published=1").get(body.productSlug);
    if (!product) return null;
    const variants = JSON.parse(product.payload_json).variants || [];
    if (!variants.length && body.variantSlug === 'default') return product.title.slice(0, 400);
    const variant = variants.find((item) => item.slug === body.variantSlug);
    if (!variant) return null;
    const variantName = typeof variant.name === 'string' && variant.name.trim() ? variant.name.trim() : variant.slug;
    return `${product.title} — ${variantName}`.slice(0, 400);
  }
  if ((intent !== 'purchase' && (body.productSlug !== undefined || body.variantSlug !== undefined))
    || (!['repair', 'project'].includes(intent) && body.serviceSlug !== undefined)) return null;
  return '';
}
function normalizeRequestName(value) {
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}
function normalizeRequestMessage(value) {
  return value.normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}
app.get('/api/admin/content/:type', requireAdmin, (req,res) => {
  if (!contentTypes.has(req.params.type)) return res.sendStatus(404);
  const rows=db.prepare('SELECT * FROM admin_content WHERE type=? ORDER BY sort_order,id').all(req.params.type);
  res.json(rows.map(r=>({...r,published:Boolean(r.published),payload:JSON.parse(r.payload_json)})));
});
app.post('/api/admin/content/:type', originGuard, requireAdmin, (req,res) => {
  const {type}=req.params,{slug,title,payload={},published=false,sortOrder=0}=req.body||{};
  if(!contentTypes.has(type))return res.sendStatus(404);
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||typeof title!=='string'||!title.trim()||typeof payload!=='object'||Array.isArray(payload)||!validPayload(type,payload))return res.status(400).json({error:type==='products'?'Варианты должны иметь уникальный slug и целую цену в рублях.':'Проверьте название, адрес и данные записи.'});
  if(type==='specifications' && duplicateSpecification(title)) return res.status(409).json({error:'Характеристика с таким названием уже существует.'});
  if(type==='categories'&&!validCategoryParent(null,payload.parentId))return res.status(400).json({error:'Выберите существующую родительскую категорию.'});
  const now=new Date().toISOString();
  try{const result=db.prepare('INSERT INTO admin_content(type,slug,title,payload_json,published,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(type,slug,title.trim(),JSON.stringify(payload),published?1:0,Number(sortOrder)||0,now,now);res.status(201).json({id:Number(result.lastInsertRowid)});}catch(e){res.status(409).json({error:'Такая ссылка уже используется в этом разделе.'});}
});
app.put('/api/admin/content/:type/:id', originGuard, requireAdmin, (req,res)=>{
  const {type,id}=req.params,{slug,title,payload={},published=false,sortOrder=0}=req.body||{};
  if(!contentTypes.has(type))return res.sendStatus(404);
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||typeof title!=='string'||!title.trim()||typeof payload!=='object'||Array.isArray(payload)||!validPayload(type,payload))return res.status(400).json({error:type==='products'?'Варианты должны иметь уникальный slug и целую цену в рублях.':'Проверьте название, адрес и данные записи.'});
  if(type==='specifications') {
    if(duplicateSpecification(title,Number(id))) return res.status(409).json({error:'Характеристика с таким названием уже существует.'});
    const previous=db.prepare("SELECT title,payload_json FROM admin_content WHERE type='specifications' AND id=?").get(Number(id));
    if(previous && (previous.title!==title.trim() || (JSON.parse(previous.payload_json).valueType || 'text')!==(payload.valueType || 'text')) && specificationInUse(previous.title)) return res.status(409).json({error:'Сначала удалите эту характеристику из товаров, чтобы изменить её название или тип.'});
  }
  if(type==='categories'&&!validCategoryParent(Number(id),payload.parentId))return res.status(400).json({error:'Выберите существующую категорию и не создавайте вложенность в саму себя или её подразделение.'});
  try{const r=db.prepare('UPDATE admin_content SET slug=?,title=?,payload_json=?,published=?,sort_order=?,updated_at=? WHERE id=? AND type=?').run(slug,title.trim(),JSON.stringify(payload),published?1:0,Number(sortOrder)||0,new Date().toISOString(),Number(id),type);if(!r.changes)return res.sendStatus(404);res.sendStatus(204);}catch(e){res.status(409).json({error:'Такая ссылка уже используется в этом разделе.'});}
});
app.delete('/api/admin/content/:type/:id', originGuard, requireAdmin, (req,res)=>{const {type,id}=req.params;if(!contentTypes.has(type))return res.sendStatus(404);if(type==='specifications'){const row=db.prepare("SELECT title FROM admin_content WHERE type='specifications' AND id=?").get(Number(id));if(row && specificationInUse(row.title))return res.status(409).json({error:'Сначала удалите эту характеристику из товаров.'});}if(type==='categories'){const children=db.prepare("SELECT id,payload_json FROM admin_content WHERE type='categories' AND id<>?").all(Number(id));const products=db.prepare("SELECT id,payload_json FROM admin_content WHERE type='products'").all();if(children.some(x=>JSON.parse(x.payload_json).parentId===Number(id))||products.some(x=>(JSON.parse(x.payload_json).categoryIds||[]).includes(Number(id))))return res.status(409).json({error:'Сначала перенесите товары и подкатегории из этого раздела.'});}const r=db.prepare('DELETE FROM admin_content WHERE id=? AND type=?').run(Number(id),type);return r.changes?res.sendStatus(204):res.sendStatus(404);});
app.post('/api/callback', originGuard, (req, res) => {
  let rate;
  try { rate = reserveCallbackRateSlot(req); } catch { return res.status(503).json({ error: 'Не удалось принять заявку. Попробуйте позже.' }); }
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'От этого адреса уже отправлены две заявки за минуту. Попробуйте позже.' });
  }
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Проверьте заполнение формы.' });
  if (typeof body.website === 'string' && body.website.trim()) return res.status(202).json({ accepted: true });
  if (typeof body.name !== 'string' || typeof body.phone !== 'string') return res.status(400).json({ error: 'Укажите имя и телефон.' });
  const name = normalizeRequestName(body.name);
  const phone = body.phone.trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (!name || name.length > 120) return res.status(400).json({ error: 'Укажите имя длиной до 120 символов.' });
  if (!/^[+\d][\d\s().-]{5,39}$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return res.status(400).json({ error: 'Укажите телефон с 7–15 цифрами.' });
  }
  if (body.consent !== true) return res.status(400).json({ error: 'Подтвердите согласие на обработку данных.' });
  const intent = body.intent === undefined ? 'general' : body.intent;
  if (!['repair', 'project', 'purchase', 'general'].includes(intent)) return res.status(400).json({ error: 'Неизвестный тип заявки.' });
  if (body.message !== undefined && typeof body.message !== 'string') return res.status(400).json({ error: 'Проверьте текст комментария.' });
  const message = body.message === undefined ? '' : normalizeRequestMessage(body.message);
  if (message.length > 2000) return res.status(400).json({ error: 'Комментарий должен быть короче 2000 символов.' });
  const subjectTitle = resolveRequestSubject(intent, body);
  if (subjectTitle === null) return res.status(400).json({ error: 'Не удалось проверить выбранный товар или услугу. Обновите страницу и попробуйте снова.' });
  const now = new Date().toISOString();
  const encryptedPayload = encryptRequestPayload({ name, phone, message });
  let result;
  db.exec('BEGIN IMMEDIATE');
  try {
    result = db.prepare("INSERT INTO callback_requests(name, phone, encrypted_payload, intent, source_path, subject_title, created_at, updated_at) VALUES('', '', ?, ?, ?, ?, ?, ?)")
      .run(encryptedPayload, intent, cleanSourcePath(body.sourcePath), subjectTitle, now, now);
    if (mailEnabled) {
      const timestamp = Date.now();
      db.prepare('INSERT INTO callback_mail_outbox(request_id, created_at, next_attempt_at) VALUES(?, ?, ?)')
        .run(Number(result.lastInsertRowid), timestamp, timestamp);
    }
    db.exec('COMMIT');
  } catch {
    try { db.exec('ROLLBACK'); } catch {}
    return res.status(503).json({ error: 'Не удалось принять заявку. Попробуйте позже.' });
  }
  return res.status(201).json({ id: Number(result.lastInsertRowid), status: 'Новая' });
});
function serializePublicProduct(row) {
  const payload=JSON.parse(row.payload_json);
  const variants=(payload.variants||[]).map((variant)=>({
    ...variant,
    characteristics:{...(payload.characteristics||{}),...(variant.characteristics||{})},
    media:variant.media?.length?variant.media:(payload.media||[]),
    href:`/catalog/product/${row.slug}/${variant.slug}`
  }));
  return {id:Number(row.id),slug:row.slug,title:row.title,description:payload.description||'',featuredOnHome:payload.featuredOnHome===true,media:payload.media||[],characteristics:payload.characteristics||{},categories:payload.categoryIds||[],tags:payload.tagIds||[],priceIsFrom:variants.length > 0 || payload.priceIsFrom !== false,priceFromRub:variants.length?Math.min(...variants.map(v=>v.priceRub)):(payload.priceRub ?? null),variants,sortOrder:row.sort_order,updatedAt:row.updated_at};
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
  const variant=product.variants.find((item)=>item.slug===req.params.variantSlug)
    || (!product.variants.length && req.params.variantSlug==='default' ? {slug:'default', priceRub:product.priceFromRub, characteristics:product.characteristics, media:product.media} : null);
  if(!variant)return res.sendStatus(404);
  res.json({product,variant});
});
app.get('/api/admin/requests', requireAdmin, (_req, res) => {
  try {
    const rows = db.prepare('SELECT id, status, created_at, updated_at, encrypted_payload, intent, source_path, subject_title FROM callback_requests ORDER BY id DESC').all();
    const requests = rows.map((row) => {
      const payload = row.encrypted_payload ? decryptRequestPayload(row.encrypted_payload) : { name: '', phone: '', message: '' };
      if (typeof payload.name !== 'string' || typeof payload.phone !== 'string' || typeof payload.message !== 'string') {
        throw new Error('Decrypted request payload has invalid fields.');
      }
      return {
        id: Number(row.id),
        name: payload.name,
        phone: payload.phone,
        message: payload.message,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        intent: row.intent,
        source_path: row.source_path,
        subject_title: row.subject_title,
      };
    });
    return res.json(requests);
  } catch {
    return res.status(500).json({ error: 'Не удалось открыть заявки.' });
  }
});
app.get('/api/admin/mail-status', requireAdmin, (_req, res) => {
  if (!mailEnabled) return res.json({ state: 'disabled' });
  if (!mailSettings) return res.json({ state: 'incomplete' });
  const pendingRetries = Number(db.prepare(`SELECT COUNT(*) AS count FROM callback_mail_outbox
    WHERE delivered_at IS NULL AND attempts > 0 AND lease_until IS NULL`).get().count);
  return res.json(pendingRetries ? { state: 'retry_pending', count: pendingRetries } : { state: 'ready' });
});
app.put('/api/admin/requests/:id',originGuard,requireAdmin,(req,res)=>{const status=req.body?.status;if(!['Новая','В работе','Обработана'].includes(status))return res.status(400).json({error:'Неизвестный статус.'});const r=db.prepare('UPDATE callback_requests SET status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),Number(req.params.id));return r.changes?res.sendStatus(204):res.sendStatus(404);});
let activeMediaUploads = 0;
const mediaBodyParser = (req,res,next) => {
  if (activeMediaUploads >= 2) return res.status(503).json({error:'Загрузка медиа занята. Повторите попытку позже.'});
  activeMediaUploads += 1;
  let released = false;
  const release = () => { if (!released) { released = true; activeMediaUploads -= 1; } };
  let parsed = false;
  res.once('close', () => { if (!parsed) release(); });
  req.releaseMediaUpload = release;
  const isImage = /^image\/(jpeg|png|webp)$/i.test(req.headers['content-type'] || '');
  express.raw({type:['image/jpeg','image/png','image/webp','video/mp4','video/webm'],limit:isImage?'25mb':'100mb'})(req,res,(error) => {
    if (error) { release(); return next(error); }
    parsed = true;
    next();
  });
};
app.post('/api/admin/media',originGuard,requireAdmin,mediaBodyParser,async (req,res)=>{
 try {
  const mime=req.headers['content-type'];const b=req.body;
  if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(mime))return res.status(415).json({error:'Тип файла не поддерживается.'});
  if(!Buffer.isBuffer(b)||!b.length)return res.status(400).json({error:'Файл пуст.'});
  const valid=(mime==='image/jpeg'&&b[0]===0xff&&b[1]===0xd8)||(mime==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')||(mime==='video/mp4'&&b.toString('ascii',4,8)==='ftyp')||(mime==='video/webm'&&b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])));
  if(!valid)return res.status(415).json({error:'Тип файла не поддерживается или содержимое не соответствует формату.'});
  let stored = b;
  let outputMime = mime;
  let ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[mime];
  if (mime.startsWith('image/')) {
    if (activeImageProcesses >= 2) return res.status(503).json({error:'Обработка изображений занята. Повторите попытку позже.'});
    activeImageProcesses += 1;
    try {
      const image = sharp(b, { limitInputPixels: 50_000_000, animated: false });
      const metadata = await image.metadata();
      const expectedFormat = { 'image/jpeg':'jpeg', 'image/png':'png', 'image/webp':'webp' }[mime];
      if (metadata.format !== expectedFormat || !metadata.width || !metadata.height || metadata.pages > 1) {
        return res.status(415).json({error:'Файл не является поддерживаемым статичным изображением.'});
      }
      stored = await image.rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
      outputMime = 'image/webp';
      ext = 'webp';
    } catch {
      return res.status(415).json({error:'Не удалось прочитать изображение.'});
    } finally {
      activeImageProcesses -= 1;
    }
  }
  const filename=`${randomBytes(20).toString('hex')}.${ext}`;
  const dir=resolve(root,'uploads');
  mkdirSync(dir,{recursive:true});
  const filepath=resolve(dir,filename);
  try {
    await writeFile(filepath,stored,{flag:'wx'});
    const storedBytes = Number(db.prepare('SELECT COALESCE(SUM(size),0) AS total FROM media_files').get().total);
    if (storedBytes + stored.length > mediaStorageLimitBytes) {
      await unlink(filepath).catch(()=>{});
      return res.status(507).json({error:'Хранилище медиа заполнено. Увеличьте лимит или освободите место.'});
    }
    let original='Файл';try{original=decodeURIComponent(String(req.headers['x-file-name']||''))||original;}catch{}original=original.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180);
    const result=db.prepare('INSERT INTO media_files(filename,original_name,mime_type,size,created_at) VALUES(?,?,?,?,?)').run(filename,original,outputMime,stored.length,new Date().toISOString());
    res.status(201).json({id:Number(result.lastInsertRowid),url:`/media/${filename}`,name:original,type:outputMime,size:stored.length});
  } catch {
    await unlink(filepath).catch(()=>{});
    return res.status(500).json({error:'Не удалось сохранить файл.'});
  }
 } finally { req.releaseMediaUpload(); }
});
app.get('/api/admin/media',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT id,filename,original_name AS name,mime_type AS type,size,created_at FROM media_files ORDER BY id DESC').all().map(x=>({...x,url:`/media/${x.filename}`}))));
function payloadReferencesMedia(value, filename) {
  if (typeof value === 'string') {
    if (value === filename) return true;
    try { return new URL(value, 'http://local').pathname === `/media/${filename}`; } catch { return false; }
  }
  if (Array.isArray(value)) return value.some((item) => payloadReferencesMedia(item, filename));
  if (value && typeof value === 'object') return Object.values(value).some((item) => payloadReferencesMedia(item, filename));
  return false;
}
app.delete('/api/admin/media/:id',originGuard,requireAdmin,(req,res)=>{
  const mediaId=Number(req.params.id);
  if(!Number.isSafeInteger(mediaId)||mediaId<1)return res.sendStatus(404);
  const row=db.prepare('SELECT id,filename,original_name,mime_type,size,created_at FROM media_files WHERE id=?').get(mediaId);
  if(!row)return res.sendStatus(404);
  const tombstone=resolve(uploadsPath,`${row.filename}.deleting`);
  let renamed=false;
  db.exec('BEGIN IMMEDIATE');
  try {
    const content=db.prepare('SELECT payload_json FROM admin_content').all();
    if(content.some((item)=>payloadReferencesMedia(JSON.parse(item.payload_json),row.filename))){db.exec('ROLLBACK');return res.status(409).json({error:'Файл используется в опубликованном или черновом содержимом.'});}
    const original=resolve(uploadsPath,row.filename);
    renameSync(original,tombstone);
    renamed=true;
    db.prepare('DELETE FROM media_files WHERE id=?').run(mediaId);
    db.exec('COMMIT');
  } catch {
    try { db.exec('ROLLBACK'); } catch {}
    if(renamed)try{renameSync(tombstone,resolve(uploadsPath,row.filename));}catch{}
    return res.status(500).json({error:'Не удалось удалить файл; запись и файл оставлены без изменений.'});
  }
  try {
    unlinkSync(tombstone);
  } catch {
    try {
      db.prepare('INSERT INTO media_files(id,filename,original_name,mime_type,size,created_at) VALUES(?,?,?,?,?,?)').run(row.id,row.filename,row.original_name,row.mime_type,row.size,row.created_at);
      renameSync(tombstone,resolve(uploadsPath,row.filename));
    } catch {}
    return res.status(500).json({error:'Не удалось удалить файл; запись и файл восстановлены, если диск доступен.'});
  }
  return res.sendStatus(204);
});
app.get('/media/:filename',(req,res)=>{if(!/^[a-f0-9]{40}\.(jpg|png|webp|mp4|webm)$/.test(req.params.filename))return res.sendStatus(404);const row=db.prepare('SELECT mime_type FROM media_files WHERE filename=?').get(req.params.filename);if(!row)return res.sendStatus(404);res.type(row.mime_type).sendFile(resolve(root,'uploads',req.params.filename));});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});
app.use((error, _req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (res.headersSent) return next(error);
  const status = error?.type === 'entity.too.large' ? 413
    : error instanceof SyntaxError ? 400
      : Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  const message = status === 413 ? 'Запрос слишком большой.' : status === 400 ? 'Некорректный запрос.' : 'Внутренняя ошибка сервера.';
  return res.status(status).json({ error: message });
});
const port = Number(process.env.API_PORT || 4000);
app.listen(port, apiHost, () => console.log(`Express API listening on http://${apiHost}:${port}`));

if (mailSettings) {
  const retryLeaseMs = 60_000;
  async function deliverNextMailNotification() {
    const now = Date.now();
    let item;
    db.exec('BEGIN IMMEDIATE');
    try {
      const due = db.prepare(`SELECT id, attempts FROM callback_mail_outbox
        WHERE delivered_at IS NULL AND next_attempt_at <= ? AND (lease_until IS NULL OR lease_until <= ?)
        ORDER BY id LIMIT 1`).get(now, now);
      if (due) {
        item = db.prepare(`UPDATE callback_mail_outbox SET lease_until=?, attempts=attempts+1
          WHERE id=? AND delivered_at IS NULL AND (lease_until IS NULL OR lease_until <= ?)
          RETURNING id, attempts`).get(now + retryLeaseMs, due.id, now);
      }
      db.exec('COMMIT');
    } catch {
      try { db.exec('ROLLBACK'); } catch {}
      console.warn('Mail notification queue could not be read; it will be retried.');
      return;
    }
    if (!item) return;

    try {
      await mailTransport.sendMail({
        from: mailSettings.from,
        to: mailSettings.to,
        subject: 'Новая заявка на сайте',
        text: `Поступила новая заявка. Откройте админ-панель: ${mailSettings.adminUrl}`,
      });
      db.prepare('UPDATE callback_mail_outbox SET delivered_at=?, lease_until=NULL WHERE id=? AND delivered_at IS NULL')
        .run(Date.now(), item.id);
    } catch {
      const delay = Math.min(60 * 60_000, 30_000 * (2 ** Math.min(item.attempts - 1, 7)));
      db.prepare('UPDATE callback_mail_outbox SET next_attempt_at=?, lease_until=NULL WHERE id=? AND delivered_at IS NULL')
        .run(Date.now() + delay, item.id);
      console.warn(`Mail notification delivery failed; retry scheduled in ${Math.ceil(delay / 1000)} seconds.`);
    }
  }
  const runMailWorker = async () => {
    try { await deliverNextMailNotification(); }
    catch { console.warn('Mail notification worker encountered an internal error; it will retry.'); }
    setTimeout(runMailWorker, 2_000).unref();
  };
  setTimeout(runMailWorker, 2_000).unref();
}
