'use client';

import { useEffect, useState } from 'react';
import { adminApi, apiOrigin, authApi } from '../lib/api';
import PasswordInput from './PasswordInput';

const modules = [
  ['products', 'Каталог'],
  ['categories', 'Категории'],
  ['specifications', 'Характеристики'],
  ['tags', 'Теги'],
  ['services', 'Направления'],
  ['reviews', 'Отзывы'],
  ['works', 'Проекты'],
  ['contacts', 'Контакты'],
  ['privacy-policy', 'Политика персональных данных'],
  ['requests', 'Заявки'],
];

const api = adminApi;
const editable = ['products', 'categories', 'tags', 'specifications', 'services', 'reviews', 'works', 'contacts'];
const mediaTypes = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
const imageTypes = 'image/jpeg,image/png,image/webp';

function parseWorkStages(content = '') {
  return content
    .split(/\r?\n/)
    .map((description) => description.replace(/^\s*(?:\d+[.)]|[-*•–—])\s*/, '').trim())
    .filter(Boolean)
    .map((description) => ({ description, image: '' }));
}

function emptyPayload(section) {
  if (section === 'products') return { description: '', media: [], characteristics: {}, variants: [], categoryIds: [], tagIds: [] };
  if (section === 'categories') return { parentId: null };
  if (section === 'specifications') return { valueType: 'text', unit: '', filterMode: 'values' };
  if (section === 'reviews') return { authorName: '', text: '' };
  if (section === 'services') return { description: '', content: '', media: [] };
  if (section === 'works') return { description: '', content: '', media: [], stages: [] };
  if (section === 'contacts') return { phone: '', email: '', address: '', workHours: '', max: '', vk: '', telegram: '', legalName: '', inn: '', ogrn: '', legalAddress: '' };
  return {};
}

