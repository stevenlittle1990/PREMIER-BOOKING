import type { Listing } from './types';

export const money = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const priceLabel = (l: Pick<Listing, 'price_cents' | 'price_unit'>) =>
  l.price_cents <= 0 ? 'Ask for price' :
  `${money(l.price_cents)} / ${l.price_unit === 'night' ? 'night' : l.price_unit === 'person' ? 'person' : 'trip'}`;

export const listingPath = (l: Pick<Listing, 'kind' | 'slug'>) => (l.kind === 'stay' ? `/stays/${l.slug}` : `/trips/${l.slug}`);

// Dates are plain YYYY-MM-DD strings everywhere so time zones never shift a day.
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const nightsBetween = (a: string, b: string) =>
  Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
export const niceDate = (s: string) =>
  parseIso(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://premier-booking.netlify.app';
