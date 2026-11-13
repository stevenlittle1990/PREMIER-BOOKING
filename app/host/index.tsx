import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Calendar, type DayMark } from '../../components/Calendar';
import { MapEmbed } from '../../components/MapEmbed';
import { Notifications } from '../../components/Notifications';
import { TeamCalendar } from '../../components/TeamCalendar';
import { Button, Card, Chip, Eyebrow, Field, H1, H2, Notice, P, Page, Row, Seo, Stat, ViewTabs } from '../../components/ui';
import {
  addTeamMember, allAreas, assign, assignmentsFor, customers, decideBooking, hostBookings, hostCalendar, hostListings, revealTin, saveArea,
  saveBay, saveSetting, setRole, slugify, team, toggleBlocked, unassign, waiversFor, waiverText, type PendingMember,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, iso, money, niceDate, priceLabel } from '../../lib/format';
import { hasDatabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import {
  CATEGORY_LABELS, TEAM_TYPES, WORKER_TYPES, type Area, type Assignment, type BaySystem, type Booking, type Listing, type Profile, type TaxForm, type Waiver,
} from '../../lib/types';
import { STATUS } from '../account';

type Tab = 'overview' | 'bookings' | 'calendar' | 'map' | 'listings' | 'team' | 'customers' | 'waivers' | 'areas' | 'settings';
type BookingRow = Booking & { listing: Listing | null };
type Ctx = { bookings: BookingRow[]; listings: Listing[]; assignments: Assignment[]; people: Profile[]; waivers: Waiver[]; reload: () => void; isAdmin: boolean; go: (t: Tab) => void };

export default function HostDashboard() {
  const { ready, session, isHost, isAdmin, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const load = useCallback(async () => {
    const [b, l] = await Promise.all([hostBookings(), hostListings()]);
    setBookings(b); setListings(l);
    const ids = b.map((x) => x.id);
    const [a, w] = await Promise.all([assignmentsFor(ids), waiversFor(ids)]);
    setAssignments(a); setWaivers(w);
  }, []);
  useEffect(() => { if (isHost) load(); }, [isHost, load]);
  useEffect(() => { if (isAdmin) team().then((t) => setPeople(t.members)); }, [isAdmin]);

  if (!hasDatabase) return <Page><H1>Dashboard</H1><Notice>The dashboard opens once the database is connected.</Notice></Page>;
  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>Dashboard</H1><P>Sign in to manage bookings.</P><View style={{ maxWidth: 200, marginTop: 12 }}><Button title="Sign in" href="/sign-in?next=/host" /></View></Page>;
  if (!isHost) return <Page><H1>Dashboard</H1><P>This account isn't on the team yet. Ask the admin to add your email.</P></Page>;

  const pending = bookings.filter((b) => b.status === 'requested');
  const tabs: [Tab, string][] = isAdmin ? [
    ['overview', 'Overview'], ['bookings', `Bookings${pending.length ? ` (${pending.length})` : ''}`], ['calendar', 'Calendar'], ['map', 'Map'],
    ['listings', 'Listings'], ['team', 'Team'], ['customers', 'Customers'], ['waivers', 'Waivers'], ['areas', 'Areas'], ['settings', 'Settings'],
  ] : [['overview', 'Overview'], ['bookings', `Bookings${pending.length ? ` (${pending.length})` : ''}`], ['calendar', 'Calendar'], ['listings', 'Listings']];
  const ctx: Ctx = { bookings, listings, assignments, people, waivers, reload: load, isAdmin, go: setTab };
  return (
    <Page>
      <Seo title="Dashboard" description="Manage bookings, crew, calendars and listings." />
      <ViewTabs current="admin" />
      <Eyebrow>{isAdmin ? 'Operations' : 'Owner'}</Eyebrow>
      <H1>{isAdmin ? 'Owner dashboard' : 'My houses'}</H1>
      <P muted>{`${profile?.full_name || session.user.email} · ${session.user.email} · ${isAdmin ? 'Administrator' : 'Partner'}`}</P>
      <Row gap={8} style={{ marginVertical: 16 }}>{tabs.map(([k, label]) => <Chip key={k} label={label} active={tab === k} onPress={() => setTab(k)} />)}</Row>
      {tab === 'overview' ? <Overview {...ctx} /> : null}
      {tab === 'bookings' ? <Requests {...ctx} /> : null}
      {tab === 'calendar' ? <Calendars {...ctx} /> : null}
      {tab === 'map' ? <MapTab listings={listings} /> : null}
      {tab === 'listings' ? <Listings listings={listings} /> : null}
      {tab === 'team' && isAdmin ? <Team onChange={() => team().then((t) => setPeople(t.members))} /> : null}
      {tab === 'customers' && isAdmin ? <Customers /> : null}
      {tab === 'waivers' && isAdmin ? <Waivers {...ctx} /> : null}
      {tab === 'areas' && isAdmin ? <Areas /> : null}
      {tab === 'settings' && isAdmin ? <Settings {...ctx} /> : null}
    </Page>
  );
}

function Overview({ bookings, assignments, waivers, go, isAdmin }: Ctx) {
  const today = iso(new Date());
  const week = addDays(today, 7);
  const pending = bookings.filter((b) => b.status === 'requested');
  const upcoming = bookings.filter((b) => b.status === 'accepted' && b.end_date >= today);
  const thisWeek = upcoming.filter((b) => b.start_date <= week);
  const trips = upcoming.filter((b) => b.listing?.kind === 'trip');
  const noCrew = trips.filter((b) => !assignments.some((a) => a.booking_id === b.id && a.status !== 'declined'));
  const unanswered = assignments.filter((a) => a.status === 'pending' && upcoming.some((b) => b.id === a.booking_id));
  const declined = assignments.filter((a) => a.status === 'declined' && upcoming.some((b) => b.id === a.booking_id));
  const noWaiver = trips.filter((b) => !waivers.some((w) => w.booking_id === b.id));
  return (
    <View style={{ gap: 12 }}>
      <Row gap={10}>
        <Stat value={pending.length} label="Requests waiting" tone={pending.length ? 'warn' : undefined} onPress={() => go('bookings')} />
        <Stat value={thisWeek.length} label="Coming up this week" onPress={() => go('calendar')} />
        {isAdmin ? <Stat value={noCrew.length} label="Trips with no crew" tone={noCrew.length ? 'warn' : undefined} onPress={() => go('bookings')} /> : null}
        {isAdmin ? <Stat value={noWaiver.length} label="Trips missing a waiver" tone={noWaiver.length ? 'warn' : undefined} onPress={() => go('waivers')} /> : null}
      </Row>
      <Card style={{ gap: 6 }}>
        <Eyebrow>Owner briefing</Eyebrow>
        <Text role="heading" style={{ fontSize: 24, color: colors.navy }}>Needs attention</Text>
        {pending.map((b) => <Attention key={b.id} text={`New request: ${b.guest_name}, ${b.listing?.title ?? ''}, ${niceDate(b.start_date)}`} onPress={() => go('bookings')} />)}
        {noCrew.map((b) => <Attention key={`c${b.id}`} text={`Assign a guide: ${b.listing?.title ?? ''}, ${niceDate(b.start_date)}`} onPress={() => go('bookings')} />)}
        {declined.map((a) => <Attention key={`d${a.id}`} text={`A crew member declined ${bookings.find((b) => b.id === a.booking_id)?.listing?.title ?? 'a job'}. Assign someone else.`} onPress={() => go('bookings')} />)}
        {unanswered.length ? <Attention text={`${unanswered.length} job${unanswered.length > 1 ? 's' : ''} waiting on a guide to accept`} onPress={() => go('calendar')} /> : null}
        {!pending.length && !noCrew.length && !declined.length && !unanswered.length ? <P muted>All caught up.</P> : null}
      </Card>
      <Notifications />
    </View>
  );
}

function Attention({ text, onPress }: { text: string; onPress: () => void }) {
  return <Text onPress={onPress} style={{ color: colors.text, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>{`→ ${text}`}</Text>;
}

function when(b: Booking) {
  return `${b.start_date === b.end_date ? niceDate(b.start_date) : `${niceDate(b.start_date)} → ${niceDate(b.end_date)}`}${b.start_time ? ` · ${b.start_time}` : ''}`;
}

function Requests({ bookings, assignments, people, waivers, reload, isAdmin }: Ctx) {
  const today = iso(new Date());
  const pending = bookings.filter((b) => b.status === 'requested');
  const upcoming = bookings.filter((b) => b.status === 'accepted' && b.end_date >= today);
  const card = (b: BookingRow) => <BookingCard key={b.id} b={b} reload={reload} isAdmin={isAdmin} people={people}
    crew={assignments.filter((x) => x.booking_id === b.id)} signed={waivers.filter((w) => w.booking_id === b.id).length} />;
  return (
    <View style={{ gap: 12 }}>
      <H2 style={{ marginTop: 0 }}>Waiting on you</H2>
      {pending.length ? pending.map(card) : <P muted>No new requests.</P>}
      <H2>Coming up</H2>
      {upcoming.length ? upcoming.map(card) : <P muted>Nothing confirmed yet.</P>}
    </View>
  );
}

function BookingCard({ b, reload, isAdmin, people, crew, signed }: {
  b: BookingRow; reload: () => void; isAdmin: boolean; people: Profile[]; crew: Assignment[]; signed: number;
}) {
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
      <Text role="heading" style={{ fontSize: 20, color: colors.navy }}>{b.listing?.title ?? 'Listing'}</Text>
      {b.group_id ? <Text style={{ color: colors.water, fontWeight: '700' }}>Part of a stay + trip package from this guest</Text> : null}
      <P>{`${when(b)} · ${b.guests} guests${b.total_cents ? ` · ${money(b.total_cents)}` : ''}`}</P>
      <P>{b.guest_name}</P>
      <Row gap={14}>
        {b.guest_phone ? <Text style={{ color: colors.water }} onPress={() => Linking.openURL(`tel:${b.guest_phone}`)}>{b.guest_phone}</Text> : null}
        {b.guest_email ? <Text style={{ color: colors.water }} onPress={() => Linking.openURL(`mailto:${b.guest_email}`)}>{b.guest_email}</Text> : null}
      </Row>
      {b.listing?.kind === 'trip' ? <P muted>{signed ? `Waivers signed: ${signed}` : 'Waiver not signed yet'}</P> : null}
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
      {isAdmin && b.status !== 'declined' && b.status !== 'cancelled' ? <CrewBox b={b} crew={crew} people={people} reload={reload} /> : null}
    </Card>
  );
}

// Admin assigns guides (or cleaners, deckhands, house owners) to a booking. They get an alert and accept in their own view.
function CrewBox({ b, crew, people, reload }: { b: BookingRow; crew: Assignment[]; people: Profile[]; reload: () => void }) {
  const [job, setJob] = useState(b.listing?.kind === 'stay' ? 'Cleaning' : 'Guide');
  const [error, setError] = useState('');
  const who = (id: string) => people.find((p) => p.id === id);
  const free = people.filter((p) => !crew.some((c) => c.assignee_id === p.id));
  async function run(fn: () => Promise<void>) { setError(''); try { await fn(); reload(); } catch (e) { setError((e as Error).message); } }
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingTop: 8, gap: 6 }}>
      <Text style={{ fontWeight: '800', color: colors.navy }}>Crew</Text>
      {crew.length ? crew.map((c) => (
        <Row key={c.id} gap={8}>
          <Text style={{ fontWeight: '700' }}>{who(c.assignee_id)?.full_name || who(c.assignee_id)?.email || 'Crew'}</Text>
          <Text style={{ color: colors.muted }}>{c.job}</Text>
          <Text style={{ color: c.status === 'accepted' ? colors.good : c.status === 'declined' ? colors.bad : colors.water, fontWeight: '700' }}>
            {c.status === 'accepted' ? 'Accepted' : c.status === 'declined' ? 'Declined' : 'Sent, not answered'}
          </Text>
          {c.note ? <Text style={{ color: colors.muted }}>{`"${c.note}"`}</Text> : null}
          <Button small kind="ghost" title="Remove" onPress={() => run(() => unassign(c.id))} />
        </Row>
      )) : <P muted>No one assigned yet.</P>}
      {free.length ? (
        <>
          <Row gap={8}>
            <Text style={{ color: colors.muted }}>Job:</Text>
            {['Guide', 'Captain', 'Deckhand', 'Cleaning', 'Check-in'].map((j) => <Chip key={j} label={j} active={job === j} onPress={() => setJob(j)} />)}
          </Row>
          <Row gap={8}>
            <Text style={{ color: colors.muted }}>Assign:</Text>
            {free.map((p) => <Chip key={p.id} label={`+ ${p.full_name || p.email}`} onPress={() => run(() => assign(b.id, p.id, job))} />)}
          </Row>
        </>
      ) : <P muted>Add people under Team to assign them.</P>}
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </View>
  );
}