function slugify(value) {
  const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return value.toLowerCase().replace(/[а-яё]/g, (letter) => map[letter]).trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mediaSource(url) {
  return url && url.startsWith('/') ? apiOrigin + url : url;
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' КБ' : (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function requestIntentLabel(intent) {
  if (intent === 'repair') return 'Ремонт';
  if (intent === 'project') return 'Проект';
  if (intent === 'purchase') return 'Покупка';
  return 'Общий вопрос';
}

function FormField({ label, help, children, className = '' }) {
  return (
    <label className={'field-control ' + className}>
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function ExpandableList({ items, renderItem, className = '', compact = true }) {
  const visibleItems = compact ? items.slice(0, 5) : items;
  return (
    <div className={'expandable-list ' + className}>
      {visibleItems.map(renderItem)}
      {compact && items.length > 5 && <details className="expandable-list__more">
        <summary><span>Показать все ({items.length - 5})</span><span className="expandable-list__collapse">Свернуть</span></summary>
        <div className="expandable-list__items">{items.slice(5).map(renderItem)}</div>
      </details>}
    </div>
  );
}

function MediaSelector({ label, help, mediaFiles, value, onChange, onUpload, onDeleteMedia, singleImage = false, compactLists = false }) {
  const [uploading, setUploading] = useState(false);
  const selected = Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean) : [];
  const unlisted = selected.filter((url) => !mediaFiles.some((file) => file.url === url));
  const availableFiles = singleImage ? mediaFiles.filter((file) => file.type.startsWith('image/')) : mediaFiles;

  async function addFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await onUpload(file);
      if (uploaded?.url && (singleImage || !selected.includes(uploaded.url))) {
        onChange(singleImage ? [uploaded.url] : [...selected, uploaded.url]);
      }
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  function renderMediaOption(item) {
    if (item.file) {
      const file = item.file;
      const isVideo = file.type.startsWith('video/');
      const checked = selected.includes(file.url);
      return (
        <div className={'media-option' + (checked ? ' is-selected' : '')} key={file.id}>
          <input
            id={`media-option-${file.id}`}
            className="media-option__check"
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(singleImage
              ? (event.target.checked ? [file.url] : [])
              : (event.target.checked ? [...selected, file.url] : selected.filter((url) => url !== file.url)))}
          />
          <label className="media-option__label" htmlFor={`media-option-${file.id}`}>
            <span className="media-option__preview">
              {isVideo ? <span className="media-option__video">▶ Видео</span> : <img src={mediaSource(file.url)} alt="" loading="lazy" />}
            </span>
            <span className="media-option__name">{file.name}</span>
            <small>{formatSize(file.size)}</small>
          </label>
          {!checked && <button className="media-option__delete" type="button" onClick={() => onDeleteMedia(file)}>Удалить файл</button>}
        </div>
      );
    }

    const { url } = item;
    return (
      <label className="media-option media-option--unlisted is-selected" key={url}>
        <input
          className="media-option__check"
          type="checkbox"
          checked
          onChange={() => onChange(singleImage ? [] : selected.filter((item) => item !== url))}
        />
        <span className="media-option__preview"><span className="media-option__video">Добавлено ранее</span></span>
        <span className="media-option__name">{url}</span>
        <small>Ссылка вне медиатеки</small>
      </label>
    );
  }

  return (
    <fieldset className="editor-fieldset media-picker">
      <legend>{label}</legend>
      <p className="field-help">{help}</p>
      <div className="media-picker__toolbar">
        <label className="media-upload-button">
          <span>{uploading ? 'Загружаем…' : 'Загрузить фото или видео'}</span>
          <input type="file" accept={singleImage ? imageTypes : mediaTypes} disabled={uploading} onChange={addFile} />
        </label>
        <small>{singleImage ? 'JPG, PNG или WebP · до 25 МБ; фото автоматически приводится к WebP' : 'JPG, PNG, WebP до 25 МБ; MP4 и WebM до 100 МБ'}</small>
      </div>
      {availableFiles.length || unlisted.length ? (
        <ExpandableList
          className="media-grid"
          items={[...availableFiles.map((file) => ({ file })), ...unlisted.map((url) => ({ url }))]}
          renderItem={renderMediaOption}
          compact={compactLists}
        />
      ) : (
        <p className="media-empty">Файлов пока нет. Загрузите нужное фото или видео здесь.</p>
      )}
    </fieldset>
  );
}

function StructuredFields({ section, edit, setEdit, categories, tags, specifications, mediaFiles, onUpload, onDeleteMedia, onOpenCategory }) {
  const payload = edit.payload;
  const set = (key, value) => setEdit({ ...edit, payload: { ...payload, [key]: value } });
  const text = (key, label, options = {}) => (
    <FormField key={key} label={label} help={options.help}>
      {options.multiline
        ? <textarea rows={options.rows || 4} placeholder={options.placeholder} value={payload[key] || ''} onChange={(event) => set(key, event.target.value)} />
        : <input type={options.type || 'text'} placeholder={options.placeholder} value={payload[key] ?? ''} onChange={(event) => set(key, event.target.value)} />}
    </FormField>
  );
  const json = (key, label, help) => {
    const variantParts = key.startsWith('variant-') ? key.split('-') : null;
    const value = variantParts
      ? payload.variants?.[Number(variantParts.at(-1))]?.[variantParts[1]]
      : payload[key];

    return (
      <details className="advanced-json" key={key}>
        <summary>{label}</summary>
        <small>{help}</small>
        <textarea
          rows="7"
          value={edit.invalidJson === key ? edit.invalidJsonText : JSON.stringify(value ?? {}, null, 2)}
          onChange={(event) => {
            try {
              const nextValue = JSON.parse(event.target.value);
              if (variantParts) {
                const variants = [...(payload.variants || [])];
                const index = Number(variantParts.at(-1));
                variants[index] = { ...variants[index], [variantParts[1]]: nextValue };
                set('variants', variants);
              } else {
                set(key, nextValue);
              }
              setEdit((current) => ({ ...current, invalidJson: null, invalidJsonText: '' }));
            } catch {
              setEdit({ ...edit, invalidJson: key, invalidJsonText: event.target.value });
            }
          }}
        />
      </details>
    );
  };

  const characteristicFields = (value, onChange) => <fieldset className="editor-fieldset"><legend>Характеристики</legend>
    <p className="field-help">Выберите нужные характеристики и заполните значения.</p>
    {specifications.length ? <ExpandableList items={specifications} renderItem={(specification) => {
      const title = specification.title;
      const type = specification.payload?.valueType || 'text';
      const selected = Object.hasOwn(value, title);
      const current = value[title];
      const isRange = type === 'range' || (type === 'number' && current && typeof current === 'object');
      const label = title + (specification.payload?.unit ? ', ' + specification.payload.unit : '');
      return <div key={specification.id}>
        <label className="check-line check-line--compact"><input type="checkbox" checked={selected} onChange={(event) => {
          const next = { ...value };
          if (event.target.checked) next[title] = type === 'range' ? { min: '', max: '' } : '';
          else delete next[title];
          onChange(next);
        }} /><span>{label}</span></label>
        {selected && type === 'number' && <FormField label={'Формат значения: ' + label}><select value={isRange ? 'range' : 'number'} onChange={(event) => {
          const nextValue = event.target.value === 'range' ? { min: current ?? '', max: current ?? '' } : (current?.min === current?.max ? current.min : '');
          onChange({ ...value, [title]: nextValue });
        }}><option value="number">Число</option><option value="range">Диапазон чисел</option></select></FormField>}
        {selected && (isRange && current && typeof current === 'object' ? <div className="editor-grid">
          {['min', 'max'].map((bound) => <FormField key={bound} label={label + (bound === 'min' ? ' — от' : ' — до')}><input type="number" step="any" required value={current[bound] ?? ''} onChange={(event) => onChange({ ...value, [title]: { ...current, [bound]: event.target.value } })} /></FormField>)}
        </div> : <FormField label={label}><input required type={type === 'number' ? 'number' : 'text'} step={type === 'number' ? 'any' : undefined} value={current ?? ''} onChange={(event) => onChange({ ...value, [title]: event.target.value })} /></FormField>)}
      </div>;
    }} /> : <small>Сначала добавьте характеристики в соответствующем разделе.</small>}
  </fieldset>;

  if (section === 'products') {
    const variants = payload.variants || [];
    const updateVariant = (index, field, value) => set('variants', variants.map((variant, itemIndex) => itemIndex === index ? { ...variant, [field]: value } : variant));

    return (
      <>
        {text('description', 'Описание товара', { multiline: true, help: 'Коротко опишите назначение и основные особенности оборудования.' })}
        {!variants.length && <FormField label="Цена товара, ₽" help="Целое число. Оставьте пустым, если цена уточняется по запросу."><input type="number" min="0" step="1" value={payload.priceRub ?? ''} onChange={(event) => set('priceRub', event.target.value === '' ? null : Number(event.target.value))} /></FormField>}
        {!variants.length && <label className="check-line"><input type="checkbox" checked={payload.priceIsFrom !== false} onChange={(event) => set('priceIsFrom', event.target.checked)} /><span>Показывать цену с «от»</span></label>}
        <label className="check-line">
          <input type="checkbox" checked={payload.featuredOnHome === true} onChange={(event) => set('featuredOnHome', event.target.checked)} />
          <span><strong>Показывать на главной</strong><small>В блок попадут до шести опубликованных товаров с фото.</small></span>
        </label>
        <fieldset className="editor-fieldset">
          <legend>Категории</legend>
          <p className="field-help">Выберите все разделы, в которых должен появиться товар.</p>
          {categories.length ? <ExpandableList items={categories} renderItem={(category) => (
            <label className="check-line check-line--compact" key={category.id}>
              <input type="checkbox" checked={(payload.categoryIds || []).includes(category.id)} onChange={(event) => set('categoryIds', event.target.checked ? [...(payload.categoryIds || []), category.id] : (payload.categoryIds || []).filter((id) => id !== category.id))} />
              <span>{category.title}</span>
            </label>
          )} /> : <small>Сначала добавьте категории.</small>}
        </fieldset>
        <fieldset className="editor-fieldset">
          <legend>Теги</legend>
          <p className="field-help">Теги помогают объединять товары по общим признакам.</p>
          {tags.length ? <ExpandableList items={tags} renderItem={(tag) => (
            <label className="check-line check-line--compact" key={tag.id}>
              <input type="checkbox" checked={(payload.tagIds || []).includes(tag.id)} onChange={(event) => set('tagIds', event.target.checked ? [...(payload.tagIds || []), tag.id] : (payload.tagIds || []).filter((id) => id !== tag.id))} />
              <span>{tag.title}</span>
            </label>
          )} /> : <small>Сначала добавьте теги.</small>}
        </fieldset>
        <MediaSelector
          label="Фото и видео товара"
          help="Общая галерея товара. Для отдельного варианта можно назначить свои файлы ниже."
          mediaFiles={mediaFiles}
          value={payload.media}
          onChange={(value) => set('media', value)}
          onUpload={onUpload}
          onDeleteMedia={onDeleteMedia}
          compactLists
        />
        {characteristicFields(payload.characteristics || {}, (value) => set('characteristics', value))}
        <section className="variant-section">
          <div className="variant-head">
            <div><h3>Варианты товара</h3><p>У каждого варианта свой адрес страницы, цена и артикул.</p></div>
            <button type="button" onClick={() => set('variants', [...variants, { name: '', slug: '', priceRub: '', article: '', characteristics: {}, media: [] }])}>Добавить вариант</button>
          </div>
          {!variants.length && <p className="empty-state">Если у товара несколько исполнений, добавьте варианты с отдельными ценами.</p>}
          <ExpandableList items={variants} renderItem={(variant, index) => (
            <fieldset className="editor-fieldset variant-editor" key={index}>
              <legend>Вариант {index + 1}</legend>
              <button type="button" className="remove-variant" onClick={() => set('variants', variants.filter((_, itemIndex) => itemIndex !== index))}>Удалить</button>
              <div className="editor-grid">
                <FormField label="Название варианта" help="Например, производительность или комплектация.">
                  <input value={variant.name || ''} onChange={(event) => updateVariant(index, 'name', event.target.value)} />
                </FormField>
                <FormField label="Адрес страницы" help="Латиницей, без пробелов.">
                  <input pattern="[a-z0-9]+(-[a-z0-9]+)*" value={variant.slug || ''} onChange={(event) => updateVariant(index, 'slug', event.target.value.toLowerCase())} />
                </FormField>
                <FormField label="Цена, ₽" help="Целое число. В каталоге будет показана минимальная цена вариантов.">
                  <input type="number" min="0" step="1" value={variant.priceRub ?? ''} onChange={(event) => updateVariant(index, 'priceRub', event.target.value === '' ? '' : Number(event.target.value))} />
                </FormField>
                <FormField label="Артикул">
                  <input value={variant.article || ''} onChange={(event) => updateVariant(index, 'article', event.target.value)} />
                </FormField>
              </div>
              {characteristicFields(variant.characteristics || {}, (value) => updateVariant(index, 'characteristics', value))}
              <MediaSelector
                label="Фото и видео варианта"
                help="Если ничего не выбрать, вариант будет использовать общую галерею товара."
                mediaFiles={mediaFiles}
                value={variant.media}
                onChange={(value) => updateVariant(index, 'media', value)}
                onUpload={onUpload}
                onDeleteMedia={onDeleteMedia}
                compactLists
              />
            </fieldset>
          )} />
        </section>
      </>
    );
  }

  if (section === 'categories') {
    return (
      <>
        {edit.id && <details className="advanced-json"><summary>Расположение категории</summary>
          <FormField label="Родительская категория"><select value={payload.parentId ?? ''} onChange={(event) => set('parentId', event.target.value ? Number(event.target.value) : null)}><option value="">Верхний уровень</option>{categories.filter((category) => category.id !== edit.id).map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></FormField>
        </details>}
        <fieldset className="editor-fieldset">
          <legend>Подкатегории</legend>
          {!edit.id ? <small>Сначала сохраните категорию, затем добавьте подкатегории.</small> : <>
            {categories.filter((category) => category.payload?.parentId === edit.id).map((category) => <div className="inline-row" key={category.id}><span>{category.title}</span><button type="button" onClick={() => onOpenCategory(category)}>Открыть</button></div>)}
            <button type="button" onClick={() => onOpenCategory(null, edit.id)}>Добавить подкатегорию</button>
          </>}
        </fieldset>
      </>
    );
  }

  if (section === 'specifications') {
    return (
      <>
        <FormField label="Тип значения" help="Выберите число для характеристик с единицей измерения, например мощности.">
          <select value={payload.valueType || 'text'} onChange={(event) => setEdit({ ...edit, payload: { ...payload, valueType: event.target.value, filterMode: event.target.value === 'range' ? 'range' : 'values' } })}>
            <option value="text">Текст</option>
            <option value="number">Число</option>
            <option value="range">Диапазон чисел</option>
          </select>
        </FormField>
        {text('unit', 'Единица измерения', { placeholder: 'Например, кВт', help: 'Оставьте пустым для текстовых характеристик.' })}
        {payload.valueType === 'number' && <FormField label="Способ фильтрации" help="Задайте диапазон для чисел или выбор готовых значений.">
          <select value={payload.filterMode || 'values'} onChange={(event) => set('filterMode', event.target.value)}>
            <option value="values">Готовые значения</option>
            <option value="range">Диапазон «от — до»</option>
          </select>
        </FormField>}
      </>
    );
  }

  if (section === 'reviews') {
    return (
      <>
        {text('authorName', 'Имя автора', { placeholder: 'Как подписать отзыв?' })}
        {text('text', 'Текст отзыва', { multiline: true, help: 'Публикуйте текст с согласия автора.' })}
      </>
    );
  }

  if (section === 'services' || section === 'works') {
    const isWork = section === 'works';
    const stages = isWork ? (Array.isArray(payload.stages) ? payload.stages : parseWorkStages(payload.content)) : [];
    const updateStage = (index, key, value) => set('stages', stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, [key]: value } : stage));
    const moveStage = (index, direction) => {
      const nextStages = [...stages];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= nextStages.length) return;
      [nextStages[index], nextStages[targetIndex]] = [nextStages[targetIndex], nextStages[index]];
      set('stages', nextStages);
    };

    return (
      <>
        {text('description', 'Краткое описание', { multiline: true, rows: 3, help: 'Этот текст используется в списке раздела.' })}
        {isWork ? (
          <fieldset className="editor-fieldset work-stages-editor">
            <legend>Этапы проекта</legend>
            <p className="field-help">Укажите этапы проектирования или изготовления и добавьте относящиеся к ним фото. Порядок этапов можно менять.</p>
            {stages.map((stage, index) => (
              <fieldset className="editor-fieldset work-stage-editor" key={stage.id || index}>
                <legend>Этап {index + 1}</legend>
                <FormField label="Описание этапа" help="Опишите, что сделали на этом этапе.">
                  <textarea
                    rows={3}
                    value={stage.description || ''}
                    onChange={(event) => updateStage(index, 'description', event.target.value)}
                  />
                </FormField>
                <MediaSelector
                  label="Фото этапа"
                  help="Выберите или загрузите фото, относящееся к этому этапу."
                  mediaFiles={mediaFiles}
                  value={stage.image ? [stage.image] : []}
                  onChange={(value) => updateStage(index, 'image', value[0] || '')}
                  onUpload={onUpload}
                  onDeleteMedia={onDeleteMedia}
                  singleImage
                />
                <div className="inline-row work-stage-editor__actions">
                  <button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)}>Выше</button>
                  <button type="button" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)}>Ниже</button>
                  <button type="button" onClick={() => set('stages', stages.filter((_, stageIndex) => stageIndex !== index))}>Удалить этап</button>
                </div>
              </fieldset>
            ))}
            <button type="button" onClick={() => set('stages', [...stages, { description: '', image: '' }])}>Добавить этап</button>
          </fieldset>
        ) : text('content', 'Описание направления', { multiline: true, help: 'Подробное описание проектирования, изготовления или поставки.' })}
        <MediaSelector
          label={isWork ? 'Фото и видео проекта' : 'Фото и видео направления'}
          help={isWork ? 'Добавьте материалы проекта или изготовленного оборудования.' : 'Добавьте изображения, которые поясняют направление.'}
          mediaFiles={mediaFiles}
          value={payload.media}
          onChange={(value) => set('media', value)}
          onUpload={onUpload}
          onDeleteMedia={onDeleteMedia}
        />
      </>
    );
  }

  if (section === 'contacts') {
    return (
      <>
        {text('phone', 'Телефон', { placeholder: '+7 (___) ___-__-__', help: 'Номер, по которому клиент сможет связаться с компанией.' })}
        {text('email', 'Электронная почта', { type: 'email', placeholder: 'info@example.ru', help: 'Адрес для обращений с сайта.' })}
        {text('address', 'Адрес', { placeholder: 'Город, улица, дом' })}
        {text('workHours', 'Часы работы', { placeholder: 'Пн–Пт, 09:00–18:00' })}
        {text('max', 'Ссылка на MAX', { type: 'url', placeholder: 'https://max.ru/...' })}
        {text('vk', 'Ссылка на ВКонтакте', { type: 'url', placeholder: 'https://vk.com/...' })}
        {text('telegram', 'Ссылка на Telegram', { type: 'url', placeholder: 'https://t.me/...' })}
        <fieldset className="editor-fieldset">
          <legend>Юридическая информация</legend>
          <p className="field-help">Заполненные данные будут показаны в подвале сайта, если контакт опубликован.</p>
          {text('legalName', 'Полное наименование организации', { placeholder: 'Общество с ограниченной ответственностью «Название»' })}
          {text('inn', 'ИНН', { placeholder: '10 цифр', help: 'ИНН юридического лица — 10 цифр.' })}
          {text('ogrn', 'ОГРН', { placeholder: '13 цифр', help: 'ОГРН юридического лица — 13 цифр.' })}
          {text('legalAddress', 'Юридический адрес', { placeholder: 'Адрес из ЕГРЮЛ' })}
        </fieldset>
      </>
    );
  }

  if (section === 'tags') {
    return <p className="editor-help">Тег связывается с товарами в форме каталога и помогает посетителю сузить список.</p>;
  }

  return null;
}

