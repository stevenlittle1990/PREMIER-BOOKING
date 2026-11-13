import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Eyebrow, Field, H1, Notice, P, Page, Seo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { hasDatabase, supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';

type Mode = 'signin' | 'signup' | 'link';

// Customers, guides and the admin all sign in here. Password by default (easy on a phone); an emailed link also works.
export default function SignIn() {
  const { next, mode: startMode } = useLocalSearchParams<{ next?: string; mode?: string }>();
  const { session, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  // "Create an account" buttons open straight on the new-account tab.
  useEffect(() => { if (startMode === 'signup' || startMode === 'link') setMode(startMode); }, [startMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const go = () => router.replace((next && next.startsWith('/') ? next : '/account') as never);
  const back = typeof window !== 'undefined' ? `${window.location.origin}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}` : undefined;

  if (!hasDatabase) return <Page><H1>Sign in</H1><Notice>Accounts open once the database is connected.</Notice></Page>;
  if (session) return <Page><H1>You're signed in</H1><P>{session.user.email}</P><View style={{ marginTop: 12, maxWidth: 240 }}><Button title="Continue" onPress={go} /></View></Page>;

  async function run(fn: () => Promise<void>) {
    setError(''); setInfo(''); setBusy(true);
    try { await fn(); } catch (e) { setError(friendly((e as Error).message)); }
    setBusy(false);
  }

  const signIn = () => run(async () => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await refresh(); go();
  });

  const signUp = () => run(async () => {
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password, options: {
      data: { full_name: name.trim(), phone: phone.trim() || undefined }, emailRedirectTo: back,
    } });
    if (error) throw error;
    if (data.session) { await refresh(); go(); return; }
    setInfo(`Almost done. We sent a confirmation email to ${email.trim()}. Tap the link in it, then sign in here.`);
    setMode('signin');
  });

  const sendLink = () => run(async () => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back } });
    if (error) throw error;
    setSent(true);
  });

  const verify = () => run(async () => {
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) throw error;
    await refresh(); go();
  });

  const okEmail = email.includes('@') && email.includes('.');
  return (
    <Page>
      <Seo title="Sign in" description="Sign in or create an account to book houses and fishing trips." />
      <View style={{ maxWidth: 460, width: '100%', alignSelf: 'center' }}>
        <Eyebrow>Your account</Eyebrow>
        <H1>{mode === 'signup' ? 'Create your account' : 'Sign in'}</H1>
        <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: radius, overflow: 'hidden', marginBottom: 14, backgroundColor: '#fff' }}>
          {([['signin', 'Sign in'], ['signup', 'New account'], ['link', 'Email me a link']] as [Mode, string][]).map(([k, label]) => (
            <Pressable key={k} onPress={() => { setMode(k); setError(''); setSent(false); }}
              style={{ flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: mode === k ? colors.navy : 'transparent' }}>
              <Text style={{ color: mode === k ? '#fff' : colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Card>
          {info ? <Notice tone="good">{info}</Notice> : null}
          {mode === 'signup' ? (
            <>
              <Field label="Your name" autoComplete="name" value={name} onChangeText={setName} />
              <Field label="Mobile phone" keyboardType="phone-pad" autoComplete="tel" placeholder="For booking updates" value={phone} onChangeText={setPhone} />
            </>
          ) : null}
          <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          {mode !== 'link' ? (
            <Field label="Password" secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChangeText={setPassword} onSubmitEditing={mode === 'signin' ? signIn : signUp} />
          ) : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          {mode === 'signin' ? (
            <>
              <Button title="Sign in" onPress={signIn} busy={busy} disabled={!okEmail || !password} />
              <P muted style={{ fontSize: 14, marginTop: 10 }}>Forgot your password, or got a team invite? Use "Email me a link".</P>
            </>
          ) : mode === 'signup' ? (
            <>
              <Button title="Create account" onPress={signUp} busy={busy} disabled={!okEmail || !password || !name.trim()} />
              <P muted style={{ fontSize: 13, marginTop: 10 }}>We use your phone and email for booking updates. Deals are optional and off until you turn them on.</P>
            </>
          ) : !sent ? (
            <Button title="Email me a sign-in link" onPress={sendLink} busy={busy} disabled={!okEmail} />
          ) : (
            <>
              <P style={{ marginBottom: 12 }}>{`Check ${email}. Tap the link in the email, or type the code here if the email has one.`}</P>
              <Field label="Code" keyboardType="number-pad" value={code} onChangeText={setCode} />
              <Button title="Sign in" onPress={verify} busy={busy} disabled={code.trim().length < 6} />
            </>
          )}
        </Card>
      </View>
    </Page>
  );
}

function friendly(m: string) {
  if (/invalid login/i.test(m)) return 'That email and password don\'t match. Try again, or use "Email me a link".';
  if (/not confirmed/i.test(m)) return 'Confirm your email first: tap the link we sent you.';
  if (/already registered/i.test(m)) return 'That email already has an account. Sign in instead.';
  if (/rate limit/i.test(m)) return 'Too many emails sent for now. Wait a few minutes and try again.';
  return m;
}
