import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, H1, Notice, P, Page, Seo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// Email code sign-in: no passwords to forget. New emails get an account automatically.
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { session, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = () => router.replace((next && next.startsWith('/') ? next : '/account') as never);

  if (!supabase) return <Page><H1>Sign in</H1><Notice>Accounts open once the database is connected.</Notice></Page>;
  if (session) return <Page><H1>You're signed in</H1><P>{session.user.email}</P><View style={{ marginTop: 12, maxWidth: 240 }}><Button title="Continue" onPress={go} /></View></Page>;

  async function sendCode() {
    setError(''); setBusy(true);
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: {
      data: name ? { full_name: name.trim() } : undefined,
      // The email has a sign-in link (and a code if the template includes one). The link brings them back here.
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}` : undefined,
    } });
    setBusy(false);
    if (error) return setError(error.message);
    setStage('code');
  }
  async function verify() {
    setError(''); setBusy(true);
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    go();
  }

  return (
    <Page>
      <Seo title="Sign in" description="Sign in to book and see your trips." />
      <View style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}>
        <H1>Sign in</H1>
        <Card>
          {stage === 'email' ? (
            <>
              <P muted style={{ marginBottom: 12 }}>We'll email you a sign-in link. New here? This makes your account.</P>
              <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <Field label="Your name (new accounts)" value={name} onChangeText={setName} />
              {error ? <Notice tone="bad">{error}</Notice> : null}
              <Button title="Email me a sign-in link" onPress={sendCode} busy={busy} disabled={!email.includes('@')} />
            </>
          ) : (
            <>
              <P style={{ marginBottom: 12 }}>{`Check ${email}. Tap the sign-in link in the email, or type the code here if the email has one.`}</P>
              <Field label="Code" keyboardType="number-pad" value={code} onChangeText={setCode} autoFocus />
              {error ? <Notice tone="bad">{error}</Notice> : null}
              <Button title="Sign in" onPress={verify} busy={busy} disabled={code.trim().length < 6} />
              <View style={{ marginTop: 8 }}><Button title="Use a different email" kind="ghost" onPress={() => setStage('email')} /></View>
            </>
          )}
        </Card>
      </View>
    </Page>
  );
}
