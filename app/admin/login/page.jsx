'use client';

import { useState } from 'react';
import { authApi } from '../../lib/api';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${authApi}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить вход.');
      window.location.assign('/admin');
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
        <p className="login-copy">Введите учётные данные администратора.</p>
        <form onSubmit={submit}>
          <label>Логин<input name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="admin-primary" disabled={busy}>{busy ? 'Проверяем…' : 'Войти'}</button>
        </form>
        <a className="back-link" href="/">← Вернуться на сайт</a>
      </section>
      <p className="login-foot">Доступ предназначен для администратора сайта.</p>
    </main>
  );
}