function PasswordSettings({ mode = 'password' }) {
  const changingUsername = mode === 'username';
  const [step, setStep] = useState('request');
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!changingUsername && step === 'password' && newPassword !== confirmation) return setError('Новые пароли не совпадают.');
    setBusy(true);
    try {
      const action = step === 'request' ? 'code' : step === 'code' ? 'verify' : 'change';
      const body = step === 'code' ? { code } : step === 'password' ? (changingUsername ? { currentPassword, newUsername: newPassword } : { currentPassword, newPassword }) : { purpose: mode };
      const response = await fetch(`${authApi}/${step === 'password' && changingUsername ? 'username' : 'password'}/${action}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос.');
      if (step === 'request') setStep('code');
      else if (step === 'code') { setCode(''); setStep('password'); }
      else { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setStep('done'); }
    } catch (requestError) { setError(requestError.message || 'Не удалось связаться с сервером.'); }
    finally { setBusy(false); }
  }

  if (step === 'done') return <div className="editor-card"><h2>{changingUsername ? 'Логин изменён' : 'Пароль изменён'}</h2><p>Для безопасности выполнен выход из всех сеансов.</p><a href="/admin/login">{changingUsername ? 'Войти с новым логином' : 'Войти с новым паролем'}</a></div>;
  return <form className="editor-card" onSubmit={submit}>
    <h2>{changingUsername ? 'Смена логина' : 'Смена пароля'}</h2>
    {step === 'request' && <p>Отправим код подтверждения на почту, настроенную для уведомлений сайта.</p>}
    {step === 'code' && <><p>Введите шестизначный код из письма. Он действует 10 минут.</p><FormField label="Код из письма"><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></FormField></>}
    {step === 'password' && <><PasswordInput label="Текущий пароль" required autoComplete="current-password" maxLength={256} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />{changingUsername ? <FormField label="Новый логин" help="От 3 до 64 символов: латинские буквы, цифры и знаки . _ -"><input required autoComplete="username" minLength={3} maxLength={64} pattern="[A-Za-z0-9._\-]{3,64}" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></FormField> : <><PasswordInput label="Новый пароль" help="От 12 до 256 символов: латинские буквы, цифры и знаки !@#$%^&*()_+-=[]{};:,.?" required autoComplete="new-password" minLength={12} maxLength={256} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><PasswordInput label="Повторите новый пароль" required autoComplete="new-password" minLength={12} maxLength={256} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></>}</>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-actions"><button className="admin-primary" disabled={busy}>{busy ? 'Подождите…' : step === 'request' ? 'Отправить код' : step === 'code' ? 'Подтвердить код' : changingUsername ? 'Изменить логин' : 'Изменить пароль'}</button>{step !== 'request' && <button type="button" disabled={busy} onClick={() => { setStep('request'); setCode(''); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setError(''); }}>Начать заново</button>}</div>
  </form>;
}

function PrivacyPolicySettings() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(api + '/privacy-policy', { credentials: 'include', signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { setText(data.text); setLoaded(true); })
      .catch((error) => { if (error.name !== 'AbortError') setMessage('Не удалось загрузить политику.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function savePolicy(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(api + '/privacy-policy', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Не удалось сохранить политику.'); }
      setMessage('Политика сохранена и опубликована.');
    } catch (error) { setMessage(error.message || 'Не удалось сохранить политику.'); }
    finally { setBusy(false); }
  }
  return <form className="editor-card" onSubmit={savePolicy}>
    <div className="editor-card__heading"><h2>Политика обработки персональных данных</h2></div>
    <FormField label="Текст политики" help="Текст будет опубликован на странице политики. Переносы строк сохраняются.">
      <textarea rows={20} required value={text} onChange={(event) => setText(event.target.value)} disabled={!loaded} />
    </FormField>
    {message && <p role="status">{message}</p>}
    <div className="editor-actions"><button className="admin-primary" disabled={loading || !loaded || busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form>;
}

export default function AdminDashboard({ username }) {
  const [section, setSection] = useState('products');
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reqs, setReqs] = useState([]);
  const [mailStatus, setMailStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [specifications, setSpecifications] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);

  async function load(contactId = null) {
    setError('');
    try {
      const endpoint = section === 'requests' ? api + '/requests' : api + '/content/' + section;
      const response = await fetch(endpoint, { credentials: 'include' });
      if (!response.ok) throw new Error('Не удалось загрузить раздел.');
      const data = await response.json();
      if (section === 'requests') setReqs(data);
      else {
        setRows(data);
        if (section === 'contacts') {
          const row = data.find((item) => item.id === contactId) || data[0];
          setEdit(row
            ? { id: row.id, title: row.title, slug: row.slug, payload: { ...emptyPayload('contacts'), ...(row.payload || {}) }, published: row.published, sortOrder: row.sort_order }
            : { title: 'Контакты', slug: 'contacts', payload: emptyPayload('contacts'), published: true, sortOrder: 0 });
        }
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadLookups() {
    try {
      const types = ['categories', 'tags', 'specifications'];
      const lookupRequests = types.map((type) => fetch(api + '/content/' + type, { credentials: 'include' }));
      const needsMedia = ['products', 'services', 'works'].includes(section);
      if (needsMedia) lookupRequests.push(fetch(api + '/media', { credentials: 'include' }));
      const responses = await Promise.all(lookupRequests);
      const data = await Promise.all(responses.map(async (response) => response.ok ? response.json() : []));
      setCategories(data[0]);
      setTags(data[1]);
      setSpecifications(data[2]);
      setMediaFiles(needsMedia ? data[3] : []);
    } catch {
      setError('Не удалось загрузить данные для формы.');
    }
  }

  useEffect(() => {
    setEdit(null);
    if (section === 'overview' || section === 'password' || section === 'username' || section === 'privacy-policy') {
      setRows([]);
      setReqs([]);
      setError('');
    } else {
      load();
    }
  }, [section]);

  useEffect(() => {
    if (section !== 'requests') {
      setMailStatus(null);
      return;
    }
    let active = true;
    const refreshMailStatus = async () => {
      try {
        const response = await fetch(api + '/mail-status', { credentials: 'include' });
        if (!response.ok) throw new Error('status unavailable');
        const status = await response.json();
        if (active) setMailStatus(status);
      } catch {
        if (active) setMailStatus({ state: 'unknown' });
      }
    };
    refreshMailStatus();
    const timer = setInterval(refreshMailStatus, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [section]);

  useEffect(() => {
    if (edit && section !== 'contacts') loadLookups();
  }, [Boolean(edit)]);

  async function logout() {
    await fetch(`${authApi}/logout`, { method: 'POST', credentials: 'include' });
    location.assign('/admin/login');
  }

  function open(row, parentId = null) {
    setError('');
    setNotice('');
    const payload = row ? { ...(row.payload || {}) } : { ...emptyPayload(section), ...(section === 'categories' ? { parentId } : {}) };
    if (section === 'works' && !Array.isArray(payload.stages)) payload.stages = parseWorkStages(payload.content);
    setEdit(row
      ? { id: row.id, title: row.title, slug: row.slug, payload, published: row.published, sortOrder: row.sort_order }
      : { title: '', slug: '', payload, published: section === 'specifications', sortOrder: 0 });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (edit.invalidJson) throw new Error('Исправьте JSON в поле расширенных данных.');
      const payload = { ...edit.payload };
      if (section === 'contacts') {
        for (const key of ['legalName', 'inn', 'ogrn', 'legalAddress']) payload[key] = (payload[key] || '').trim();
        if (payload.inn && !/^\d{10}$/.test(payload.inn)) throw new Error('ИНН организации должен содержать 10 цифр.');
        if (payload.ogrn && !/^\d{13}$/.test(payload.ogrn)) throw new Error('ОГРН организации должен содержать 13 цифр.');
      }
      if (section === 'products') {
        const normalizeCharacteristics = (values = {}) => Object.fromEntries(Object.entries(values).map(([name, value]) => {
          const type = specifications.find((specification) => specification.title === name)?.payload?.valueType;
          if (value && typeof value === 'object') {
            const min = value.min === '' ? NaN : Number(value.min);
            const max = value.max === '' ? NaN : Number(value.max);
            if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error('Укажите корректные границы диапазона.');
            return [name, { min, max }];
          }
          if (type === 'number' && value !== '') {
            const number = Number(value);
            if (!Number.isFinite(number)) throw new Error('Укажите корректное значение характеристики.');
            return [name, number];
          }
          return [name, value];
        }));
        payload.characteristics = normalizeCharacteristics(payload.characteristics);
        payload.variants = (payload.variants || []).map((variant) => ({ ...variant, priceRub: Number(variant.priceRub), characteristics: normalizeCharacteristics(variant.characteristics) }));
      }
      const body = { slug: edit.slug, title: edit.title, payload, published: edit.published, sortOrder: edit.sortOrder };
      const response = await fetch(api + '/content/' + section + (edit.id ? '/' + edit.id : ''), {
        method: edit.id ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить запись.');
      setNotice('Изменения сохранены.');
      if (section !== 'contacts') setEdit(null);
      load(section === 'contacts' ? edit.id : null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!confirm('Удалить «' + row.title + '»?')) return;
    const response = await fetch(api + '/content/' + section + '/' + row.id, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Не удалось удалить запись.');
      return;
    }
    load();
  }

  async function updateStatus(id, status) {
    const response = await fetch(api + '/requests/' + id, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) setError('Не удалось изменить статус.');
    else load();
  }

  async function uploadMedia(file) {
    setError('');
    setUploading(true);
    try {
      const response = await fetch(api + '/media', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить файл.');
      setMediaFiles((current) => [data, ...current]);
      setNotice('Файл загружен и добавлен к записи.');
      return data;
    } catch (uploadError) {
      setError(uploadError.message || 'Не удалось загрузить файл.');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(file) {
    if (!confirm(`Удалить файл «${file.name}»? Файл, который используется в записях, удалить нельзя.`)) return;
    setError('');
    try {
      const response = await fetch(`${api}/media/${file.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось удалить файл.');
      setMediaFiles((current) => current.filter((item) => item.id !== file.id));
      setNotice('Файл удалён из медиатеки.');
    } catch (deleteError) {
      setError(deleteError.message || 'Не удалось удалить файл.');
    }
  }

  const current = section === 'username' ? 'Смена логина' : section === 'password' ? 'Смена пароля' : modules.find(([id]) => id === section)?.[1] || 'Обзор';
  const isCreating = edit && !edit.id;

  return (
    <div className="admin-frame">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand sidebar-brand">
          <img src="/logo-reference.png" alt="" />
          <span>Уралмаш ГОО<small>Админ-панель</small></span>
        </a>
        <p className="nav-caption">Управление сайтом</p>
        <nav className="admin-nav" aria-label="Разделы админ-панели">
          <button className={'nav-item' + (section === 'overview' ? ' active' : '')} onClick={() => setSection('overview')}>Обзор</button>
          {modules.map(([id, label]) => <button key={id} className={'nav-item' + (section === id ? ' active' : '')} onClick={() => setSection(id)}>{label}</button>)}
          <button className={'nav-item' + (section === 'username' ? ' active' : '')} onClick={() => setSection('username')}>Смена логина</button>
          <button className={'nav-item' + (section === 'password' ? ' active' : '')} onClick={() => setSection('password')}>Смена пароля</button>
        </nav>
        <div className="sidebar-bottom"><span className="status-light" />Доступ: {username}</div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="crumb">Админ-панель <span>/</span> {current}</div>
          <div className="account"><span>{username}</span><button onClick={logout}>Выйти</button></div>
        </header>

        <div className="admin-content">
          <div className="page-heading">
            <div>
              <p className="admin-eyebrow">Управление сайтом</p>
              <h1>{current}</h1>
              <p>{section === 'username' ? 'Подтверждение по почте и смена логина администратора.' : section === 'password' ? 'Подтверждение по почте и смена пароля администратора.' : section === 'overview' ? 'Разделы для управления сайтом.' : section === 'requests' ? 'В заявках указаны тема обращения и страница, с которой его отправили.' : section === 'contacts' ? 'Контактные данные на сайте.' : 'Записи раздела «' + current + '».'}</p>
            </div>
            {editable.includes(section) && section !== 'contacts' && <button className="admin-primary add-button" onClick={() => open(null)}>Добавить запись</button>}
          </div>

          {error && <div className="form-error admin-message" role="alert">{error}</div>}
          {notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Закрыть уведомление">×</button></div>}

          {(section === 'password' || section === 'username') && <PasswordSettings key={section} mode={section} />}
          {section === 'privacy-policy' && <PrivacyPolicySettings />}

          {section === 'overview' && (
            <>
              <section className="setup-banner">
                <div className="banner-symbol">У</div>
                <div><span>ПАНЕЛЬ УПРАВЛЕНИЯ</span><h2>Контент сайта в одном месте</h2><p>Управляйте каталогом, направлениями, проектами и обращениями.</p></div>
                <div className="banner-line" />
              </section>
              <div className="module-grid">
                {modules.map(([id, label]) => <button className="module-card module-button" key={id} onClick={() => setSection(id)}><h3>{label}</h3><p>Открыть раздел</p></button>)}
              </div>
            </>
          )}

          {edit && (
            <form className="editor-card" onSubmit={save}>
              <div className="editor-card__heading">
                <div><h2>{section === 'contacts' ? 'Контактные данные' : isCreating ? 'Новая запись' : 'Редактирование'}</h2>{section !== 'contacts' && <p>Поля со звёздочкой обязательны.</p>}</div>
                {section !== 'contacts' && <button type="button" onClick={() => setEdit(null)}>Закрыть</button>}
              </div>
              {section !== 'contacts' && <section className="editor-group">
                <div className="editor-group__title"><h3>Основное</h3><p>Заголовок и адрес страницы записи.</p></div>
                <div className="editor-grid">
                  <FormField label="Название *" help="Отображается в заголовках и списках.">
                    <input required value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value, slug: isCreating ? slugify(event.target.value) : edit.slug })} />
                  </FormField>
                  <FormField label="Адрес страницы *" help="Латиницей, без пробелов. Используется в ссылке.">
                    <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={edit.slug} onChange={(event) => setEdit({ ...edit, slug: event.target.value })} />
                  </FormField>
                </div>
              </section>}

              {section === 'contacts' && rows.length > 1 && <FormField label="Контактные данные">
                <select value={edit.id || ''} onChange={(event) => open(rows.find((row) => row.id === Number(event.target.value)))}>
                  {rows.map((row) => <option key={row.id} value={row.id}>{row.title}{row.published ? '' : ' (черновик)'}</option>)}
                </select>
              </FormField>}
              <section className="editor-group">
                <StructuredFields
                  section={section}
                  edit={edit}
                  setEdit={setEdit}
                  categories={categories}
                  tags={tags}
                  specifications={specifications}
                  mediaFiles={mediaFiles}
                  onUpload={uploadMedia}
                  onDeleteMedia={deleteMedia}
                  onOpenCategory={(row, parentId) => { if (confirm('При переходе несохранённые изменения категории будут потеряны. Продолжить?')) open(row, parentId); }}
                />
              </section>

              {section !== 'contacts' && <section className="editor-group">
                <div className="editor-group__title"><h3>Публикация</h3><p>Черновики не отображаются на публичном сайте.</p></div>
                <label className="check-line">
                  <input type="checkbox" checked={edit.published} onChange={(event) => setEdit({ ...edit, published: event.target.checked })} />
                  <span><strong>Опубликовано</strong><small>Снимите отметку, чтобы сохранить запись как черновик.</small></span>
                </label>
                <FormField label="Порядок в списке" help="Чем меньше число, тем выше запись в списке.">
                  <input type="number" value={edit.sortOrder} onChange={(event) => setEdit({ ...edit, sortOrder: event.target.value })} />
                </FormField>
              </section>}
              {section === 'contacts' && <label className="check-line"><input type="checkbox" checked={edit.published} onChange={(event) => setEdit({ ...edit, published: event.target.checked })} /><span>Показывать на сайте</span></label>}

              <div className="editor-actions">
                <button className="admin-primary" disabled={busy || uploading}>{busy ? 'Сохраняем…' : uploading ? 'Загружается файл…' : 'Сохранить'}</button>
                {section !== 'contacts' && <button type="button" onClick={() => setEdit(null)}>Отмена</button>}
              </div>
            </form>
          )}

          {section === 'requests' && (
            <>
              {mailStatus && <div className={'mail-status mail-status--' + mailStatus.state} role="status">
                {mailStatus.state === 'disabled' && 'Почтовые уведомления выключены.'}
                {mailStatus.state === 'incomplete' && 'Почтовые уведомления включены, настройки SMTP заполнены не полностью. Новые уведомления сохранены в очереди.'}
                {mailStatus.state === 'retry_pending' && `Есть уведомления, ожидающие повторной отправки: ${mailStatus.count}.`}
                {mailStatus.state === 'ready' && 'Настройки уведомлений заполнены; ожидающих повторной отправки нет.'}
                {mailStatus.state === 'unknown' && 'Не удалось проверить состояние почтовых уведомлений.'}
              </div>}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Тип</th><th>Тема</th><th>Страница</th><th>Имя и телефон</th><th>Комментарий</th><th>Дата обращения</th><th>Статус</th></tr></thead>
                  <tbody>
                    {reqs.map((request) => (
                      <tr key={request.id}>
                        <td>{requestIntentLabel(request.intent)}</td>
                        <td>{request.subject_title || (request.intent === 'repair' ? 'Ремонт оборудования' : request.intent === 'project' ? 'Проектирование или изготовление' : request.intent === 'purchase' ? 'Оборудование' : 'Общий вопрос')}</td>
                        <td>{request.source_path ? <a href={request.source_path} target="_blank" rel="noreferrer">{request.source_path}</a> : '—'}</td>
                        <td><strong>{request.name}</strong><br />{request.phone}</td>
                        <td>{request.message ? <details><summary>Читать</summary><p>{request.message}</p></details> : '—'}</td>
                        <td>{new Date(request.created_at).toLocaleString('ru-RU')}</td>
                        <td><select aria-label={`Статус заявки от ${request.name}`} value={request.status} onChange={(event) => updateStatus(request.id, event.target.value)}><option>Новая</option><option>В работе</option><option>Обработана</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!reqs.length && <p className="empty-state">Обращений пока нет.</p>}
              </div>
            </>
          )}

          {editable.includes(section) && section !== 'contacts' && (
            <div className={'table-wrap' + (section === 'products' ? ' table-wrap--products' : '')}>
              <table>
                <thead><tr><th>Название</th><th>Адрес</th><th>Статус</th><th>Действия</th></tr></thead>
                <tbody>
                  {rows.filter((row) => section !== 'categories' || !row.payload?.parentId).map((row) => (
                    <tr key={row.id}>
                      <td className={section === 'products' ? 'table-wrap__product-title' : undefined} title={section === 'products' ? row.title : undefined}>{row.title}</td>
                      <td><code>{row.slug}</code></td>
                      <td>{row.published ? 'Опубликовано' : 'Черновик'}</td>
                      <td><button type="button" onClick={() => open(row)}>Изменить</button><button type="button" onClick={() => remove(row)}>Удалить</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="empty-state">Записей пока нет. Добавьте первую.</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
