import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Eyebrow, Field, H1, Notice, P, Page, Seo } from '../../components/ui';
import { bookingById, signWaiver, waiversFor, waiverText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { niceDate } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import type { Booking, Listing, Waiver } from '../../lib/types';

export async function generateStaticParams() { return []; }

// The guest signs the trip waiver for their booking, from their phone.
export default function SignWaiverPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, session, profile } = useAuth();
  const [booking, setBooking] = useState<(Booking & { listing: Listing | null }) | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [signed, setSigned] = useState<Waiver[]>([]);
  const [name, setName] = useState('');
  const [minors, setMinors] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !id) return;
    bookingById(id).then(setBooking);
    waiverText().then(setText);
    waiversFor([id]).then(setSigned);
  }, [session, id]);
  useEffect(() => { if (profile?.full_name) setName((n) => n || profile.full_name); }, [profile]);

  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session) return <Page><H1>Trip waiver</H1><P>Sign in to sign your waiver.</P><View style={{ maxWidth: 220, marginTop: 12 }}><Button title="Sign in" href={`/sign-in?next=/waiver/${id}`} /></View></Page>;
  if (booking === undefined) return <Page><P>Loading…</P></Page>;
  if (!booking) return <Page><H1>Trip waiver</H1><P>We couldn't find that booking on your account.</P></Page>;
  const mine = signed.find((w) => w.signer_id === session.user.id);

  async function sign() {
    setError(''); setBusy(true);
    try {
      await signWaiver(booking!.id, name.trim(), minors.trim(), text);
      setSigned(await waiversFor([booking!.id]));
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <Page>
      <Seo title="Trip waiver" description="Sign your trip waiver." />
      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Eyebrow>Digital waiver</Eyebrow>
        <H1>{booking.listing?.title ?? 'Your trip'}</H1>
        <P muted>{`${niceDate(booking.start_date)}${booking.start_time ? ` · ${booking.start_time}` : ''} · ${booking.guests} guests`}</P>
        {mine ? (
          <Notice tone="good">{`Signed by ${mine.signer_name} on ${new Date(mine.signed_at).toLocaleDateString()}. You're all set.`}</Notice>
        ) : (
          <>
            <Card style={{ marginTop: 14, padding: 0 }}>
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 16 }}>
                <Text style={{ fontSize: 15, lineHeight: 23, color: colors.text }}>{text || 'Loading…'}</Text>
              </ScrollView>
            </Card>
            <Card style={{ marginTop: 12 }}>
              <Field label="Your full name (this is your signature)" value={name} onChangeText={setName} autoComplete="name" />
              <Field label="Minors you're signing for (names and ages, optional)" value={minors} onChangeText={setMinors} placeholder="Jake, 12; Emma, 9" />
              <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ width: 22, height: 22, borderRadius: radius, borderWidth: 2, borderColor: colors.navy, backgroundColor: agree ? colors.navy : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {agree ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
                </View>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>I have read this waiver and agree to it. Typing my name counts as my signature.</Text>
              </Pressable>
              {error ? <Notice tone="bad">{error}</Notice> : null}
              <Button title="Sign waiver" onPress={sign} busy={busy} disabled={!agree || name.trim().length < 3 || !text} />
            </Card>
          </>
        )}
        <View style={{ marginTop: 16, maxWidth: 220 }}><Button title="Back to my trips" kind="ghost" onPress={() => router.replace('/account')} /></View>
      </View>
    </Page>
  );
}