function Calendars({ listings, bookings, assignments, people, isAdmin }: Ctx) {
  const [id, setId] = useState('all');
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [error, setError] = useState('');
  const today = iso(new Date());
  const load = useCallback(() => { if (id !== 'all') hostCalendar(id, today).then(setMarks); }, [id, today]);
  useEffect(load, [load]);
  if (!listings.length) return <P muted>Add a listing first.</P>;
  const dayBookings = bookings.filter((b) => b.listing_id === id && (b.status === 'accepted' || b.status === 'requested') && b.end_date >= today);

  async function tap(day: string) {
    setError('');
    const m = marks[day];
    if (m === 'booked' || m === 'requested') return setError(`${niceDate(day)} has a booking. Handle it under Bookings.`);
    try { await toggleBlocked(id, day, m !== 'blocked'); load(); } catch (e) { setError((e as Error).message); }
  }
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8}>
        <Chip label="Everything" active={id === 'all'} onPress={() => setId('all')} />
        {listings.map((l) => <Chip key={l.id} label={l.title} active={id === l.id} onPress={() => setId(l.id)} />)}
      </Row>
      {id === 'all' ? (
        <Card><TeamCalendar bookings={bookings} assignments={assignments} people={people} /></Card>
      ) : (
        <>
          <P muted>Tap a day to block it off (maintenance, personal use, weather) or open it back up.</P>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Card><Calendar busy={marks} onDayPress={tap} months={2} /></Card>
          <H2>Bookings on this listing</H2>
          {dayBookings.length ? dayBookings.map((b) => (
            <P key={b.id}>{`${STATUS[b.status].label}: ${when(b)} · ${b.guest_name}, ${b.guests} guests`}</P>
          )) : <P muted>None coming up.</P>}
        </>
      )}
      {!isAdmin ? null : <P muted style={{ fontSize: 13 }}>Guides see their own jobs on their own calendar.</P>}
    </View>
  );
}

