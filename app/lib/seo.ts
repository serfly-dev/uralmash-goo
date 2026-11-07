import { getSiteUrl } from './server-public-data';

function limit(value: string, length: number) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length <= length) return clean;
  const shortened = clean.slice(0, length - 1);
  return `${shortened.slice(0, shortened.lastIndexOf(' ') > length / 2 ? shortened.lastIndexOf(' ') : length - 1).trim()}…`;
}

export function publicMetadata(title: string, description: string, path: string) {
  const siteUrl = getSiteUrl();
  const url = siteUrl ? `${siteUrl}${path}` : undefined;
  const image = siteUrl ? `${siteUrl}/seo-preview.jpg` : '/seo-preview.jpg';
  const shortTitle = limit(title, 60);
  const shortDescription = limit(description, 160);
  return {
    title: shortTitle,
    description: shortDescription,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: shortTitle, description: shortDescription, url, type: 'website' as const, siteName: 'Уралмаш ГОО', locale: 'ru_RU', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image' as const, title: shortTitle, description: shortDescription, images: [image] },
  };
}
