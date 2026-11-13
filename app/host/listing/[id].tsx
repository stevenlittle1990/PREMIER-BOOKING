import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Chip, Field, H1, Notice, P, Page, Row, Seo } from '../../../components/ui';
import { allAreas, hostListings, hosts, saveListing, slugify } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colors } from '../../../lib/theme';
import { CATEGORY_LABELS, TRIP_CATEGORIES, type Area, type BaySystem, type Category, type Listing, type Profile } from '../../../lib/types';

export async function generateStaticParams() { return []; }

const perLine = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const lines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

export default function EditListing() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const { isHost, isAdmin, session } = useAuth();
  const isNew = id === 'new';
  const [places, setPlaces] = useState<{ areas: Area[]; bays: BaySystem[] }>({ areas: [], bays: [] });
  const [team, setTeam] = useState<Profile[]>([]);
  const [l, setL] = useState<Partial<Listing>>({
    kind: kindParam === 'trip' ? 'trip' : 'stay', category: kindParam === 'trip' ? 'fishing' : 'house',
    price_unit: kindParam === 'trip' ? 'trip' : 'night', max_guests: kindParam === 'trip' ? 4 : 6, min_nights: 1, published: false,
    photos: [], amenities: [], species: [], start_times: [], highlights: [], rooms: [], house_rules: [], cleaning_fee_cents: 0, cancellation_policy: '',
  });
  const [text, setText] = useState({ price: '', photos: '', amenities: '', species: '', times: '', rooms: '', highlights: '', rules: '', cleaning: '', deposit: '', petFee: '' });
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isHost) return;
    allAreas().then((p) => { setPlaces(p); setL((x) => ({ ...x, area_id: x.area_id ?? p.areas[0]?.id })); });
    if (isAdmin) hosts().then(setTeam);
    if (!isNew) hostListings().then((all) => {
      const found = all.find((x) => x.id === id);
      if (found) {
        setL(found);
        setText({ price: found.price_cents ? String(found.price_cents / 100) : '', photos: found.photos.join('\n'),
          amenities: found.amenities.join('\n'), species: found.species.join(', '), times: found.start_times.join(', '),
          rooms: (found.rooms ?? []).map((r) => `${r.name}: ${r.beds}`).join('\n'), highlights: (found.highlights ?? []).join('\n'),
          rules: (found.house_rules ?? []).join('\n'), cleaning: found.cleaning_fee_cents ? String(found.cleaning_fee_cents / 100) : '',
          deposit: found.security_deposit_cents ? String(found.security_deposit_cents / 100) : '', petFee: found.pet_fee_cents ? String(found.pet_fee_cents / 100) : '' });
      }
      setLoaded(true);
    });
  }, [id, isNew, isHost, isAdmin]);

  if (!isHost) return <Page><H1>Edit listing</H1><P>Hosts only.</P></Page>;
  if (!loaded) return <Page><P>Loading…</P></Page>;
  const set = (patch: Partial<Listing>) => setL((x) => ({ ...x, ...patch }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const isStay = l.kind === 'stay';
  const bays = places.bays.filter((b) => b.area_id === l.area_id);

  async function save() {
    setError('');
    if (!l.title?.trim()) return setError('Give it a name.');
    if (!l.area_id) return setError('Pick an area.');
    setBusy(true);
    try {
      const { id: _id, ...rest } = l as Listing;
      const payload: Partial<Listing> = {
        ...rest,
        ...(isNew ? {} : { id: l.id }),
        slug: l.slug || slugify(l.title!),
        price_cents: Math.round((Number(text.price) || 0) * 100),
        photos: lines(text.photos), amenities: text.amenities.split('\n').map((x) => x.trim()).filter(Boolean),
        species: lines(text.species), start_times: lines(text.times),
        highlights: perLine(text.highlights), house_rules: perLine(text.rules),
        rooms: perLine(text.rooms).map((r) => { const [n, ...b] = r.split(':'); return { name: n.trim(), beds: b.join(':').trim() }; }),
        cleaning_fee_cents: Math.round((Number(text.cleaning) || 0) * 100),
        security_deposit_cents: Math.round((Number(text.deposit) || 0) * 100),
        pet_fee_cents: Math.round((Number(text.petFee) || 0) * 100),
        tax_pct: Number(l.tax_pct) || 0,
        owner_id: l.owner_id ?? session?.user.id ?? null,
      };
      delete (payload as Record<string, unknown>).created_at;
      await saveListing(payload);
      router.replace('/host');
    } catch (e) {
      setError((e as Error).message.includes('listings_slug_key') ? 'Another listing already uses that name. Change the name a little.' : (e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Page>
      <Seo title="Edit listing" description="Edit a listing." />
      <H1>{isNew ? (isStay ? 'Add a house' : 'Add a trip') : `Edit ${l.title}`}</H1>
      <View style={{ maxWidth: 760, gap: 4 }}>
        <Card>
          <Field label="Name" value={l.title ?? ''} onChangeText={(t) => set({ title: t })} placeholder={isStay ? 'Bayfront Cottage' : 'Half-day redfish trip'} />
          {!isStay ? (
            <>
              <Text style={lbl}>Type of trip</Text>
              <Row gap={8} style={{ marginBottom: 12 }}>
                {TRIP_CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_LABELS[c]} active={l.category === c} onPress={() => set({ category: c as Category })} />)}
              </Row>
            </>
          ) : null}
          <Text style={lbl}>Area</Text>
          <Row gap={8} style={{ marginBottom: 12 }}>
            {places.areas.map((a) => <Chip key={a.id} label={a.name} active={l.area_id === a.id} onPress={() => set({ area_id: a.id, bay_system_id: null })} />)}
          </Row>
          <Text style={lbl}>Bay system</Text>
          <Row gap={8} style={{ marginBottom: 12 }}>
            <Chip label="None" active={!l.bay_system_id} onPress={() => set({ bay_system_id: null })} />
            {bays.map((b) => <Chip key={b.id} label={b.name} active={l.bay_system_id === b.id} onPress={() => set({ bay_system_id: b.id })} />)}
          </Row>
          <Field label="One-line summary (shows on cards and Google)" value={l.summary ?? ''} onChangeText={(t) => set({ summary: t })} />
          <Field label="Full description" multiline value={l.description ?? ''} onChangeText={(t) => set({ description: t })} />
        </Card>

        <Card>
          <Row gap={12}>
            <View style={{ flexBasis: 160, flexGrow: 1 }}><Field label="Your rate ($, for quoting; customers never see it)" keyboardType="decimal-pad" placeholder="Optional" value={text.price} onChangeText={(t) => setText({ ...text, price: t })} /></View>
            <View style={{ flexBasis: 220, flexGrow: 1 }}>
              <Text style={lbl}>Price is per</Text>
              <Row gap={8}>
                {(isStay ? ['night'] : ['trip', 'person']).map((u) => <Chip key={u} label={u} active={l.price_unit === u} onPress={() => set({ price_unit: u as Listing['price_unit'] })} />)}
              </Row>
            </View>
          </Row>
          <Row gap={12}>
            <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label={isStay ? 'Sleeps' : 'Max people'} keyboardType="number-pad" value={String(l.max_guests ?? '')} onChangeText={(t) => set({ max_guests: Number(t) || 1 })} /></View>
            {isStay ? (
              <>
                <View style={{ flexBasis: 120, flexGrow: 1 }}><Field label="Bedrooms" keyboardType="number-pad" value={l.bedrooms?.toString() ?? ''} onChangeText={(t) => set({ bedrooms: num(t) })} /></View>
                <View style={{ flexBasis: 120, flexGrow: 1 }}><Field label="Beds" keyboardType="number-pad" value={l.beds?.toString() ?? ''} onChangeText={(t) => set({ beds: num(t) })} /></View>
                <View style={{ flexBasis: 120, flexGrow: 1 }}><Field label="Baths" keyboardType="decimal-pad" value={l.bathrooms?.toString() ?? ''} onChangeText={(t) => set({ bathrooms: num(t) })} /></View>
                <View style={{ flexBasis: 120, flexGrow: 1 }}><Field label="Min nights" keyboardType="number-pad" value={String(l.min_nights ?? 1)} onChangeText={(t) => set({ min_nights: Number(t) || 1 })} /></View>
              </>
            ) : (
              <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Hours" keyboardType="decimal-pad" value={l.duration_hours?.toString() ?? ''} onChangeText={(t) => set({ duration_hours: num(t) })} /></View>
            )}
          </Row>
          {!isStay ? (
            <>
              <Field label="Start times (comma between)" placeholder="6:30 AM, 1:00 PM" value={text.times} onChangeText={(t) => setText({ ...text, times: t })} />
              <Field label="Species (comma between)" placeholder="Redfish, Speckled trout" value={text.species} onChangeText={(t) => setText({ ...text, species: t })} />
              <Field label="Meeting point" value={l.meeting_point ?? ''} onChangeText={(t) => set({ meeting_point: t })} />
            </>
          ) : (
            <Field label="Address" value={l.address ?? ''} onChangeText={(t) => set({ address: t })} />
          )}
          <Field label="Highlights at the top of the page (one per line)" multiline value={text.highlights} onChangeText={(t) => setText({ ...text, highlights: t })} />
          {isStay ? (
            <>
              <Field label="Bedrooms and beds (one per line, like Bedroom 1: 2 queen beds)" multiline value={text.rooms} onChangeText={(t) => setText({ ...text, rooms: t })} />
              <Row gap={12}>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Check-in after" placeholder="4:00 PM" value={l.check_in_time ?? ''} onChangeText={(t) => set({ check_in_time: t || null })} /></View>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Checkout before" placeholder="11:00 AM" value={l.check_out_time ?? ''} onChangeText={(t) => set({ check_out_time: t || null })} /></View>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Cleaning fee ($)" keyboardType="decimal-pad" value={text.cleaning} onChangeText={(t) => setText({ ...text, cleaning: t })} /></View>
              </Row>
              <Row gap={12}>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Tax (%)" keyboardType="decimal-pad" value={String(l.tax_pct ?? '')} onChangeText={(t) => set({ tax_pct: Number(t) || 0 })} /></View>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Security deposit ($)" keyboardType="decimal-pad" value={text.deposit} onChangeText={(t) => setText({ ...text, deposit: t })} /></View>
                <View style={{ flexBasis: 140, flexGrow: 1 }}><Field label="Pet deposit per pet ($)" keyboardType="decimal-pad" value={text.petFee} onChangeText={(t) => setText({ ...text, petFee: t })} /></View>
              </Row>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Switch value={Boolean(l.pets_allowed)} onValueChange={(v) => set({ pets_allowed: v })} trackColor={{ true: colors.water, false: colors.line }} />
                <Text>Pets allowed</Text>
              </View>
            </>
          ) : null}
          <Field label="Rules (one per line)" multiline placeholder="No smoking inside" value={text.rules} onChangeText={(t) => setText({ ...text, rules: t })} />
          <Field label="Cancellation policy" multiline placeholder="Full refund up to 14 days before; weather cancellations always refunded" value={l.cancellation_policy ?? ''} onChangeText={(t) => set({ cancellation_policy: t })} />
          <Field label={isStay ? 'Amenities (one per line)' : "What's included (one per line)"} multiline value={text.amenities} onChangeText={(t) => setText({ ...text, amenities: t })} />
          <Field label="Photo links (one per line, first is the cover)" multiline autoCapitalize="none" value={text.photos} onChangeText={(t) => setText({ ...text, photos: t })} />
        </Card>

        {isAdmin && team.length ? (
          <Card>
            <Text style={lbl}>Who runs this</Text>
            <Row gap={8}>{team.map((p) => <Chip key={p.id} label={p.full_name || p.email || 'Host'} active={l.owner_id === p.id} onPress={() => set({ owner_id: p.id })} />)}</Row>
          </Card>
        ) : null}

        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>Live on the site</Text>
            <P muted>Off keeps it hidden while you set it up.</P>
          </View>
          <Switch value={Boolean(l.published)} onValueChange={(v) => set({ published: v })} trackColor={{ true: colors.water, false: colors.line }} />
        </Card>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Row style={{ marginTop: 8 }}>
          <Button title="Save" onPress={save} busy={busy} />
          <Button title="Cancel" kind="ghost" onPress={() => router.back()} />
        </Row>
      </View>
    </Page>
  );
}

const lbl = { fontSize: 13, fontWeight: '600' as const, color: colors.muted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
