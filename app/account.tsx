import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Notifications } from '../components/Notifications';
import { Button, Card, Eyebrow, Field, H1, H2, Notice, P, Page, Row, Seo, ViewTabs } from '../components/ui';
import { cancelBooking, myBookings, saveMyProfile, waiversFor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { listingPath, money, niceDate } from '../lib/format';
import { colors } from '../lib/theme';
import type { Booking, Listing, Profile, Waiver } from '../lib/types';

export const STATUS: Record<Booking['status'], { label: string; color: string }> = {
  requested: { label: 'Inquiry sent', color: colors.water },
  accepted: { label: 'Confirmed', color: colors.good },
  declined: { label: 'Declined', color: colors.bad },
  cancelled: { label: 'Cancelled', color: colors.muted },
};

export default function Account() {
  const { ready, session, profile, signOut } = useAuth();
  const [rows, setRows] = useState<(Booking & { listing: Listing | null })[] | null>(null);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const load = () => myBookings().then((r) => { setRows(r); waiversFor(r.filter((b) => b.listing?.kind === 'trip').map((b) => b.id)).then(setWaivers); });
  useEffect(() => { if (session) load(); }, [session]);

  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>My trips</H1><P>Sign in to see your bookings.</P><View style={{ marginTop: 12, maxWidth: 200 }}><Button title="Sign in" href="/sign-in" /></View></Page>;

  return (
    <Page>
      <Seo title="My trips" description="Your bookings." />
      <ViewTabs current="customer" />
      <Eyebrow>Customer</Eyebrow>
      <H1>My trips</H1>
      <P muted>{profile?.full_name ? `${profile.full_name} · ` : ''}{session.user.email}</P>
      <Notifications />
      <H2>Bookings</H2>
      {rows === null ? <P>Loading…</P> : rows.length === 0 ? <P>No bookings yet. <Link href="/search"><Text style={{ color: colors.water }}>Find a place or a trip</Text></Link></P> : (
        <View style={{ gap: 12 }}>
          {rows.map((b) => (
            <Card key={b.id} style={{ gap: 4 }}>
              <Text style={{ color: STATUS[b.status].color, fontWeight: '800' }}>{STATUS[b.status].label}</Text>
              {b.listing ? <Link href={listingPath(b.listing) as never}><Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy }}>{b.listing.title}</Text></Link> : null}
              <P>{b.start_date === b.end_date ? niceDate(b.start_date) : `${niceDate(b.start_date)} → ${niceDate(b.end_date)}`}{b.start_time ? ` · ${b.start_time}` : ''} · {b.guests} guests</P>
              {b.host_note ? <Notice>{`From the host: ${b.host_note}`}</Notice> : null}
              {b.listing?.kind === 'trip' && (b.status === 'requested' || b.status === 'accepted') ? (
                waivers.some((w) => w.booking_id === b.id && w.signer_id === session.user.id)
                  ? <Text style={{ color: colors.good, fontWeight: '700' }}>Waiver signed</Text>
                  : <Row><Button small title="Sign trip waiver" href={`/waiver/${b.id}`} /></Row>
              ) : null}
              {b.status === 'requested' || b.status === 'accepted' ? (
                <Row><Button small kind="ghost" title="Cancel" onPress={async () => { await cancelBooking(b.id); load(); }} /></Row>
              ) : null}
            </Card>
          ))}
        </View>
      )}
      {profile ? <ProfileCard profile={profile} /> : null}
      <View style={{ marginTop: 24, maxWidth: 200 }}><Button title="Sign out" kind="ghost" onPress={signOut} /></View>
    </Page>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const { refresh } = useAuth();
  const [f, setF] = useState({
    full_name: profile.full_name, phone: profile.phone ?? '', home_city: profile.home_city ?? '',
    marketing_email: profile.marketing_email, marketing_sms: profile.marketing_sms,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  async function save() {
    setBusy(true); setMsg(null);
    try {
      await saveMyProfile({ ...f, phone: f.phone.trim() || null, home_city: f.home_city.trim() || null });
      await refresh();
      setMsg({ tone: 'good', text: 'Saved.' });
    } catch (e) { setMsg({ tone: 'bad', text: (e as Error).message }); }
    setBusy(false);
  }
  return (
    <>
      <H2>Your profile</H2>
      <Card style={{ maxWidth: 620 }}>
        <Field label="Name" value={f.full_name} onChangeText={(t) => setF({ ...f, full_name: t })} />
        <Field label="Mobile phone" keyboardType="phone-pad" value={f.phone} onChangeText={(t) => setF({ ...f, phone: t })} />
        <Field label="Home city" placeholder="Houston, TX" value={f.home_city} onChangeText={(t) => setF({ ...f, home_city: t })} />
        <Consent label="Email me deals, open dates and fishing reports" value={f.marketing_email} onChange={(v) => setF({ ...f, marketing_email: v })} />
        <Consent label="Text me deals and last-minute openings" value={f.marketing_sms} onChange={(v) => setF({ ...f, marketing_sms: v })} />
        <P muted style={{ fontSize: 13, marginVertical: 8 }}>
          Booking updates always come to you. Deals are optional: turn them off here any time, reply STOP to a text, or use the unsubscribe link in an email. Message and data rates may apply.
        </P>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button title="Save profile" onPress={save} busy={busy} />
      </Card>
    </>
  );
}

function Consent({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.water, false: colors.line }} />
      <Text style={{ fontSize: 15, color: colors.text, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}
