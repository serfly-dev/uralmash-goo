'use client';

import { useId, useState } from 'react';

export default function PasswordInput({ label, help, ...props }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return <div className="field-control">
    <label htmlFor={id}>{label}</label>
    <div className="password-input">
      <input {...props} id={id} type={visible ? 'text' : 'password'} />
      <button type="button" aria-label={`${visible ? 'Скрыть' : 'Показать'}: ${label.toLowerCase()}`} onClick={() => setVisible((current) => !current)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
    {help && <small>{help}</small>}
  </div>;
}
