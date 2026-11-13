import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Calendar, type DayMark } from '../../components/Calendar';
import { Button, Card, Chip, Field, H1, H2, Notice, P, Page, Row, Seo } from '../../components/ui';
import {
  allAreas, createInvite, decideBooking, hostBookings, hostCalendar, hostListings, hosts, invites, saveArea, saveBay,
  setRole, slugify, toggleBlocked, type Invite,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { iso, money, niceDate, priceLabel } from '../../lib/format';
import { hasDatabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { CATEGORY_LABELS, type Area, type BaySystem, type Booking, type Listing, type Profile } from '../../lib/types';
import { STATUS } from '../account';

type Tab = 'requests' | 'calendar' | 'listings' | 'team' | 'areas';
type BookingRow = Booking & { listing: Listing | null };

export default function HostDashboard() {
  const { ready, session, isHost, isAdmin, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('requests');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const load = useCallback(async () => {
    const [b, l] = await Promise.all([hostBookings(), hostListings()]);
    setBookings(b); setListings(l);
  }, []);
  useEffect(() => { if (isHost) load(); }, [isHost, load]);

  if (!hasDatabase) return <Page><H1>Host dashboard</H1><Notice>The dashboard opens once the database is connected.</Notice></Page>;
  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>Host dashboard</H1><P>Sign in with the email your invite was sent to.</P><View style={{ maxWidth: 200, marginTop: 12 }}><Button title="Sign in" href="/sign-in?next=/host" /></View></Page>;
  if (!isHost) return <Page><H1>Host dashboard</H1><P>This account isn't a host yet. Open the invite link you were sent, or ask the admin for one.</P></Page>;

  const pending = bookings.filter((b) => b.status === 'requested');
  const tabs: [Tab, string][] = [
    ['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`], ['calendar', 'Calendar'], ['listings', 'Listings'],
    ...(isAdmin ? ([['team', 'Guides and owners'], ['areas', 'Areas and bays']] as [Tab, string][]) : []),
  ];
  return (
    <Page>
      <Seo title="Host dashboard" description="Manage bookings, calendars and listings." />
      <H1>Host dashboard</H1>
      <P muted>{`${profile?.full_name || session.user.email} · ${isAdmin ? 'Administrator' : 'Partner'}`}</P>
      <Row gap={8} style={{ marginVertical: 16 }}>{tabs.map(([k, label]) => <Chip key={k} label={label} active={tab === k} onPress={() => setTab(k)} />)}</Row>
      {tab === 'requests' ? <Requests bookings={bookings} reload={load} /> : null}
      {tab === 'calendar' ? <Calendars listings={listings} bookings={bookings} /> : null}
      {tab === 'listings' ? <Listings listings={listings} /> : null}
      {tab === 'team' && isAdmin ? <Team /> : null}
      {tab === 'areas' && isAdmin ? <Areas /> : null}
    </Page>
  );
}

function when(b: Booking) {
  return `${b.start_date === b.end_date ? niceDate(b.start_date) : `${niceDate(b.start_date)} → ${niceDate(b.end_date)}`}${b.start_time ? ` · ${b.start_time}` : ''}`;
}

function Requests({ bookings, reload }: { bookings: BookingRow[]; reload: () => void }) {
  const today = iso(new Date());
  const pending = bookings.filter((b) => b.status === 'requested');
  const upcoming = bookings.filter((b) => b.status === 'accepted' && b.end_date >= today);
  return (
    <View style={{ gap: 12 }}>
      <H2 style={{ marginTop: 0 }}>Waiting on you</H2>
      {pending.length ? pending.map((b) => <BookingCard key={b.id} b={b} reload={reload} />) : <P muted>No new requests.</P>}
      <H2>Coming up</H2>
      {upcoming.length ? upcoming.map((b) => <BookingCard key={b.id} b={b} reload={reload} />) : <P muted>Nothing confirmed yet.</P>}
    </View>
  );
}

function BookingCard({ b, reload }: { b: BookingRow; reload: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'' | 'accepted' | 'declined'>('');
  const [error, setError] = useState('');
  async function decide(status: 'accepted' | 'declined') {
    setBusy(status); setError('');
    try { await decideBooking(b.id, status, note); reload(); } catch (e) { setError((e as Error).message); }
    setBusy('');
  }
  return (
    <Card style={{ gap: 4 }}>
      <Text style={{ color: STATUS[b.status].color, fontWeight: '800' }}>{STATUS[b.status].label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy }}>{b.listing?.title ?? 'Listing'}</Text>
      <P>{`${when(b)} · ${b.guests} guests${b.total_cents ? ` · ${money(b.total_cents)}` : ''}`}</P>
      <P>{b.guest_name}</P>
      <Row gap={14}>
        {b.guest_phone ? <Text style={{ color: colors.water }} onPress={() => Linking.openURL(`tel:${b.guest_phone}`)}>{b.guest_phone}</Text> : null}
        {b.guest_email ? <Text style={{ color: colors.water }} onPress={() => Linking.openURL(`mailto:${b.guest_email}`)}>{b.guest_email}</Text> : null}
      </Row>
      {b.notes ? <Notice>{`Guest says: ${b.notes}`}</Notice> : null}
      {b.status === 'requested' ? (
        <>
          <Field label="Note to the guest (optional)" value={note} onChangeText={setNote} />
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Row>
            <Button title="Accept" onPress={() => decide('accepted')} busy={busy === 'accepted'} />
            <Button title="Decline" kind="ghost" onPress={() => decide('declined')} busy={busy === 'declined'} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

function Calendars({ listings, bookings }: { listings: Listing[]; bookings: BookingRow[] }) {
  const [id, setId] = useState(listings[0]?.id ?? '');
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [error, setError] = useState('');
  const today = iso(new Date());
  const load = useCallback(() => { if (id) hostCalendar(id, today).then(setMarks); }, [id, today]);
  useEffect(load, [load]);
  if (!listings.length) return <P muted>Add a listing first.</P>;
  const dayBookings = bookings.filter((b) => b.listing_id === id && (b.status === 'accepted' || b.status === 'requested') && b.end_date >= today);

  async function tap(day: string) {
    setError('');
    const m = marks[day];
    if (m === 'booked' || m === 'requested') return setError(`${niceDate(day)} has a booking. Handle it under Requests.`);
    try { await toggleBlocked(id, day, m !== 'blocked'); load(); } catch (e) { setError((e as Error).message); }
  }
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8}>{listings.map((l) => <Chip key={l.id} label={l.title} active={id === l.id} onPress={() => setId(l.id)} />)}</Row>
      <P muted>Tap a day to block it off or open it back up.</P>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card><Calendar busy={marks} onDayPress={tap} months={2} /></Card>
      <H2>Bookings on this listing</H2>
      {dayBookings.length ? dayBookings.map((b) => (
        <P key={b.id}>{`${STATUS[b.status].label}: ${when(b)} · ${b.guest_name}, ${b.guests} guests`}</P>
      )) : <P muted>None coming up.</P>}
    </View>
  );
}

function Listings({ listings }: { listings: Listing[] }) {
  return (
    <View style={{ gap: 10 }}>
      <Row>
        <Button title="Add a house" href="/host/listing/new?kind=stay" />
        <Button title="Add a trip" href="/host/listing/new?kind=trip" kind="secondary" />
      </Row>
      {listings.map((l) => (
        <Card key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.navy }}>{l.title}</Text>
            <P muted>{`${CATEGORY_LABELS[l.category]} · ${priceLabel(l)} · ${l.published ? 'Live' : 'Hidden'}`}</P>
          </View>
          <Button small kind="ghost" title="Edit" href={`/host/listing/${l.id}`} />
        </Card>
      ))}
      {!listings.length ? <P muted>No listings yet.</P> : null}
    </View>
  );
}

function Team() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [list, setList] = useState<Invite[]>([]);
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [made, setMade] = useState<Invite | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { hosts().then(setPeople); invites().then(setList); }, []);
  useEffect(load, [load]);
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://premier-booking.netlify.app';
  const link = (code: string) => `${origin}/join/${code}`;

  async function make() {
    setError('');
    try { setMade(await createInvite(label.trim(), email.trim())); setLabel(''); setEmail(''); load(); } catch (e) { setError((e as Error).message); }
  }
  return (
    <View style={{ gap: 12 }}>
      <H2 style={{ marginTop: 0 }}>Invite a guide or house owner</H2>
      <P muted>They open the link, sign in, and can then add and manage their own trips or house. You see and control everything.</P>
      <Card>
        <Field label="Who is this for" placeholder="Capt. Mike, Bay House owner…" value={label} onChangeText={setLabel} />
        <Field label="Their email (optional)" autoCapitalize="none" value={email} onChangeText={setEmail} />
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button title="Make invite link" onPress={make} disabled={!label.trim()} />
        {made ? <Notice tone="good">{`Send this link to ${made.label}: ${link(made.code)}  (good for 14 days, one use)`}</Notice> : null}
      </Card>
      <H2>Hosts</H2>
      {people.map((p) => (
        <Card key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{p.full_name || p.email}</Text>
            <P muted>{`${p.role === 'admin' ? 'Administrator' : 'Partner'}${p.email ? ` · ${p.email}` : ''}${p.phone ? ` · ${p.phone}` : ''}`}</P>
          </View>
          {p.role === 'partner' ? <Button small kind="ghost" title="Remove access" onPress={async () => { await setRole(p.id, 'guest'); load(); }} /> : null}
        </Card>
      ))}
      <H2>Invites sent</H2>
      {list.map((i) => (
        <P key={i.code}>{`${i.label || 'Invite'}: ${i.used_at ? 'used' : new Date(i.expires_at) < new Date() ? 'expired' : link(i.code)}`}</P>
      ))}
    </View>
  );
}

function Areas() {
  const [data, setData] = useState<{ areas: Area[]; bays: BaySystem[] }>({ areas: [], bays: [] });
  const [areaName, setAreaName] = useState('');
  const [region, setRegion] = useState('');
  const [bayName, setBayName] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const load = useCallback(() => { allAreas().then(setData); }, []);
  useEffect(load, [load]);
  async function run(fn: () => Promise<void>) { setError(''); try { await fn(); load(); } catch (e) { setError((e as Error).message); } }
  return (
    <View style={{ gap: 12 }}>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {data.areas.map((a) => (
        <Card key={a.id} style={{ gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy }}>{a.name}</Text>
          <P muted>{a.region}</P>
          <P>{`Bays: ${data.bays.filter((b) => b.area_id === a.id).map((b) => b.name).join(', ') || 'none yet'}`}</P>
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flexBasis: 220, flexGrow: 1 }}>
              <Field label="Add a bay system" value={bayName[a.id] ?? ''} onChangeText={(t) => setBayName({ ...bayName, [a.id]: t })} />
            </View>
            <View style={{ marginBottom: 12 }}>
              <Button small title="Add bay" disabled={!bayName[a.id]?.trim()}
                onPress={() => run(async () => { await saveBay({ area_id: a.id, name: bayName[a.id].trim(), slug: slugify(bayName[a.id]) }); setBayName({ ...bayName, [a.id]: '' }); })} />
            </View>
          </Row>
        </Card>
      ))}
      <H2>Add an area</H2>
      <Card>
        <Field label="Area name" placeholder="Rockport" value={areaName} onChangeText={setAreaName} />
        <Field label="Region" placeholder="Texas Gulf Coast" value={region} onChangeText={setRegion} />
        <Button title="Add area" disabled={!areaName.trim()}
          onPress={() => run(async () => { await saveArea({ name: areaName.trim(), slug: slugify(areaName), region: region.trim(), sort: data.areas.length + 1 }); setAreaName(''); setRegion(''); })} />
      </Card>
      <P muted>New areas and listings get their own Google-friendly page on the next site build.</P>
      <Link href="/search"><Text style={{ color: colors.water }}>View the site</Text></Link>
    </View>
  );
}
