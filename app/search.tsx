import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ListingGrid } from '../components/ListingCard';
import { Chip, Field, H1, P, Page, Row, Seo } from '../components/ui';
import { busyDays, liveCatalog } from '../lib/api';
import { catalog } from '../lib/catalog';
import { colors } from '../lib/theme';
import { CATEGORY_LABELS, TRIP_CATEGORIES, type Listing } from '../lib/types';

export default function Search() {
  const params = useLocalSearchParams<{ area?: string; bay?: string; kind?: string; category?: string; date?: string; guests?: string }>();
  // The page is pre-built without a query, so read the query only after it loads in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const q: typeof params = mounted ? params : {};
  const [data, setData] = useState(catalog);
  const [busyOnDate, setBusyOnDate] = useState<Set<string>>(new Set());

  useEffect(() => { liveCatalog().then((c) => setData({ ...c, builtAt: catalog.builtAt })); }, []);

  const area = data.areas.find((a) => a.slug === q.area);
  const bays = area ? data.bays.filter((b) => b.area_id === area.id) : data.bays;
  const bay = data.bays.find((b) => b.slug === q.bay && (!area || b.area_id === area.id));

  const set = (k: string, v?: string) => {
    const next: Record<string, string> = {};
    for (const [key, val] of Object.entries(q)) if (typeof val === 'string' && val) next[key] = val;
    if (v) next[k] = v; else delete next[k];
    if (k === 'area') delete next.bay;
    if (k === 'kind') delete next.category;
    router.setParams({ ...Object.fromEntries(Object.keys(q).map((x) => [x, undefined])), ...next } as never);
  };

  const results = useMemo(() => data.listings.filter((l: Listing) =>
    (!area || l.area_id === area.id) &&
    (!bay || l.bay_system_id === bay.id) &&
    (!q.kind || l.kind === q.kind) &&
    (!q.category || l.category === q.category) &&
    (!q.guests || l.max_guests >= Number(q.guests)) &&
    !busyOnDate.has(l.id),
  ), [data, area, bay, q.kind, q.category, q.guests, busyOnDate]);

  // With a date picked, hide anything already taken that day.
  useEffect(() => {
    if (!q.date || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return setBusyOnDate(new Set());
    Promise.all(data.listings.map(async (l) => ((await busyDays(l.id, q.date!, 0))[q.date!] ? l.id : null)))
      .then((ids) => setBusyOnDate(new Set(ids.filter(Boolean) as string[])));
  }, [q.date, data.listings]);

  const heading = q.kind === 'stay' ? 'Places to stay' : q.kind === 'trip' ? 'Trips and guides' : 'Stays and trips';
  return (
    <Page>
      <Seo title={`${heading}${area ? ` in ${area.name}` : ''}`}
        description="Search houses, fishing guides, cruises and tours by area, bay system, date and group size." path="/search" />
      <H1>{heading}{area ? ` in ${area.name}` : ''}</H1>

      <View style={{ gap: 10, marginBottom: 16 }}>
        <ChipRow label="Area">
          <Chip label="Any" active={!q.area} onPress={() => set('area')} />
          {data.areas.map((a) => <Chip key={a.id} label={a.name} active={q.area === a.slug} onPress={() => set('area', a.slug)} />)}
        </ChipRow>
        <ChipRow label="Bay">
          <Chip label="Any" active={!q.bay} onPress={() => set('bay')} />
          {bays.map((b) => <Chip key={b.id} label={b.name} active={q.bay === b.slug} onPress={() => set('bay', b.slug)} />)}
        </ChipRow>
        <ChipRow label="Type">
          <Chip label="All" active={!q.kind} onPress={() => set('kind')} />
          <Chip label="Stays" active={q.kind === 'stay'} onPress={() => set('kind', 'stay')} />
          <Chip label="Trips" active={q.kind === 'trip'} onPress={() => set('kind', 'trip')} />
        </ChipRow>
        {q.kind === 'trip' ? (
          <ChipRow label="Trip">
            <Chip label="Any" active={!q.category} onPress={() => set('category')} />
            {TRIP_CATEGORIES.filter((c) => data.listings.some((l) => l.category === c)).map((c) =>
              <Chip key={c} label={CATEGORY_LABELS[c]} active={q.category === c} onPress={() => set('category', c)} />)}
          </ChipRow>
        ) : null}
        <Row gap={10} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <View style={{ flex: 3, minWidth: 0 }}>
            <DateField label="Date" value={q.date ?? ''} onChange={(d) => set('date', d || undefined)} />
          </View>
          <View style={{ flex: 2, minWidth: 0 }}>
            <Field label="Guests" placeholder="Any" keyboardType="number-pad" key={`g${mounted}`} defaultValue={q.guests ?? ''}
              onBlur={(e: any) => set('guests', e?.target?.value || undefined)} />
          </View>
        </Row>
      </View>

      <P muted style={{ marginBottom: 12 }}>{results.length} {results.length === 1 ? 'result' : 'results'}</P>
      {results.length ? <ListingGrid listings={results} /> : <P>Nothing matches yet. Try another bay or date.</P>}
    </Page>
  );
}

const label = { fontWeight: '700' as const, color: colors.muted, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 };

// One line of choices per filter that slides sideways on a phone, instead of a wall of wrapped boxes.
function ChipRow({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={label}>{text}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>{children}</ScrollView>
    </View>
  );
}
