import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, H1, H2, Notice, P, Page, Row, Seo } from '../components/ui';
import { cancelBooking, myBookings } from '../lib/api';
import { useAuth } from '../lib/auth';
import { listingPath, money, niceDate } from '../lib/format';
import { colors } from '../lib/theme';
import type { Booking, Listing } from '../lib/types';

export const STATUS: Record<Booking['status'], { label: string; color: string }> = {
  requested: { label: 'Waiting on host', color: colors.sun },
  accepted: { label: 'Confirmed', color: colors.good },
  declined: { label: 'Declined', color: colors.bad },
  cancelled: { label: 'Cancelled', color: colors.muted },
};

export default function Account() {
  const { ready, session, profile, isHost, signOut } = useAuth();
  const [rows, setRows] = useState<(Booking & { listing: Listing | null })[] | null>(null);
  const load = () => myBookings().then(setRows);
  useEffect(() => { if (session) load(); }, [session]);

  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>My trips</H1><P>Sign in to see your bookings.</P><View style={{ marginTop: 12, maxWidth: 200 }}><Button title="Sign in" href="/sign-in" /></View></Page>;

  return (
    <Page>
      <Seo title="My trips" description="Your bookings." />
      <H1>My trips</H1>
      <P muted>{profile?.full_name ? `${profile.full_name} · ` : ''}{session.user.email}</P>
      {isHost ? <View style={{ marginTop: 10, maxWidth: 260 }}><Button title="Open host dashboard" href="/host" kind="secondary" /></View> : null}
      <H2>Bookings</H2>
      {rows === null ? <P>Loading…</P> : rows.length === 0 ? <P>No bookings yet. <Link href="/search"><Text style={{ color: colors.water }}>Find a place or a trip</Text></Link></P> : (
        <View style={{ gap: 12 }}>
          {rows.map((b) => (
            <Card key={b.id} style={{ gap: 4 }}>
              <Text style={{ color: STATUS[b.status].color, fontWeight: '800' }}>{STATUS[b.status].label}</Text>
              {b.listing ? <Link href={listingPath(b.listing) as never}><Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy }}>{b.listing.title}</Text></Link> : null}
              <P>{b.start_date === b.end_date ? niceDate(b.start_date) : `${niceDate(b.start_date)} → ${niceDate(b.end_date)}`}{b.start_time ? ` · ${b.start_time}` : ''} · {b.guests} guests</P>
              {b.total_cents ? <P muted>{`Estimated ${money(b.total_cents)}`}</P> : null}
              {b.host_note ? <Notice>{`From the host: ${b.host_note}`}</Notice> : null}
              {b.status === 'requested' || b.status === 'accepted' ? (
                <Row><Button small kind="ghost" title="Cancel" onPress={async () => { await cancelBooking(b.id); load(); }} /></Row>
              ) : null}
            </Card>
          ))}
        </View>
      )}
      <View style={{ marginTop: 24, maxWidth: 200 }}><Button title="Sign out" kind="ghost" onPress={signOut} /></View>
    </Page>
  );
}
