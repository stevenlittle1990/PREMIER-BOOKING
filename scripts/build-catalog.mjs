// Before each build: pull areas, bays and published listings from Supabase into data/catalog.json,
// so every listing gets a real page Google can read. Falls back to the seed file with no database.
import { readFileSync, writeFileSync } from 'node:fs';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const out = new URL('../data/catalog.json', import.meta.url);
const seed = new URL('../data/catalog.seed.json', import.meta.url);

async function get(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

if (!url || !key) {
  writeFileSync(out, readFileSync(seed));
  console.log('catalog: no database settings, using seed data');
} else {
  try {
  const [areas, bays, listings] = await Promise.all([
    get('areas?select=*&published=eq.true&order=sort'),
    get('bay_systems?select=*&order=name'),
    get('listings?select=*&published=eq.true&order=created_at'),
  ]);
  writeFileSync(out, JSON.stringify({ areas, bays, listings, builtAt: new Date().toISOString() }));
  console.log(`catalog: ${areas.length} areas, ${bays.length} bays, ${listings.length} listings`);
  } catch (e) {
    // Never fail the deploy over this: pages still load live data in the browser.
    console.warn('catalog: database unreachable, using seed data:', e.message);
    writeFileSync(out, readFileSync(seed));
  }
}
