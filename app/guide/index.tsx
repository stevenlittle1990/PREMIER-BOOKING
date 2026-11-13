import { webData } from '../../lib/web';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Calendar, type DayMark } from '../../components/Calendar';
import { Notifications } from '../../components/Notifications';
import { Button, Card, Chip, Eyebrow, Field, H1, H2, Notice, P, Page, Row, Seo, Stat, ViewTabs } from '../../components/ui';
import { jobsFor, myTaxForm, profileById, respondJob, team, waiversFor, type JobRow } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, iso, niceDate } from '../../lib/format';
import { hasDatabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { TEAM_TYPES, type Profile, type TaxForm, type Waiver } from '../../lib/types';

// A guide's (or subcontractor's) own section: jobs to accept, their calendar, paperwork. Sees nothing else.
export default function GuideDashboard() {
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { ready, session, profile, isHost, isAdmin } = useAuth();
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [w9, setW9] = useState<TaxForm | null>(null);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [today, setToday] = useState('');
  useEffect(() => setToday(iso(new Date())), []);

  const preview = Boolean(isAdmin && as && as !== session?.user.id);
  const who = preview ? viewing : profile;

  const load = useCallback(async () => {
    if (!session) return;
    const id = preview ? as! : session.user.id;
    if (preview) setViewing(await profileById(id));
    const j = await jobsFor(id);
    setJobs(j);
    setW9(await myTaxForm(id));
    setWaivers(await waiversFor(j.map((x) => x.booking_id)));
  }, [session, preview, as]);
  useEffect(() => { if (isHost) load(); }, [isHost, load]);
  useEffect(() => { if (isAdmin) team().then((t) => setPeople(t.members)); }, [isAdmin]);

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const j of jobs ?? []) {
      if (j.status === 'declined' || !j.booking || j.booking.status === 'cancelled' || j.booking.status === 'declined') continue;
      const b = j.booking;
      const last = b.end_date > b.start_date ? addDays(b.end_date, -1) : b.start_date;
      for (let d = b.start_date; d <= last; d = addDays(d, 1)) m[d] = j.status === 'accepted' ? 'booked' : 'requested';
    }
    return m;
  }, [jobs]);

  if (!hasDatabase) return <Page><H1>My jobs</H1><Notice>Opens once the database is connected.</Notice></Page>;
  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>Guides and crew</H1><P>Sign in with the email the admin added you with.</P><View style={{ maxWidth: 220, marginTop: 12 }}><Button title="Sign in" href="/sign-in?next=/guide" /></View></Page>;
  if (!isHost) return <Page><H1>Guides and crew</H1><P>This account isn't on the team yet. Ask the admin to add your email, then sign in again.</P></Page>;

  const live = (jobs ?? []).filter((j) => j.booking && j.booking.status !== 'cancelled' && j.booking.status !== 'declined');
  const waiting = live.filter((j) => j.status === 'pending');
  const upcoming = live.filter((j) => j.status === 'accepted' && j.booking!.end_date >= today);
  const onDay = day ? live.filter((j) => j.status !== 'declined' && j.booking!.start_date <= day && day <= (j.booking!.end_date > j.booking!.start_date ? addDays(j.booking!.end_date, -1) : j.booking!.start_date)) : [];
  const needsW9 = who?.worker_type === 'subcontractor' && !w9;
  const needsProfile = !who?.onboarded_at;

  return (
    <Page>
      <Seo title="My jobs" description="Jobs, calendar and paperwork for guides and crew." />
      <ViewTabs current="guide" />
      <Eyebrow>{preview ? 'Admin preview' : who?.team_type ? TEAM_TYPES[who.team_type] : 'Team'}</Eyebrow>
      <H1>{preview ? `${who?.full_name || who?.email || 'Team member'}'s jobs` : 'My jobs'}</H1>
      {isAdmin ? (
        <Row gap={8} style={{ marginBottom: 6 }}>
          <Text style={{ color: colors.muted }}>See the guide view for:</Text>
          <Chip label="Me" active={!preview} onPress={() => router.setParams({ as: '' })} />
          {people.filter((p) => p.id !== session.user.id).map((p) => (
            <Chip key={p.id} label={p.full_name || p.email || 'Member'} active={as === p.id} onPress={() => router.setParams({ as: p.id })} />
          ))}
        </Row>
      ) : null}
      {preview ? <Notice>{"You're seeing what they see. Only they can accept or decline their jobs."}</Notice> : null}

      {(needsProfile || needsW9) && !preview ? (
        <Card style={{ marginTop: 12, borderColor: colors.water, gap: 6 }}>
          <Text style={{ fontWeight: '800', fontSize: 17, color: colors.navy }}>Finish your paperwork</Text>
          <P>{needsW9 ? 'Fill in your profile and W-9 so you can be paid. Takes about 3 minutes.' : 'Fill in your profile so the office and guests know who you are.'}</P>
          <Row><Button title="Start" href="/guide/onboarding" /></Row>
        </Card>
      ) : null}

      <Row gap={10} style={{ marginTop: 14 }}>
        <Stat value={waiting.length} label="Waiting on you" tone={waiting.length ? 'warn' : undefined} />
        <Stat value={upcoming.length} label="Coming up" />
        <Stat value={w9 ? `W-9 ✓` : who?.worker_type === 'subcontractor' ? 'W-9 needed' : 'No W-9 needed'} label={w9 ? `Tax ID ending ${w9.tin_last4}` : 'Paperwork'} />
      </Row>

      {!preview ? <Notifications limit={5} /> : null}

      <H2>Waiting on you</H2>
      {jobs === null ? <P>Loading…</P> : waiting.length ? waiting.map((j) => <JobCard key={j.id} j={j} waivers={waivers} reload={load} canAnswer={!preview} />) : <P muted>Nothing to answer right now.</P>}

      <H2>My calendar</H2>
      <Card><Calendar busy={marks} onDayPress={setDay} months={1} /></Card>
      <P muted style={{ fontSize: 13, marginTop: 6 }}>Dark days are confirmed jobs, light blue are waiting on your answer. Tap a day to see it.</P>
      {day ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text style={{ fontWeight: '800', color: colors.navy }}>{niceDate(day)}</Text>
          {onDay.length ? onDay.map((j) => <JobCard key={j.id} j={j} waivers={waivers} reload={load} canAnswer={!preview} />) : <P muted>No jobs this day.</P>}
        </View>
      ) : null}

      <H2>Coming up</H2>
      {upcoming.length ? upcoming.map((j) => <JobCard key={j.id} j={j} waivers={waivers} reload={load} canAnswer={!preview} />) : <P muted>No confirmed jobs yet.</P>}

      {!preview ? <View style={{ marginTop: 24, maxWidth: 260 }}><Button title="Edit my profile and W-9" kind="ghost" href="/guide/onboarding" /></View> : null}
    </Page>
  );
}

