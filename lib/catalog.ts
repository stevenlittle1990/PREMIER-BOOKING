import raw from '../data/catalog.json';
import type { Area, BaySystem, Catalog, Listing } from './types';

// Built into the site at deploy time (see scripts/build-catalog.mjs). Live data comes from Supabase on top.
export const catalog = raw as unknown as Catalog;

export const areaBySlug = (slug: string): Area | undefined => catalog.areas.find((a) => a.slug === slug);
export const areaById = (id: string): Area | undefined => catalog.areas.find((a) => a.id === id);
export const bayById = (id: string | null): BaySystem | undefined =>
  id ? catalog.bays.find((b) => b.id === id) : undefined;
export const baysForArea = (areaId: string) => catalog.bays.filter((b) => b.area_id === areaId);
export const listingBySlug = (slug: string): Listing | undefined => catalog.listings.find((l) => l.slug === slug);
