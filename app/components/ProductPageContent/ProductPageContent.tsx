'use client';

import CatalogPageStyles from '../CatalogPage/CatalogPage.module.css';
import ProductPageContentStyles from './ProductPageContent.module.css';
import { useEffect, useState } from 'react';
import ProductCard, { getProductImage, type ProductCategory, type ProductRecord, type ProductVariant } from '../ProductCard/ProductCard';
import { apiOrigin, publicApi } from '../../lib/api';
import { RequestButton } from '../RequestModal/RequestModal';
import type { FilterSpecification } from '../CatalogPage/CatalogPage';

type ProductPageData = {
  product: ProductRecord;
  variant: ProductVariant;
};

export type ProductPageInitialData = ProductPageData & {
  categories: ProductCategory[];
  products: ProductRecord[];
  specifications?: FilterSpecification[];
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU').format(price);
}

export default function ProductPage({ productSlug, variantSlug, initialData }: { productSlug: string; variantSlug: string; initialData?: ProductPageInitialData }) {
  const [data, setData] = useState<ProductPageData | null>(initialData || null);
  const [categories, setCategories] = useState<ProductCategory[]>(initialData?.categories || []);
  const [products, setProducts] = useState<ProductRecord[]>(initialData?.products || []);
  const [specifications, setSpecifications] = useState<FilterSpecification[]>(initialData?.specifications || []);
  const [hasError, setHasError] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    if (initialData) return;
    const controller = new AbortController();

    async function loadProduct() {
      try {
        const [productResponse, categoriesResponse, productsResponse, specificationsResponse] = await Promise.all([
          fetch(`${publicApi}/products/${encodeURIComponent(productSlug)}/variants/${encodeURIComponent(variantSlug)}`, { signal: controller.signal }),
          fetch(`${publicApi}/categories`, { signal: controller.signal }).catch(() => null),
          fetch(`${publicApi}/products`, { signal: controller.signal }).catch(() => null),
          fetch(`${publicApi}/specifications`, { signal: controller.signal }).catch(() => null),
        ]);
        if (!productResponse.ok) throw new Error('Товар не найден.');

        const [productData, allCategories, allProducts, allSpecifications] = await Promise.all([
          productResponse.json(),
          categoriesResponse?.ok ? categoriesResponse.json() : Promise.resolve([]),
          productsResponse?.ok ? productsResponse.json() : Promise.resolve([]),
          specificationsResponse?.ok ? specificationsResponse.json() : Promise.resolve([]),
        ]);

        setData(productData);
        setCategories(Array.isArray(allCategories) ? allCategories : []);
        setProducts(Array.isArray(allProducts) ? allProducts : []);
        setSpecifications(Array.isArray(allSpecifications) ? allSpecifications : []);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') setHasError(true);
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [initialData, productSlug, variantSlug]);

  if (hasError) {
    return (
      <main className={ProductPageContentStyles["product-page"]}>
        <div className={ProductPageContentStyles["product-page__inner"]}>
          <a className={"product-page__catalog-link" + " " + ProductPageContentStyles["product-page__catalog-link"]} href="/catalog/">Каталог</a>
          <h1>Товар не найден</h1>
          <p>Страница товара недоступна. Откройте каталог и выберите другую позицию.</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return <main className={ProductPageContentStyles["product-page"]}><p className={ProductPageContentStyles["product-page__message"]}>Загружаем страницу товара…</p></main>;
  }

  const { product, variant } = data;
  const category = categories.find((item) => product.categories?.includes(item.id));
  const selectedMedia = variant.media?.length ? variant.media : product.media || [];
  const media = selectedMedia.map((item) => {
    const url = typeof item === 'string' ? item : item.url || '';
    return url.startsWith('/') ? `${apiOrigin}${url}` : url;
  }).filter(Boolean);
  if (!media.length) {
    const fallback = getProductImage(product, variant);
    if (fallback) media.push(fallback);
  }
  const currentIndex = mediaIndex % (media.length || 1);
  const currentMedia = media[currentIndex];
  const seenProductIds = new Set<number>([product.id]);
  const seenProductSlugs = new Set([product.slug]);
  const similarProducts = products.filter((item) => {
    if (seenProductIds.has(item.id) || seenProductSlugs.has(item.slug) || !item.categories?.some((id) => product.categories?.includes(id)) || !getProductImage(item)) return false;
    seenProductIds.add(item.id);
    seenProductSlugs.add(item.slug);
    return true;
  }).slice(0, 3);
  const namedVariants = (product.variants || []).filter((item) => {
    const name = item.name?.trim();
    return name && name.toLocaleLowerCase('ru').replace(/\s+/g, '-') !== item.slug.toLocaleLowerCase('ru');
  });
  const characteristics = Object.entries(variant.characteristics || product.characteristics || {})
    .filter(([, value]) => value !== null && value !== '');

  return (
    <main className={ProductPageContentStyles["product-page"]}>
      <div className={ProductPageContentStyles["product-page__inner"]}>
        <a className={"product-page__catalog-link" + " " + ProductPageContentStyles["product-page__catalog-link"]} href="/catalog/">Каталог</a>
        <div className={ProductPageContentStyles["product-page__layout"]}>
          <div className={ProductPageContentStyles["product-page__media"]}>
            {currentMedia && (/\.(mp4|webm)(\?|$)/i.test(currentMedia)
              ? <video key={currentMedia} className={ProductPageContentStyles["product-page__image"]} src={currentMedia} controls preload="metadata" aria-label={`Видео: ${product.title}`} />
              : <img className={ProductPageContentStyles["product-page__image"]} src={currentMedia} alt={`${product.title}, фото ${currentIndex + 1}`} />)}
            {media.length > 1 && <div className={ProductPageContentStyles["product-page__media-controls"]}>
              <button type="button" aria-label="Предыдущее фото или видео" onClick={() => setMediaIndex((currentIndex + media.length - 1) % media.length)}>‹</button>
              <span aria-live="polite">{currentIndex + 1} / {media.length}</span>
              <button type="button" aria-label="Следующее фото или видео" onClick={() => setMediaIndex((currentIndex + 1) % media.length)}>›</button>
            </div>}
          </div>
          <section className={ProductPageContentStyles["product-page__summary"]} aria-labelledby="product-title">
            {category && <p className={ProductPageContentStyles["product-page__category"]}>{category.title}</p>}
            <h1 id="product-title">{product.title}</h1>
            {variant.priceRub != null && (
              <p className={ProductPageContentStyles["product-page__price"]}>от {formatPrice(variant.priceRub)} ₽</p>
            )}
            {product.description && <p className={ProductPageContentStyles["product-page__description"]}>{product.description}</p>}
            <RequestButton className={ProductPageContentStyles["product-page__contact"]} intent="purchase" productSlug={product.slug} variantSlug={variant.slug}>Уточнить наличие</RequestButton>

            {namedVariants.length > 1 && (
              <nav className={ProductPageContentStyles["product-page__variants"]} aria-label="Варианты исполнения">
                <p>Исполнение</p>
                <ul>
                  {namedVariants.map((item) => (
                    <li key={item.slug}>
                      {item.slug === variant.slug
                        ? <span aria-current="page">{item.name}</span>
                        : <a href={`/catalog/product/${encodeURIComponent(product.slug)}/${encodeURIComponent(item.slug)}`}>{item.name}</a>}
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {characteristics.length > 0 && (
              <dl className={ProductPageContentStyles["product-page__facts"]}>
                {characteristics.map(([name, value]) => (
                  <div className={ProductPageContentStyles["product-page__fact"]} key={name}>
                    <dt>{name}</dt>
                    <dd>{value && typeof value === 'object' ? `${value.min}–${value.max}` : String(value)}{specifications.find((item) => item.title === name)?.payload?.unit ? ` ${specifications.find((item) => item.title === name)?.payload?.unit}` : ''}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
        {similarProducts.length > 0 && (
          <section className={ProductPageContentStyles["product-page__related"]} aria-labelledby="product-related-title">
            <h2 id="product-related-title">Похожие товары</h2>
            <div className={"catalog-page__grid" + " " + CatalogPageStyles["catalog-page__grid"]}>
              {similarProducts.map((item) => {
                const sharedCategory = categories.find((itemCategory) =>
                  product.categories?.includes(itemCategory.id) && item.categories?.includes(itemCategory.id));
                return <ProductCard key={item.id} product={item} category={sharedCategory} />;
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
