'use client';

import CatalogPageStyles from './CatalogPage.module.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard, { getProductImage, type ProductCategory, type ProductRecord } from '../ProductCard/ProductCard';
import { publicApi } from '../../lib/api';

export type FilterSpecification = {
  id: number;
  title: string;
  payload?: { valueType?: 'text' | 'number' | 'range'; unit?: string; filterMode?: 'values' | 'range' };
};
export type CategoryRecord = ProductCategory & { payload?: { parentId?: number | null; filterSpecificationIds?: number[] } };
export type CatalogInitialData = { products: ProductRecord[]; categories: CategoryRecord[]; specifications: FilterSpecification[] };
type RangeValue = { min: string; max: string };

function categoryTree(categories: CategoryRecord[]) {
  const children = new Map<number | null, CategoryRecord[]>();
  categories.forEach((category) => {
    const parentId = category.payload?.parentId ?? null;
    children.set(parentId, [...(children.get(parentId) || []), category]);
  });
  const rows: Array<{ category: CategoryRecord; level: number }> = [];
  const visit = (parentId: number | null, level: number, visited: Set<number>) => {
    (children.get(parentId) || []).forEach((category) => {
      if (visited.has(category.id)) return;
      rows.push({ category, level });
      const nextVisited = new Set(visited).add(category.id);
      visit(category.id, level + 1, nextVisited);
    });
  };
  visit(null, 0, new Set());
  categories.filter((category) => !rows.some((row) => row.category.id === category.id)).forEach((category) => rows.push({ category, level: 0 }));
  return rows;
}

function descendantsOf(categoryId: number, categories: CategoryRecord[]) {
  const result = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    categories.forEach((category) => {
      if (category.payload?.parentId != null && result.has(category.payload.parentId) && !result.has(category.id)) {
        result.add(category.id);
        changed = true;
      }
    });
  }
  return result;
}

function valuesOf(product: ProductRecord, title: string) {
  const variants = product.variants?.length ? product.variants : [{ characteristics: product.characteristics || {} }];
  return variants.map((variant) => variant.characteristics?.[title]).filter((value) => value !== null && value !== undefined && value !== '');
}

