'use client';

import FeaturedProductsStyles from './FeaturedProducts.module.css';
import ServicesPageStyles from '../ServicesPage/ServicesPage.module.css';
import { useEffect, useState } from 'react';
import ProductCard, { getProductImage, type ProductCategory, type ProductRecord } from '../ProductCard/ProductCard';
import { publicApi } from '../../lib/api';

export default function FeaturedProducts({ showCatalogFallback = false, initialProducts, initialCategories }: { showCatalogFallback?: boolean; initialProducts?: ProductRecord[]; initialCategories?: ProductCategory[] }) {
  const [products, setProducts] = useState<ProductRecord[] | null>(initialProducts === undefined ? null : initialProducts.filter((product) => product.featuredOnHome && getProductImage(product)).slice(0, 6));
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories || []);

  useEffect(() => {
    if (initialProducts !== undefined) return;
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(`${publicApi}/products`, { signal: controller.signal }),
          fetch(`${publicApi}/categories`, { signal: controller.signal }).catch(() => null),
        ]);
        if (!productsResponse.ok) throw new Error('Не удалось загрузить товары.');

        const [allProducts, allCategories] = await Promise.all([
          productsResponse.json(),
          categoriesResponse?.ok ? categoriesResponse.json() : Promise.resolve([]),
        ]);

        setCategories(Array.isArray(allCategories) ? allCategories : []);
        setProducts(Array.isArray(allProducts)
          ? allProducts.filter((product: ProductRecord) => product.featuredOnHome && getProductImage(product)).slice(0, 6)
          : []);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') setProducts([]);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [initialProducts]);

  if (!products?.length) return showCatalogFallback ? (
    <section className={"services-page__catalog-link" + " " + FeaturedProductsStyles["services-page__catalog-link"]} aria-labelledby="services-catalog-heading">
      <p className={"services-page__eyebrow" + " " + ServicesPageStyles["services-page__eyebrow"]}>ОБОРУДОВАНИЕ</p>
      <h2 id="services-catalog-heading">Оборудование в каталоге</h2>
      <a href="/catalog/">Перейти в каталог</a>
    </section>
  ) : null;

  return (
    <section className={"featured-products" + " " + FeaturedProductsStyles["featured-products"]} id="catalog" aria-labelledby="featured-products-heading">
      <h2 className={"featured-products__heading" + " " + FeaturedProductsStyles["featured-products__heading"]} id="featured-products-heading">Оборудование</h2>
      <div className={FeaturedProductsStyles["featured-products__grid"]}>
        {products.map((product) => {
          const category = categories.find((item) => product.categories?.includes(item.id));
          return <ProductCard key={product.id} product={product} category={category} />;
        })}
      </div>
      <div className={FeaturedProductsStyles["featured-products__footer"]}>
        <a className={FeaturedProductsStyles["featured-products__catalog"]} href="/catalog/">
          Весь каталог
        </a>
      </div>
    </section>
  );
}
