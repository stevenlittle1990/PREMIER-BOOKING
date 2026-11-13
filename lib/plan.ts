import type { Category, Listing } from './types';

// "Plan a trip for me": turns a few tapped answers into ready-made trip plans built from the real listings.
// No AI service yet; the rules below cover the common trips. Plans never show prices.

export type Who = 'couple' | 'family' | 'friends' | 'big';
export type Like = 'fish' | 'relax' | 'beach' | 'wildlife';

export const WHO: Record<Who, { label: string; note: string; guests: number }> = {
  couple: { label: 'Just us two', note: 'A couple or a pair of friends', guests: 2 },
  family: { label: 'Family with kids', note: 'Easy days, nothing too long', guests: 5 },
  friends: { label: 'Group of friends', note: 'Fishing and time on the water', guests: 4 },
  big: { label: 'Big group', note: 'Company trip, reunion, a whole crew', guests: 10 },
};

export const LIKES: Record<Like, { label: string; icon: string }> = {
  fish: { label: 'Catch some fish', icon: 'fish-outline' },
  relax: { label: 'Relax on the water', icon: 'sunny-outline' },
  beach: { label: 'Beach and island', icon: 'umbrella-outline' },
  wildlife: { label: 'Birds and wildlife', icon: 'binoculars-outline' },
};

export type Answers = { area: string; who: Who; guests: number; likes: Like[]; from: string; nights: number; stay: boolean; flexible: boolean };
export type PlanItem = { listing: Listing; day: number; time: string | null };
export type Plan = { key: string; name: string; blurb: string; stay: Listing | null; items: PlanItem[] };

const EVENING: Category[] = ['sunset_cruise'];

// Best-first order of activities for each thing people say they like, adjusted for who's coming.
function wanted(like: Like, who: Who): string[] {
  switch (like) {
    case 'fish':
      if (who === 'family') return ['inshore-bay-fishing', 'jetty-and-drift-fishing'];
      if (who === 'big') return ['inshore-bay-fishing', 'jetty-and-drift-fishing', 'wade-fishing-the-flats'];
      return ['inshore-bay-fishing', 'wade-fishing-the-flats', 'jetty-and-drift-fishing'];
    case 'relax': return ['sunset-bay-cruise', 'matagorda-island-beach-cruise'];
    case 'beach': return ['matagorda-island-beach-cruise', 'island-tour'];
    case 'wildlife': return ['coastal-bird-watching', 'island-tour'];
  }
}

// Category fallbacks, so a plan still works when listings are renamed or new ones are added.
const LIKE_CATS: Record<Like, Category[]> = {
  fish: ['fishing'], relax: ['sunset_cruise', 'beach_cruise'], beach: ['beach_cruise', 'island_tour'], wildlife: ['bird_watching', 'island_tour'],
};

function pick(trips: Listing[], like: Like, who: Who, used: Set<string>): Listing | null {
  for (const slug of wanted(like, who)) {
    const l = trips.find((t) => t.slug === slug && !used.has(t.id));
    if (l) return l;
  }
  // Wading the flats isn't a kids' trip, so a family never gets it unless they swap it in themselves.
  return trips.find((t) => LIKE_CATS[like].includes(t.category) && !used.has(t.id) && !(who === 'family' && t.slug === 'wade-fishing-the-flats')) ?? null;
}

// Lay activities out over the stay: day trips in the mornings after arrival, sunset cruises in the evenings.
function schedule(list: Listing[], a: Answers): PlanItem[] {
  const days = a.stay ? Math.max(1, a.nights) : 1;
  const dayFree = Array.from({ length: days + 1 }, (_, i) => (a.stay ? i >= 1 : i === 0));
  const eveFree = Array.from({ length: days + 1 }, (_, i) => (a.stay ? i < days : i === 0));
  const out: PlanItem[] = [];
  for (const l of list) {
    const evening = EVENING.includes(l.category);
    const slots = evening ? eveFree : dayFree;
    // Evenings fill from the arrival night, day trips from the first morning after arriving.
    const day = slots.indexOf(true);
    if (day < 0) continue;
    slots[day] = false;
    out.push({ listing: l, day, time: l.start_times[0] ?? null });
  }
  return out.sort((x, y) => x.day - y.day || (EVENING.includes(x.listing.category) ? 1 : -1));
}

export function makePlans(listings: Listing[], a: Answers): Plan[] {
  const inArea = listings.filter((l) => l.area_id === a.area);
  const here = inArea.length ? inArea : listings;
  const trips = here.filter((l) => l.kind === 'trip');
  const stay = a.stay ? here.filter((l) => l.kind === 'stay').sort((x, y) => Math.abs(x.max_guests - a.guests) - Math.abs(y.max_guests - a.guests))[0] ?? null : null;
  // Enough to fill the trip without packing every hour: about one thing a day plus one evening out.
  const room = a.stay ? Math.min(5, Math.max(1, a.nights) + 1) : 2;

  const build = (key: string, name: string, blurb: string, likes: Like[]): Plan | null => {
    const used = new Set<string>();
    const chosen: Listing[] = [];
    // Round-robin through the likes so each gets a turn before any gets a second activity.
    for (let round = 0; round < 3 && chosen.length < room; round++) {
      for (const like of likes) {
        if (chosen.length >= room) break;
        const l = pick(trips, like, a.who, used);
        if (l) { used.add(l.id); chosen.push(l); }
      }
    }
    const items = schedule(chosen, a);
    return items.length || stay ? { key, name, blurb, stay, items } : null;
  };

  const likes = a.likes.length ? a.likes : (['fish', 'relax', 'beach'] as Like[]);
  const candidates = [
    build('yours', 'Built around your picks', 'The things you said you like, spread over your stay.', likes),
    build('fishing', 'Fishing trip', 'Mornings on the bay with a local guide, a sunset cruise to wind down.', ['fish', 'fish', 'relax']),
    build('easy', 'Easy coast getaway', 'No early alarms: a beach day on the island and an evening on the water.', ['beach', 'relax', 'wildlife']),
    build('sampler', 'A little of everything', 'One of each, so everyone in the group gets their thing.', ['fish', 'beach', 'relax', 'wildlife']),
  ].filter((p): p is Plan => Boolean(p));

  // Drop plans that came out the same as an earlier one, keep the best three.
  const seen = new Set<string>();
  return candidates.filter((p) => {
    const sig = p.items.map((i) => i.listing.id).sort().join(',');
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  }).slice(0, 3);
}

// Other activities that could take an item's place on the same day.
export function swapOptions(listings: Listing[], plan: Plan, item: PlanItem): Listing[] {
  const inPlan = new Set(plan.items.map((i) => i.listing.id));
  const evening = EVENING.includes(item.listing.category);
  return listings.filter((l) => l.kind === 'trip' && l.area_id === item.listing.area_id && !inPlan.has(l.id)
    && EVENING.includes(l.category) === evening);
}

export function boatsNeeded(l: Listing, guests: number) {
  return l.max_guests > 0 ? Math.ceil(guests / l.max_guests) : 1;
}

// Compact form for the address bar, so a plan survives signing in partway through.
export const encodeItems = (items: PlanItem[]) => items.map((i) => `${i.listing.slug}~${i.day}`).join(',');
export function decodeItems(s: string, listings: Listing[]): PlanItem[] {
  return s.split(',').map((part): PlanItem | null => {
    const [slug, day] = part.split('~');
    const listing = listings.find((l) => l.slug === slug);
    return listing ? { listing, day: Number(day) || 0, time: listing.start_times[0] ?? null } : null;
  }).filter((x): x is PlanItem => Boolean(x));
}