export default function CatalogPage({ initialData, initialError = false }: { initialData?: CatalogInitialData; initialError?: boolean }) {
  const [products, setProducts] = useState<ProductRecord[] | null>(initialData?.products || null);
  const [categories, setCategories] = useState<CategoryRecord[]>(initialData?.categories || []);
  const [specifications, setSpecifications] = useState<FilterSpecification[]>(initialData?.specifications || []);
  const [hasError, setHasError] = useState(initialError);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const [ranges, setRanges] = useState<Record<string, RangeValue>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allFiltersOpen, setAllFiltersOpen] = useState(false);
  const [enteringIds, setEnteringIds] = useState<number[]>([]);
  const previousProductIds = useRef<number[]>([]);

  useEffect(() => {
    if (initialData || initialError) return;
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const [productsResponse, categoriesResponse, specificationsResponse] = await Promise.all([
          fetch(`${publicApi}/products`, { signal: controller.signal }),
          fetch(`${publicApi}/categories`, { signal: controller.signal }).catch(() => null),
          fetch(`${publicApi}/specifications`, { signal: controller.signal }).catch(() => null),
        ]);
        if (!productsResponse.ok) throw new Error('Не удалось загрузить товары.');

        const [allProducts, allCategories, allSpecifications] = await Promise.all([
          productsResponse.json(),
          categoriesResponse?.ok ? categoriesResponse.json() : Promise.resolve([]),
          specificationsResponse?.ok ? specificationsResponse.json() : Promise.resolve([]),
        ]);

        setProducts(Array.isArray(allProducts)
          ? allProducts.filter((product: ProductRecord) => getProductImage(product))
          : []);
        setCategories(Array.isArray(allCategories) ? allCategories : []);
        setSpecifications(Array.isArray(allSpecifications) ? allSpecifications : []);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setHasError(true);
          setProducts([]);
        }
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [initialData, initialError]);

  const scopedCategoryIds = useMemo(() => {
    if (!selectedCategories.length) return new Set(categories.map((category) => category.id));
    return new Set(selectedCategories.flatMap((id) => [...descendantsOf(id, categories)]));
  }, [categories, selectedCategories]);

  const categoryProducts = useMemo(() => (products || []).filter((product) => !selectedCategories.length ||
    (product.categories || []).some((id) => scopedCategoryIds.has(id))), [products, scopedCategoryIds, selectedCategories]);

  const activeSpecifications = useMemo(() => {
    const seenTitles = new Set<string>();
    return specifications.filter((specification) => {
      if (seenTitles.has(specification.title) || !categoryProducts.some((product) => valuesOf(product, specification.title).length)) return false;
      seenTitles.add(specification.title);
      return true;
    });
  }, [specifications, categoryProducts]);

  const rangeSpecifications = useMemo(() => new Set(specifications.filter((specification) =>
    specification.payload?.valueType === 'range' || (specification.payload?.valueType === 'number' &&
      (specification.payload?.filterMode === 'range' || (products || []).some((product) => valuesOf(product, specification.title).some((value) => typeof value === 'object' && value !== null))))
  ).map((specification) => specification.title)), [products, specifications]);

  useEffect(() => {
    const availableValues = new Map(activeSpecifications.map((specification) => [
      specification.title,
      new Set(categoryProducts.flatMap((product) => valuesOf(product, specification.title).map(String))),
    ]));
    setSelectedValues((current) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      Object.entries(current).forEach(([title, selected]) => {
        const options = availableValues.get(title);
        const retained = options && !rangeSpecifications.has(title) ? selected.filter((value) => options.has(value)) : [];
        if (!options || retained.length !== selected.length) changed = true;
        if (retained.length) next[title] = retained;
      });
      return changed ? next : current;
    });
    const availableTitles = new Set(availableValues.keys());
    setRanges((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([title]) => availableTitles.has(title)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [activeSpecifications, categoryProducts, rangeSpecifications]);

  const filteredProducts = useMemo(() => categoryProducts.filter((product) => {
    const variants = product.variants?.length ? product.variants : [{ characteristics: product.characteristics || {} }];
    const matchesVariant = variants.some((variant) => activeSpecifications.every((specification) => {
      const selected = selectedValues[specification.title] || [];
      const range = ranges[specification.title] || { min: '', max: '' };
      const value = variant.characteristics?.[specification.title];
      if (value === null || value === undefined || value === '') return !selected.length && !range.min && !range.max;
      if (selected.length && !selected.includes(String(value))) return false;
      if (range.min || range.max) {
        const min = typeof value === 'number' ? value : typeof value === 'object' ? value.min : null;
        const max = typeof value === 'number' ? value : typeof value === 'object' ? value.max : null;
        if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return false;
        if (range.min && max < Number(range.min)) return false;
        if (range.max && min > Number(range.max)) return false;
      }
      return true;
    }));
    if (!matchesVariant) return false;

    const categoryTitles = categories.filter((item) => (product.categories || []).includes(item.id)).map((item) => item.title);
    const searchable = [product.title, product.description, ...categoryTitles, ...Object.values(product.characteristics || {})]
      .filter((value) => value !== null && value !== undefined)
      .join(' ')
      .toLocaleLowerCase('ru');
    return searchable.includes(search.trim().toLocaleLowerCase('ru'));
  }).sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title, 'ru');
    if (sort === 'price-asc' || sort === 'price-desc') {
      const price = (product: ProductRecord) => product.priceFromRub ?? product.variants?.reduce<number | null>((lowest, variant) =>
        typeof variant.priceRub === 'number' ? (lowest === null ? variant.priceRub : Math.min(lowest, variant.priceRub)) : lowest, null) ?? null;
      const aPrice = price(a);
      const bPrice = price(b);
      if (aPrice === null) return bPrice === null ? 0 : 1;
      if (bPrice === null) return -1;
      return sort === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
    }
    return 0;
  }), [activeSpecifications, categoryProducts, categories, ranges, search, selectedValues, sort]);

  useEffect(() => {
    const nextIds = filteredProducts.map((product) => product.id);
    const previousIds = previousProductIds.current;
    const changed = nextIds.length !== previousIds.length || nextIds.some((id, index) => id !== previousIds[index]);
    previousProductIds.current = nextIds;
    if (!changed || !nextIds.length) {
      setEnteringIds([]);
      return;
    }
    setEnteringIds(nextIds);
    const timer = window.setTimeout(() => setEnteringIds([]), 650);
    return () => window.clearTimeout(timer);
  }, [filteredProducts]);

  const categoryRows = useMemo(() => categoryTree(categories), [categories]);
  const toggleCategory = (categoryId: number) => setSelectedCategories((current) => current.includes(categoryId)
    ? current.filter((id) => id !== categoryId)
    : [...current, categoryId]);
  const toggleValue = (title: string, value: string) => setSelectedValues((current) => {
    const values = current[title] || [];
    return { ...current, [title]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
  });
  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedValues({});
    setRanges({});
  };
  const hasActiveFilters = selectedCategories.length > 0 || Object.values(selectedValues).some((values) => values.length > 0) || Object.values(ranges).some((range) => range.min || range.max);
  const activeFilterCount = selectedCategories.length + Object.values(selectedValues).reduce((total, values) => total + values.length, 0) + Object.values(ranges).filter((range) => range.min || range.max).length;

  return (
    <main className={CatalogPageStyles["catalog-page"]}>
      <header className={CatalogPageStyles["catalog-page__header"]}>
        <div className={CatalogPageStyles["catalog-page__heading"]}>
          <a className={CatalogPageStyles["catalog-page__home"]} href="/">На главную</a>
          <h1>Каталог оборудования</h1>
          <p>Каталог оборудования для дробления, сортировки и обогащения. Используйте поиск и фильтры, чтобы найти подходящую позицию; характеристики, комплектацию и стоимость можно уточнить по запросу.</p>
        </div>
      </header>

      {products === null ? (
        <p className={CatalogPageStyles["catalog-page__message"]}>Загружаем каталог…</p>
      ) : hasError ? (
        <p className={CatalogPageStyles["catalog-page__message"]}>Не удалось загрузить каталог.</p>
      ) : products.length ? (
        <>
          <div className={CatalogPageStyles["catalog-page__controls"]}>
            <label className={CatalogPageStyles["catalog-page__search"]}>
              <span>Поиск по товарам</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, описание или категория" />
            </label>
            <label className={CatalogPageStyles["catalog-page__sort"]}>
              <span>Сортировка</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="default">По умолчанию</option>
                <option value="title">По названию</option>
                <option value="price-asc">Сначала дешевле</option>
                <option value="price-desc">Сначала дороже</option>
              </select>
            </label>
          </div>
          <button className={CatalogPageStyles["catalog-page__mobile-filter-toggle"]} type="button" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen((open) => !open)}>
            Фильтры <span>{activeFilterCount}</span>
          </button>
          <div className={CatalogPageStyles["catalog-page__body"]}>
            <aside id="catalog-filters" className={[CatalogPageStyles["catalog-page__filters"], filtersOpen ? CatalogPageStyles["catalog-page__filters--open"] : ''].filter(Boolean).join(' ')} aria-label="Фильтры каталога">
              <div className={CatalogPageStyles["catalog-page__filters-head"]}>
                <div><h2>Фильтры</h2><span>{activeFilterCount ? `Выбрано: ${activeFilterCount}` : 'Уточните параметры'}</span></div>
                {hasActiveFilters && <button className={CatalogPageStyles["catalog-page__clear"]} type="button" onClick={clearFilters}>Сбросить</button>}
              </div>
              {categoryRows.length > 0 && <details className={CatalogPageStyles["catalog-page__filter-group"]} open>
                <summary>Категории <span>{selectedCategories.length || 'Все'}</span></summary>
                <div className={CatalogPageStyles["catalog-page__filter-options"]} role="group" aria-label="Категории">
                  {categoryRows.map(({ category, level }) => <label className={CatalogPageStyles["catalog-page__option"]} key={category.id} style={{ paddingLeft: `${level * 16}px` }}>
                    <input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggleCategory(category.id)} />
                    <span>{category.title}</span>
                  </label>)}
                </div>
              </details>}
              {activeSpecifications.length > 0 && <button
                className={CatalogPageStyles["catalog-page__show-filters"]}
                type="button"
                aria-expanded={allFiltersOpen}
                onClick={() => setAllFiltersOpen((open) => !open)}
              >
                {allFiltersOpen ? 'Скрыть фильтры' : `Показать все фильтры (${activeSpecifications.length})`}
              </button>}
              {allFiltersOpen && activeSpecifications.map((specification) => {
                const values = [...new Set(categoryProducts.flatMap((product) => valuesOf(product, specification.title).map(String)))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
                const selectedRange = ranges[specification.title];
                const selectedCount = (selectedValues[specification.title]?.length || 0) + Number(Boolean(selectedRange?.min)) + Number(Boolean(selectedRange?.max));
                const label = `${specification.title}${specification.payload?.unit ? `, ${specification.payload.unit}` : ''}`;
                return <details className={CatalogPageStyles["catalog-page__filter-group"]} key={specification.id}>
                  <summary>{label}<span>{selectedCount || ''}</span></summary>
                  {rangeSpecifications.has(specification.title) ? (
                    <div className={CatalogPageStyles["catalog-page__range"]}>
                      <label><span>От</span><input aria-label={`${label}: от`} type="number" value={ranges[specification.title]?.min || ''} onChange={(event) => setRanges((current) => ({ ...current, [specification.title]: { ...current[specification.title], min: event.target.value, max: current[specification.title]?.max || '' } }))} /></label>
                      <label><span>До</span><input aria-label={`${label}: до`} type="number" value={ranges[specification.title]?.max || ''} onChange={(event) => setRanges((current) => ({ ...current, [specification.title]: { ...current[specification.title], min: current[specification.title]?.min || '', max: event.target.value } }))} /></label>
                    </div>
                  ) : values.length ? <div className={CatalogPageStyles["catalog-page__filter-options"]}>{values.map((value) => <label className={CatalogPageStyles["catalog-page__option"]} key={value}>
                    <input type="checkbox" checked={(selectedValues[specification.title] || []).includes(value)} onChange={() => toggleValue(specification.title, value)} />
                    <span>{value}</span>
                  </label>)}</div> : <small className={CatalogPageStyles["catalog-page__filter-empty"]}>Значений пока нет.</small>}
                </details>;
              })}
            </aside>
            <section className={CatalogPageStyles["catalog-page__results"]} aria-label="Товары каталога">
              <div className={CatalogPageStyles["catalog-page__results-head"]}><p aria-live="polite" aria-atomic="true">Найдено: {filteredProducts.length}</p></div>
              {filteredProducts.length ? (
                <div className={"catalog-page__grid" + " " + CatalogPageStyles["catalog-page__grid"]}>
                  {filteredProducts.map((product, index) => {
                    const category = categories.find((item) => (product.categories || []).includes(item.id));
                    const enters = enteringIds.includes(product.id);
                    return <div className={[CatalogPageStyles["catalog-page__item"], enters ? CatalogPageStyles["catalog-page__item--entering"] : ''].filter(Boolean).join(' ')} style={enters ? { animationDelay: `${Math.min(index, 7) * 42}ms` } : undefined} key={product.id}>
                      <ProductCard product={product} category={category} />
                    </div>;
                  })}
                </div>
              ) : (
                <p className={CatalogPageStyles["catalog-page__message"]}>По выбранным условиям ничего не найдено.</p>
              )}
            </section>
          </div>
        </>
      ) : (
        <p className={CatalogPageStyles["catalog-page__message"]}>В каталоге пока нет опубликованных товаров с фотографиями.</p>
      )}
    </main>
  );
}
