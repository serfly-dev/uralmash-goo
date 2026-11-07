'use client';

import RequestModalStyles from './RequestModal.module.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { apiOrigin } from '../../lib/api';

export type RequestIntent = 'repair' | 'project' | 'purchase' | 'general';

export type RequestContext = {
  intent?: RequestIntent;
  serviceSlug?: string;
  productSlug?: string;
  variantSlug?: string;
};

type RequestModalApi = {
  openRequest: (request?: RequestContext) => void;
};

const RequestModalContext = createContext<RequestModalApi | null>(null);
const emptyForm = { name: '', phone: '+7', message: '', consent: false, website: '' };

function formatPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const number = digits.slice(1);
  return '+7' + (number ? ` (${number.slice(0, 3)}` : '')
    + (number.length > 3 ? `) ${number.slice(3, 6)}` : '')
    + (number.length > 6 ? `-${number.slice(6, 8)}` : '')
    + (number.length > 8 ? `-${number.slice(8, 10)}` : '');
}

export function useRequestModal() {
  const value = useContext(RequestModalContext);
  if (!value) throw new Error('useRequestModal must be used inside RequestModalProvider.');
  return value;
}

export function RequestButton({ intent = 'general', serviceSlug, productSlug, variantSlug, className, children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & RequestContext) {
  const { openRequest } = useRequestModal();

  return (
    <button
      {...props}
      type="button"
      className={[RequestModalStyles["request-trigger"], className].filter(Boolean).join(' ')}
      aria-haspopup="dialog"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openRequest({ intent, serviceSlug, productSlug, variantSlug });
      }}
    >
      {children}
    </button>
  );
}

export default function RequestModalProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [request, setRequest] = useState<RequestContext | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const openRequest = useCallback((nextRequest: RequestContext = {}) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');
    setSent(false);
    setRequest({ ...nextRequest, intent: nextRequest.intent || 'general' });
  }, []);

  const closeRequest = useCallback(() => {
    setForm(emptyForm);
    if (dialogRef.current?.open) dialogRef.current.close();
    else setRequest(null);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  function handleClose() {
    setRequest(null);
    setForm(emptyForm);
    window.requestAnimationFrame(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    });
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request || sending) return;

    setSending(true);
    setError('');
    try {
      const response = await fetch(`${apiOrigin}/api/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          sourcePath: window.location.pathname,
          name: form.name,
          phone: form.phone.replace(/\D/g, ''),
          message: form.message,
          consent: form.consent,
          website: form.website,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Не удалось отправить заявку. Попробуйте ещё раз.');
      setForm(emptyForm);
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  const intent = request?.intent || 'general';
  const title = intent === 'repair' ? 'Заявка на ремонт' : intent === 'project' ? 'Обсудить проект' : intent === 'purchase' ? 'Заявка на оборудование' : 'Оставить заявку';
  const description = intent === 'repair'
    ? 'Напишите, какое оборудование нужно отремонтировать.'
    : intent === 'project'
      ? 'Расскажите, какое оборудование или линию нужно спроектировать и изготовить.'
      : intent === 'purchase'
      ? 'Уточним наличие и поможем с выбранной позицией.'
      : 'Расскажите, с чем помочь.';

  return (
    <RequestModalContext.Provider value={{ openRequest }}>
      {children}
      <dialog
        ref={dialogRef}
        className={RequestModalStyles["request-modal"]}
        aria-labelledby="request-modal-title"
        aria-describedby={sent ? undefined : 'request-modal-description'}
        onClose={handleClose}
        onCancel={(event) => { event.preventDefault(); closeRequest(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeRequest(); }}
      >
        <div className={RequestModalStyles["request-modal__panel"]}>
          <button className={RequestModalStyles["request-modal__close"]} type="button" aria-label="Закрыть" onClick={closeRequest}>×</button>
          {sent ? (
            <div className={RequestModalStyles["request-modal__success"]} role="status">
              <div className={"request-modal__heading" + " " + RequestModalStyles["request-modal__heading"]}>
                <h2 id="request-modal-title">Спасибо</h2>
                <p>Данные сохранены. Мы свяжемся с вами по указанному телефону.</p>
              </div>
              <button className={"request-modal__submit" + " " + RequestModalStyles["request-modal__submit"]} type="button" onClick={closeRequest}>Закрыть</button>
            </div>
          ) : (
            <>
              <div className={"request-modal__heading" + " " + RequestModalStyles["request-modal__heading"]}>
                <h2 id="request-modal-title">{title}</h2>
                <p className={"request-modal__description" + " " + RequestModalStyles["request-modal__description"]} id="request-modal-description">{description}</p>
              </div>
              <form className={RequestModalStyles["request-modal__form"]} onSubmit={submitRequest}>
                <label>
                  <span>Имя</span>
                  <input autoFocus name="name" autoComplete="name" maxLength={120} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  <span>Телефон</span>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern={String.raw`\+7 \([0-9]{3}\) [0-9]{3}\-[0-9]{2}\-[0-9]{2}`} title="Введите номер полностью: +7 (999) 567-33-33" required value={form.phone} onChange={(event) => {
                    const input = event.currentTarget;
                    const position = input.selectionStart ?? input.value.length;
                    const digitsBeforeCursor = input.value.slice(0, position).replace(/\D/g, '').length;
                    const phone = formatPhone(input.value);
                    setForm({ ...form, phone });
                    window.requestAnimationFrame(() => {
                      let cursor = 0;
                      let digits = 0;
                      while (cursor < phone.length && digits < Math.max(1, digitsBeforeCursor)) {
                        if (/\d/.test(phone[cursor])) digits++;
                        cursor++;
                      }
                      input.setSelectionRange(cursor, cursor);
                    });
                  }} onKeyDown={(event) => {
                    const input = event.currentTarget;
                    const start = input.selectionStart ?? 0;
                    if (event.key === 'Backspace' && start === input.selectionEnd && start > 2 && /\D/.test(input.value[start - 1])) {
                      event.preventDefault();
                      let digit = start - 1;
                      while (digit > 1 && /\D/.test(input.value[digit])) digit--;
                      const phone = formatPhone(input.value.slice(0, digit) + input.value.slice(start));
                      setForm({ ...form, phone });
                      window.requestAnimationFrame(() => input.setSelectionRange(digit, digit));
                    }
                  }} onPaste={(event) => {
                    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
                    if (digits.length === 11 && /^[78]/.test(digits)) {
                      event.preventDefault();
                      setForm({ ...form, phone: formatPhone(digits) });
                    }
                  }} />
                </label>
                <label>
                  <span>Комментарий <small>необязательно</small></span>
                  <textarea name="message" rows={4} maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
                </label>
                <label className={"request-modal__consent" + " " + RequestModalStyles["request-modal__consent"]}>
                  <input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} />
                  <span>Согласен на обработку персональных данных для ответа на заявку в соответствии с <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">политикой обработки персональных данных</a>.</span>
                </label>
                <label className={"request-modal__trap" + " " + RequestModalStyles["request-modal__trap"]} aria-hidden="true">
                  <span>Сайт</span>
                  <input name="website" autoComplete="off" tabIndex={-1} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
                </label>
                {error && <p className={"request-modal__error" + " " + RequestModalStyles["request-modal__error"]} role="alert">{error}</p>}
                <button className={"request-modal__submit" + " " + RequestModalStyles["request-modal__submit"]} type="submit" disabled={sending || !form.consent}>
                  {sending ? 'Отправляем…' : 'Отправить заявку'}
                </button>
              </form>
            </>
          )}
        </div>
      </dialog>
    </RequestModalContext.Provider>
  );
}
