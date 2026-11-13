import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, H1, Notice, P, Page, Seo } from '../../components/ui';
import { redeemInvite } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export async function generateStaticParams() { return []; }

// A guide or house owner opens the invite link Jason sent, signs in, and becomes a partner.
export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function accept() {
    setBusy(true); setError('');
    try { await redeemInvite(code); await refresh(); setDone(true); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <Page>
      <Seo title="Join as a host" description="Accept your invite to list on Premier Booking." />
      <View style={{ maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <H1>Join Premier Booking</H1>
        <Card style={{ gap: 12 }}>
          {done ? (
            <>
              <P>You're in. Add your boat, trips or house from the host dashboard.</P>
              <Button title="Open host dashboard" href="/host" />
            </>
          ) : !session ? (
            <>
              <P>You've been invited to list your trips or house. Sign in or make an account first, then come back to this link.</P>
              <Button title="Sign in" href={`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`} />
            </>
          ) : (
            <>
              <P>{`Signed in as ${session.user.email}. Accept the invite to get your host dashboard.`}</P>
              {error ? <Notice tone="bad">{error}</Notice> : null}
              <Button title="Accept invite" onPress={accept} busy={busy} />
            </>
          )}
        </Card>
      </View>
    </Page>
  );
}
