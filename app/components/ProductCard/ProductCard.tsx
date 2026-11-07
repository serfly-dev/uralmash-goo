import ProductCardStyles from './ProductCard.module.css';
import { apiOrigin } from '../../lib/api';

export type ProductMedia = string | { url?: string };

export type CharacteristicValue = string | number | boolean | null | { min: number; max: number };

export type ProductVariant = {
  slug: string;
  href?: string;
  name?: string;
  priceRub?: number;
  article?: string;
  media?: ProductMedia[];
  characteristics?: Record<string, CharacteristicValue>;
};

export type ProductRecord = {
  id: number;
  slug: string;
  title: string;
  description?: string;
  featuredOnHome?: boolean;
  priceFromRub?: number | null;
  media?: ProductMedia[];
  characteristics?: Record<string, CharacteristicValue>;
  categories?: number[];
  variants?: ProductVariant[];
};

export type ProductCategory = {
  id: number;
  title: string;
};

function mediaUrl(item: ProductMedia) {
  const url = typeof item === 'string' ? item : item.url || '';
  return url.startsWith('/') ? `${apiOrigin}${url}` : url;
}

export function getProductImage(product: ProductRecord, variant?: ProductVariant) {
  const media = [
    ...(variant?.media || []),
    ...(product.media || []),
    ...(product.variants || []).flatMap((item) => item.media || []),
  ];

  return media.map(mediaUrl).find(Boolean) || '';
}

type ProductCardProps = {
  product: ProductRecord;
  category?: ProductCategory;
};

export default function ProductCard({ product, category }: ProductCardProps) {
  const variant = product.variants?.[0];
  const href = variant
    ? `/catalog/product/${encodeURIComponent(product.slug)}/${encodeURIComponent(variant.slug)}`
    : '/catalog/';
  const image = getProductImage(product, variant);
  const price = product.priceFromRub ?? product.variants?.reduce<number | null>((lowest, item) =>
    typeof item.priceRub === 'number' ? (lowest === null ? item.priceRub : Math.min(lowest, item.priceRub)) : lowest, null);

  return (
    <a className={ProductCardStyles["featured-product"]} href={href} aria-label={`Открыть товар: ${product.title}`}>
      <div className={ProductCardStyles["featured-product__image"]}>
        {image && <img src={image} alt={product.title} loading="lazy" decoding="async" />}
      </div>
      <div className={ProductCardStyles["featured-product__content"]}>
        {category && <span className={ProductCardStyles["featured-product__category"]}>{category.title}</span>}
        <h2 className={ProductCardStyles["featured-product__title"]}>{product.title}</h2>
        <span className={ProductCardStyles["featured-product__link"]}>Подробнее</span>
        {price != null && <span className={ProductCardStyles["featured-product__price"]}>от {new Intl.NumberFormat('ru-RU').format(price)} ₽</span>}
      </div>
    </a>
  );
}
