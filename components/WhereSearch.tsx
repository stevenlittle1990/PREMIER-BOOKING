import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { liveCatalog } from '../lib/api';
import { catalog } from '../lib/catalog';
import { listingPath } from '../lib/format';
import { colors, radius } from '../lib/theme';
import { CATEGORY_LABELS, TRIP_CATEGORIES, type Area, type BaySystem, type Category, type Listing } from '../lib/types';
import { webData } from '../lib/web';

// "Where to?" search: towns, bays, addresses, trips and trip types, all built from the live listings,
// so a new town or house shows up here as soon as it's published.
type Hit = { key: string; icon: string; label: string; sub: string; href: string; words: string; rank: number };

const CAT_ICON: Partial<Record<Category, string>> = {
  house: 'home-outline', fishing: 'fish-outline', sunset_cruise: 'sunny-outline', beach_cruise: 'umbrella-outline',
  island_tour: 'boat-outline', bird_watching: 'binoculars-outline',
};
// Extra words people type that should find a trip type.
const CAT_WORDS: Partial<Record<Category, string>> = {
  fishing: 'fish fishing charter guide guided redfish red trout speckled specks flounder drum inshore bay wade wading jetty drift',
  sunset_cruise: 'sunset cruise boat ride evening',
  beach_cruise: 'beach island matagorda shelling swim',
  island_tour: 'island tour boat ride',
  bird_watching: 'birds birding whooping cranes wildlife nature',
  house: 'house home stay lodge rental cabin place to stay sleep',
};

function build(areas: Area[], bays: BaySystem[], listings: Listing[]): Hit[] {
  const hits: Hit[] = [];
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '';
  for (const a of areas) hits.push({ key: `a-${a.id}`, icon: 'location-outline', label: a.name, sub: a.region || 'Town', href: `/areas/${a.slug}`, words: `${a.name} ${a.region} ${a.description}`, rank: 0 });
  for (const c of [...new Set(listings.map((l) => l.category))].sort((x, y) => (x === 'house' ? -1 : y === 'house' ? 1 : TRIP_CATEGORIES.indexOf(x) - TRIP_CATEGORIES.indexOf(y)))) {
    hits.push({ key: `c-${c}`, icon: CAT_ICON[c] ?? 'compass-outline', label: c === 'house' ? 'Places to stay' : `${CATEGORY_LABELS[c]}s`, sub: 'Trip type',
      href: c === 'house' ? '/search?kind=stay' : `/search?kind=trip&category=${c}`, words: `${CATEGORY_LABELS[c]} ${CAT_WORDS[c] ?? ''}`, rank: 1 });
  }
  for (const b of bays) {
    const area = areas.find((a) => a.id === b.area_id);
    hits.push({ key: `b-${b.id}`, icon: 'water-outline', label: b.name, sub: `Bay system${area ? ` · ${area.name}` : ''}`,
      href: `/search?${area ? `area=${area.slug}&` : ''}bay=${b.slug}`, words: `${b.name} ${b.description ?? ''}`, rank: 2 });
  }
  for (const l of listings) {
    const town = areaName(l.area_id);
    hits.push({ key: `l-${l.id}`, icon: CAT_ICON[l.category] ?? 'compass-outline', label: l.title,
      sub: l.kind === 'stay' ? (l.address || `${CATEGORY_LABELS[l.category]} · ${town}`) : `${CATEGORY_LABELS[l.category]} · ${town}`,
      href: listingPath(l), words: `${l.title} ${l.address ?? ''} ${l.summary} ${l.species.join(' ')} ${CAT_WORDS[l.category] ?? ''}`, rank: 3 });
  }
  return hits;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '');

function match(hits: Hit[], q: string): Hit[] {
  const tokens = norm(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) {
    // Before typing: towns first, then trip types, then a couple of bays.
    return [...hits.filter((h) => h.rank === 0), ...hits.filter((h) => h.rank === 1).slice(0, 4), ...hits.filter((h) => h.rank === 2).slice(0, 2)];
  }
  return hits.map((h) => {
    const label = norm(h.label), all = `${label} ${norm(h.sub)} ${norm(h.words)}`;
    let score = 0;
    for (const t of tokens) {
      if (!all.includes(t)) return null;
      if (label.startsWith(t)) score += 100;
      else if (label.split(/\s+/).some((w) => w.startsWith(t))) score += 60;
      else if (label.includes(t)) score += 40;
      else score += 10;
    }
    return { h, score: score - h.rank * 5 };
  }).filter((x): x is { h: Hit; score: number } => Boolean(x)).sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.h);
}

export function WhereSearch() {
  const [data, setData] = useState({ areas: catalog.areas, bays: catalog.bays, listings: catalog.listings });
  useEffect(() => { liveCatalog().then(setData); }, []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const closer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hits = useMemo(() => build(data.areas, data.bays, data.listings), [data]);
  const results = useMemo(() => match(hits, q), [hits, q]);

  const go = (h: Hit) => { setOpen(false); setQ(''); router.push(h.href as never); };
  const keepOpen = () => { if (closer.current) clearTimeout(closer.current); };

  return (
    <View style={{ zIndex: 5 }}>
      <View {...webData('searchpill')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 999,
        borderWidth: 1, borderColor: open ? colors.water : colors.line, paddingHorizontal: 16, minHeight: 54 }}>
        <Ionicons name="search" size={20} color={colors.navy} />
        <TextInput value={q} onChangeText={(t) => { setQ(t); setOpen(true); }} onFocus={() => { keepOpen(); setOpen(true); }}
          onBlur={() => { closer.current = setTimeout(() => setOpen(false), 250); }}
          onSubmitEditing={() => results[0] && go(results[0])}
          placeholder="Search towns, bays, addresses or trips" placeholderTextColor="#8f9aa3" returnKeyType="search"
          autoCorrect={false} autoCapitalize="none" accessibilityLabel="Where to?"
          style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 14, outlineStyle: 'none' } as never} />
        {q ? <Pressable onPress={() => { keepOpen(); setQ(''); }} accessibilityLabel="Clear search" hitSlop={10}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : null}
      </View>
      {open ? (
        <View accessibilityRole="list" style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          {!q ? <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>Popular</Text> : null}
          {results.map((h, i) => (
            <Pressable key={h.key} onPressIn={keepOpen} onPress={() => go(h)} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f0e8da' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.shallows, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={h.icon as never} size={18} color={colors.water} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }} numberOfLines={1}>{h.label}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{h.sub}</Text>
              </View>
            </Pressable>
          ))}
          {!results.length ? <Text style={{ padding: 16, color: colors.muted }}>{`Nothing matches "${q}" yet. Try a town, a bay, or a trip like fishing.`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
