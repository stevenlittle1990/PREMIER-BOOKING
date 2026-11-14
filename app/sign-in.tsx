import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Eyebrow, Field, H1, Notice, OPT_IN_EMAIL, OPT_IN_SMS, OptIn, P, Page, Seo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { hasDatabase, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type Mode = 'signin' | 'signup' | 'forgot' | 'password';

// Customers, guides and the admin all sign in here with email and password.
// New accounts: name and email first, we email a confirmation link, the link brings them back here to make a password.
export default function SignIn() {
  const { next, mode: startMode, step } = useLocalSearchParams<{ next?: string; mode?: string; step?: string }>();
  const { session, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const needsPassword = Boolean(session?.user.user_metadata?.set_password) || step === 'password';
  useEffect(() => { if (startMode === 'signup') setMode('signup'); }, [startMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [optSms, setOptSms] = useState(false);
  const [optEmail, setOptEmail] = useState(false);
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dest = next && next.startsWith('/') ? next : '/account';
  const go = () => router.replace(dest as never);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const back = `${origin}/sign-in?step=password&next=${encodeURIComponent(dest)}`;
  const switchTo = (m: Mode) => { setMode(m); setError(''); setSent(''); };

  if (!hasDatabase) return <Page><H1>Sign in</H1><Notice>Accounts open once the database is connected.</Notice></Page>;

  async function run(fn: () => Promise<void>) {
    setError(''); setBusy(true);
    try { await fn(); } catch (e) { setError(friendly((e as Error).message)); }
    setBusy(false);
  }

  const savePassword = () => run(async () => {
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    if (password !== password2) throw new Error('The two passwords don\'t match.');
    const { error } = await supabase!.auth.updateUser({ password, data: { set_password: null } });
    if (error) throw error;
    await refresh(); go();
  });

  // Back from the email link: signed in, now make a password.
  if (session && needsPassword) {
    return (
      <Shell title="Create your password" eyebrow="Almost done">
        <P muted style={{ marginBottom: 12 }}>{`Your email ${session.user.email} is confirmed. Pick a password so you can sign in next time.`}</P>
        <Field label="Password" secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} />
        <Field label="Type it again" secureTextEntry autoComplete="new-password" value={password2} onChangeText={setPassword2} onSubmitEditing={savePassword} />
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button title="Save password and continue" onPress={savePassword} busy={busy} disabled={!password || !password2} />
      </Shell>
    );
  }
  if (session) return <Page><H1>You're signed in</H1><P>{session.user.email}</P><View style={{ marginTop: 12, maxWidth: 240 }}><Button title="Continue" onPress={go} /></View></Page>;

  const signIn = () => run(async () => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await refresh(); go();
  });

  const signUp = () => run(async () => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: {
      shouldCreateUser: true, emailRedirectTo: back,
      data: { full_name: name.trim(), phone: phone.trim() || undefined, marketing_sms: optSms && Boolean(phone.trim()), marketing_email: optEmail, set_password: true },
    } });
    if (error) throw error;
    setSent(`We sent an email to ${email.trim()}. Tap the link in it to confirm, then you'll make your password and you're in.`);
  });

  const forgot = () => run(async () => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: back });
    if (error) throw error;
    setSent(`If ${email.trim()} has an account, we sent it a link. Tap it to make a new password.`);
  });

  const okEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const emailField = <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />;

  if (sent) {
    return (
      <Shell title="Check your email" eyebrow="Your account">
        <Notice tone="good">{sent}</Notice>
        <P muted style={{ fontSize: 14 }}>No email after a few minutes? Check your spam folder, or go back and try again.</P>
        <View style={{ marginTop: 12 }}><Button title="Back to sign in" kind="ghost" onPress={() => switchTo('signin')} /></View>
      </Shell>
    );
  }

  if (mode === 'signup') {
    return (
      <Shell title="Create account" eyebrow="New here">
        <Field label="Your name" autoComplete="name" value={name} onChangeText={setName} />
        {emailField}
        <Field label="Mobile phone" keyboardType="phone-pad" autoComplete="tel" placeholder="For booking updates" value={phone} onChangeText={setPhone} />
        <OptIn label={OPT_IN_SMS} value={optSms} onChange={setOptSms} />
        <OptIn label={OPT_IN_EMAIL} value={optEmail} onChange={setOptEmail} />
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button title="Create account" onPress={signUp} busy={busy} disabled={!okEmail || !name.trim()} />
        <P muted style={{ fontSize: 13, marginTop: 10 }}>We'll email you a link to confirm, then you make your password. We always text and email you about your own bookings; specials only if you check the boxes.</P>
        <Bottom text="Already have an account?" action="Sign in" onPress={() => switchTo('signin')} />
      </Shell>
    );
  }

  if (mode === 'forgot') {
    return (
      <Shell title="Forgot password" eyebrow="Your account">
        <P muted style={{ marginBottom: 12 }}>Type your email and we'll send you a link to make a new password.</P>
        {emailField}
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button title="Email me a reset link" onPress={forgot} busy={busy} disabled={!okEmail} />
        <Bottom text="Remembered it?" action="Sign in" onPress={() => switchTo('signin')} />
      </Shell>
    );
  }

  return (
    <Shell title="Sign in" eyebrow="Your account">
      {emailField}
      <Field label="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
      <Pressable onPress={() => switchTo('forgot')} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 }}>
        <Text style={{ color: colors.water, fontWeight: '700', fontSize: 14 }}>Forgot password?</Text>
      </Pressable>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Button title="Sign in" onPress={signIn} busy={busy} disabled={!okEmail || !password} />
      <Bottom text="New here?" action="Create account" onPress={() => switchTo('signup')} />
    </Shell>
  );
}

function Shell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <Page>
      <Seo title={title} description="Sign in or create an account to book houses and fishing trips." />
      <View style={{ maxWidth: 460, width: '100%', alignSelf: 'center' }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H1>{title}</H1>
        <Card>{children}</Card>
      </View>
    </Page>
  );
}

function Bottom({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 18, paddingTop: 14, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 15 }}>{text}</Text>
      <Pressable onPress={onPress} hitSlop={8}><Text style={{ color: colors.water, fontWeight: '800', fontSize: 15 }}>{action}</Text></Pressable>
    </View>
  );
}

function friendly(m: string) {
  if (/invalid login/i.test(m)) return 'That email and password don\'t match. Try again, or tap "Forgot password?".';
  if (/not confirmed/i.test(m)) return 'Confirm your email first: tap the link we sent you.';
  if (/rate limit|security purposes/i.test(m)) return 'Too many emails sent for now. Wait a few minutes and try again.';
  if (/signups not allowed/i.test(m)) return 'New accounts are turned off right now. Call us at 361-210-8494.';
  return m;
}
