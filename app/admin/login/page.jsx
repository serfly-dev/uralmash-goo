'use client';

import { useState } from 'react';
import { authApi } from '../../lib/api';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${authApi}/login${challenge ? '/verify' : ''}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challenge ? { challenge, code } : { username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить вход.');
      if (challenge) window.location.assign('/admin');
      else { setPassword(''); setChallenge(data.challenge); }
    } catch (err) {
      setError(err.message || 'Сервер админ-панели недоступен.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <a className="admin-brand" href="/">
        <img src="/logo-reference.png" alt="" />
        <span>Уралмаш ГОО<small>Административная панель</small></span>
      </a>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-mark" aria-hidden="true">УГ</div>
        <p className="admin-eyebrow">УПРАВЛЕНИЕ САЙТОМ</p>
        <h1 id="login-title">Вход в админ-панель</h1>
        <p className="login-copy">{challenge ? 'Введите шестизначный код из письма. Он действует 10 минут.' : 'Введите учётные данные администратора.'}</p>
        <form onSubmit={submit}>
          {challenge ? <label>Код из письма<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} /></label> : <><label>Логин<input name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label></>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="admin-primary" disabled={busy}>{busy ? 'Проверяем…' : challenge ? 'Подтвердить код' : 'Войти'}</button>
          {challenge && <button type="button" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Войти заново</button>}
        </form>
        <a className="back-link" href="/">← Вернуться на сайт</a>
      </section>
      <p className="login-foot">Доступ предназначен для администратора сайта.</p>
    </main>
  );
}