function MapTab({ listings }: { listings: Listing[] }) {
  const places = listings.filter((l) => l.address || l.meeting_point);
  return (
    <View style={{ gap: 14 }}>
      {places.map((l) => (
        <Card key={l.id} style={{ gap: 6 }}>
          <Text role="heading" style={{ fontSize: 20, color: colors.navy }}>{l.title}</Text>
          <P muted>{`${CATEGORY_LABELS[l.category]}${l.published ? '' : ' · hidden'} · ${l.address || `Meet at ${l.meeting_point}`}`}</P>
          <MapEmbed address={l.address || `${l.meeting_point}, Port O'Connor, TX`} />
        </Card>
      ))}
      {!places.length ? <P muted>Add an address to a house (or a meeting point to a trip) to see it here.</P> : null}
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

function Team({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<{ members: Profile[]; waiting: PendingMember[]; forms: TaxForm[] }>({ members: [], waiting: [], forms: [] });
  const [f, setF] = useState({ name: '', email: '', phone: '', team_type: 'guide', worker_type: 'subcontractor' });
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tins, setTins] = useState<Record<string, string>>({});
  const load = useCallback(() => { team().then(setData); onChange(); }, [onChange]);
  useEffect(() => { team().then(setData); }, []);
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://premier-booking.netlify.app';

  async function add() {
    setMsg(null); setBusy(true);
    try {
      const had = await addTeamMember({ ...f, email: f.email.trim() });
      setMsg({ tone: 'good', text: had
        ? `${f.name} already had an account, so they're on the team now. They'll see the Guide view next time they open the app.`
        : `${f.name} is added. Send them this: "Make your login at ${origin}/sign-in with ${f.email.trim()} (tap New account), then fill out your profile${f.worker_type === 'subcontractor' ? ' and W-9' : ''}."` });
      setF({ ...f, name: '', email: '', phone: '' });
      load();
    } catch (e) { setMsg({ tone: 'bad', text: (e as Error).message }); }
    setBusy(false);
  }
  async function showTin(id: string) {
    try { setTins({ ...tins, [id]: (await revealTin(id)) ?? 'none' }); } catch (e) { setMsg({ tone: 'bad', text: (e as Error).message }); }
  }
  const form = (id: string) => data.forms.find((x) => x.profile_id === id);
  return (
    <View style={{ gap: 12 }}>
      <H2 style={{ marginTop: 0 }}>Add a guide, house owner or employee</H2>
      <Card>
        <Row gap={12}>
          <View style={{ flexBasis: 220, flexGrow: 1 }}><Field label="Name" value={f.name} onChangeText={(t) => setF({ ...f, name: t })} /></View>
          <View style={{ flexBasis: 220, flexGrow: 1 }}><Field label="Email (their login)" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(t) => setF({ ...f, email: t })} /></View>
          <View style={{ flexBasis: 160, flexGrow: 1 }}><Field label="Mobile" keyboardType="phone-pad" value={f.phone} onChangeText={(t) => setF({ ...f, phone: t })} /></View>
        </Row>
        <Row gap={8} style={{ marginBottom: 10 }}>
          {(Object.keys(TEAM_TYPES) as (keyof typeof TEAM_TYPES)[]).map((k) => <Chip key={k} label={TEAM_TYPES[k]} active={f.team_type === k} onPress={() => setF({ ...f, team_type: k })} />)}
          <Text style={{ color: colors.muted }}>·</Text>
          {(Object.keys(WORKER_TYPES) as (keyof typeof WORKER_TYPES)[]).map((k) => <Chip key={k} label={WORKER_TYPES[k]} active={f.worker_type === k} onPress={() => setF({ ...f, worker_type: k })} />)}
        </Row>
        <P muted style={{ fontSize: 14, marginBottom: 10 }}>
          They make their own login with this email. Subcontractors fill out a W-9 the first time they sign in. They only see their own jobs, never the admin side.
        </P>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button title="Add to team" onPress={add} busy={busy} disabled={!f.name.trim() || !f.email.includes('@')} />
      </Card>

      <H2>Team</H2>
      {data.members.map((p) => {
        const w = form(p.id);
        return (
          <Card key={p.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '800', fontSize: 17, color: colors.navy }}>{p.full_name || p.email}</Text>
              <Text style={{ color: colors.muted }}>{[p.role === 'admin' ? 'Administrator' : null, p.team_type ? TEAM_TYPES[p.team_type] : null, p.worker_type ? WORKER_TYPES[p.worker_type] : null].filter(Boolean).join(' · ')}</Text>
            </Row>
            <P muted>{[p.email, p.phone].filter(Boolean).join(' · ')}</P>
            <P muted>{[
              p.onboarded_at ? 'Profile done' : 'Profile not filled out yet',
              p.worker_type === 'subcontractor' ? (w ? `W-9 on file (${w.tin_type.toUpperCase()} ending ${w.tin_last4})` : 'W-9 missing') : null,
              p.guide_license ? `Guide license ${p.guide_license}` : null, p.captain_license ? `Captain ${p.captain_license}` : null,
            ].filter(Boolean).join(' · ')}</P>
            {w ? <P muted>{`W-9: ${w.legal_name}${w.business_name ? ` (${w.business_name})` : ''}, ${w.address}, ${w.city_state_zip}`}</P> : null}
            {tins[p.id] ? <Notice>{`Full tax ID: ${tins[p.id]} (for 1099 filing; don't share)`}</Notice> : null}
            <Row gap={8}>
              <Button small kind="ghost" title="See their dashboard" href={`/guide?as=${p.id}`} />
              {w ? <Button small kind="ghost" title="Show full tax ID" onPress={() => showTin(p.id)} /> : null}
              {p.role === 'partner' ? <Button small kind="ghost" title="Remove from team" onPress={async () => { await setRole(p.id, 'guest'); load(); }} /> : null}
            </Row>
          </Card>
        );
      })}
      {data.waiting.length ? (
        <>
          <H2>Added, no login yet</H2>
          {data.waiting.map((p) => (
            <P key={p.email}>{`${p.full_name || p.email} · ${p.email}${p.team_type ? ` · ${TEAM_TYPES[p.team_type]}` : ''}${p.worker_type ? ` · ${WORKER_TYPES[p.worker_type]}` : ''}`}</P>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Waivers({ bookings, waivers }: Ctx) {
  const today = iso(new Date());
  const trips = bookings.filter((b) => b.listing?.kind === 'trip' && (b.status === 'accepted' || b.status === 'requested') && b.end_date >= today);
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://premier-booking.netlify.app';
  return (
    <View style={{ gap: 10 }}>
      <P muted>Guests sign from My trips on their phone, or from the link below. Edit the waiver wording under Settings.</P>
      {trips.map((b) => {
        const w = waivers.filter((x) => x.booking_id === b.id);
        return (
          <Card key={b.id} style={{ gap: 2 }}>
            <Text style={{ fontWeight: '800', color: w.length ? colors.good : colors.water }}>{w.length ? `Signed (${w.length})` : 'Waiting for signature'}</Text>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{`${b.guest_name} · ${b.listing?.title ?? ''}`}</Text>
            <P muted>{when(b)}</P>
            {w.map((x) => <P key={x.id} muted>{`${x.signer_name}${x.minors ? `, for minors: ${x.minors}` : ''} · ${new Date(x.signed_at).toLocaleDateString()}`}</P>)}
            {!w.length ? <P muted selectable>{`Send the guest: ${origin}/waiver/${b.id}`}</P> : null}
          </Card>
        );
      })}
      {!trips.length ? <P muted>No upcoming trips.</P> : null}
    </View>
  );
}

function Settings({ bookings, assignments, people }: Ctx) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { waiverText().then(setText); }, []);
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://premier-booking.netlify.app';
  function csv(name: string, rows: (string | number | null | undefined)[][]) {
    if (Platform.OS !== 'web') return;
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = name; a.click();
  }
  const who = (id: string) => people.find((p) => p.id === id)?.full_name ?? '';
  function exportBookings() {
    csv('premier-booking-bookings.csv', [['Start', 'End', 'Listing', 'Guest', 'Email', 'Phone', 'Guests', 'Status', 'Estimated total', 'Crew'],
      ...bookings.map((b) => [b.start_date, b.end_date, b.listing?.title, b.guest_name, b.guest_email, b.guest_phone, b.guests, b.status,
        (b.total_cents / 100).toFixed(2), assignments.filter((a) => a.booking_id === b.id && a.status === 'accepted').map((a) => `${who(a.assignee_id)} (${a.job})`).join('; ')])]);
  }
  async function exportContractors() {
    const t = await team();
    csv('premier-booking-contractors.csv', [['Name', 'Email', 'Phone', 'Type', 'W-9 legal name', 'Business', 'Tax class', 'Address', 'City/State/ZIP', 'TIN type', 'TIN last 4', 'Signed', 'Jobs accepted'],
      ...t.members.filter((p) => p.worker_type === 'subcontractor').map((p) => {
        const w = t.forms.find((x) => x.profile_id === p.id);
        return [p.full_name, p.email, p.phone, p.team_type, w?.legal_name, w?.business_name, w?.tax_class, w?.address, w?.city_state_zip, w?.tin_type, w?.tin_last4,
          w?.signed_at?.slice(0, 10), assignments.filter((a) => a.assignee_id === p.id && a.status === 'accepted').length];
      })]);
  }
  return (
    <View style={{ gap: 12 }}>
      <H2 style={{ marginTop: 0 }}>Waiver wording</H2>
      <Card>
        <P muted style={{ fontSize: 14, marginBottom: 8 }}>This is a starting draft. Have your attorney or insurance agent check it. New signatures use the wording saved here; past ones keep what the guest signed.</P>
        <Field label="Waiver" multiline value={text} onChangeText={setText} style={{ minHeight: 320 }} />
        {msg ? <Notice tone="good">{msg}</Notice> : null}
        <Button title="Save waiver" onPress={async () => { await saveSetting('waiver_text', text); setMsg('Saved.'); }} />
      </Card>
      <H2>For your accountant</H2>
      <Card style={{ gap: 8 }}>
        <P>Download spreadsheets to send your accountant. Full tax IDs are not in the download; open them one at a time under Team when filing 1099s.</P>
        <Row>
          <Button kind="secondary" title="Bookings spreadsheet" onPress={exportBookings} />
          <Button kind="secondary" title="Subcontractors and W-9s" onPress={exportContractors} />
        </Row>
      </Card>
      <H2>Links for pocpremierlodge.com</H2>
      <Card style={{ gap: 4 }}>
        <P>Point the website's buttons here:</P>
        <P selectable>{`Book the lodge: ${origin}/stays/poc-premier-lodge`}</P>
        <P selectable>{`Book a fishing trip: ${origin}/search?kind=trip`}</P>
        <P selectable>{`Everything: ${origin}/`}</P>
        <P selectable>{`Guide and crew login: ${origin}/guide`}</P>
      </Card>
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

function Customers() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<'all' | 'email' | 'sms'>('all');
  useEffect(() => { customers().then(setRows); }, []);
  const shown = rows.filter((p) => filter === 'all' || (filter === 'email' ? p.marketing_email : p.marketing_sms));
  function download() {
    if (Platform.OS !== 'web') return;
    const head = ['Name', 'Email', 'Phone', 'Home city', 'Emails OK', 'Texts OK', 'Joined', 'Last booking'];
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head, ...shown.map((p) => [p.full_name, p.email, p.phone, p.home_city, p.marketing_email ? 'yes' : 'no',
      p.marketing_sms ? 'yes' : 'no', p.created_at?.slice(0, 10), p.last_booking_at?.slice(0, 10)])].map((r) => r.map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `premier-booking-customers-${filter}.csv`;
    a.click();
  }
  return (
    <View style={{ gap: 10 }}>
      <P muted>Everyone with an account. Only send deals to people who opted in.</P>
      <Row gap={8}>
        <Chip label={`All (${rows.length})`} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`OK to email (${rows.filter((p) => p.marketing_email).length})`} active={filter === 'email'} onPress={() => setFilter('email')} />
        <Chip label={`OK to text (${rows.filter((p) => p.marketing_sms).length})`} active={filter === 'sms'} onPress={() => setFilter('sms')} />
        {Platform.OS === 'web' ? <Button small kind="secondary" title="Download list" onPress={download} /> : null}
      </Row>
      {shown.map((p) => (
        <Card key={p.id} style={{ gap: 2 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{p.full_name || p.email}</Text>
          <P muted>{[p.email, p.phone, p.home_city].filter(Boolean).join(' · ')}</P>
          <P muted>{`${p.marketing_email ? 'Emails OK' : 'No deal emails'} · ${p.marketing_sms ? 'Texts OK' : 'No deal texts'}${p.last_booking_at ? ` · last request ${p.last_booking_at.slice(0, 10)}` : ''}${p.role !== 'guest' ? ` · ${p.role}` : ''}`}</P>
        </Card>
      ))}
      {!shown.length ? <P muted>No one here yet.</P> : null}
    </View>
  );
}