function JobCard({ j, waivers, reload, canAnswer }: { j: JobRow; waivers: Waiver[]; reload: () => void; canAnswer: boolean }) {
  const b = j.booking!;
  const l = b.listing;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'' | 'yes' | 'no'>('');
  const [error, setError] = useState('');
  const signed = waivers.filter((w) => w.booking_id === b.id).length;
  const where = l?.meeting_point || l?.address;
  async function answer(yes: boolean) {
    setBusy(yes ? 'yes' : 'no'); setError('');
    try { await respondJob(j.id, yes, note.trim()); reload(); } catch (e) { setError((e as Error).message); }
    setBusy('');
  }
  return (
    <Card style={{ gap: 4, marginBottom: 10 }}>
      <Text style={{ fontWeight: '800', color: j.status === 'accepted' ? colors.good : j.status === 'declined' ? colors.bad : colors.water }}>
        {j.status === 'accepted' ? 'You accepted' : j.status === 'declined' ? 'You declined' : `New job: ${j.job}`}
      </Text>
      <Text {...webData('display')} style={{ fontSize: 20, color: colors.navy }}>{l?.title ?? 'Booking'}</Text>
      <P>{`${b.start_date === b.end_date ? niceDate(b.start_date) : `${niceDate(b.start_date)} → ${niceDate(b.end_date)}`}${b.start_time ? ` · ${b.start_time}` : ''} · ${b.guests} guests`}</P>
      <P>{`Guest: ${b.guest_name}`}</P>
      <Row gap={14}>
        {b.guest_phone ? <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => Linking.openURL(`tel:${b.guest_phone}`)}>{`Call ${b.guest_phone}`}</Text> : null}
        {b.guest_phone ? <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => Linking.openURL(`sms:${b.guest_phone}`)}>Text</Text> : null}
        {where ? <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(where)}`)}>{`Map: ${where}`}</Text> : null}
      </Row>
      {l?.kind === 'trip' ? <P muted>{signed ? `Waivers signed: ${signed}` : 'Waiver not signed yet'}</P> : null}
      {b.notes ? <Notice>{`Guest says: ${b.notes}`}</Notice> : null}
      {j.status === 'pending' && canAnswer ? (
        <>
          <Field label="Note to the office (optional)" value={note} onChangeText={setNote} />
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Row>
            <Button title="Accept job" onPress={() => answer(true)} busy={busy === 'yes'} />
            <Button title="Can't do it" kind="ghost" onPress={() => answer(false)} busy={busy === 'no'} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}
