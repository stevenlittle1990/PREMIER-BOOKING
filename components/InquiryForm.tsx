import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { guestInquiry, requestBookings, saveMyProfile, type InquiryItem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { hasDatabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Button, Field, Notice, OPT_IN_EMAIL, OPT_IN_SMS, OptIn, P, Row } from './ui';

// The last step of every inquiry: signed-in customers just send; everyone else picks
// "Create an account" or "Check out as guest" (name, email and phone, no login).
export function InquiryForm({ items, next, buttonTitle, ready = true, check, notesLabel = 'Anything we should know? (optional)', notesPlaceholder, onSent }: {
  items: (notes: string) => InquiryItem[];
  next: string;
  buttonTitle: string;
  ready?: boolean;
  check?: () => string | null;
  notesLabel?: string;
  notesPlaceholder?: string;
  onSent: (guest: { email: string } | null) => void;
}) {
  const { session, profile } = useAuth();
  const [guest, setGuest] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [optSms, setOptSms] = useState(false);
  const [optEmail, setOptEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (profile) { setName((n) => n || profile.full_name); setPhone((p) => p || profile.phone || ''); } }, [profile]);

  if (!hasDatabase) return <Notice>Online booking opens soon. Call 361-210-8494 to book.</Notice>;

  if (!session && !guest) {
    return (
      <View style={{ gap: 10 }}>
        <Button title="Create an account" href={`/sign-in?mode=signup&next=${encodeURIComponent(next)}`} disabled={!ready} />
        <Button title="Check out as guest" kind="secondary" onPress={() => setGuest(true)} disabled={!ready} />
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
          {'Already have an account? '}
          <Link href={`/sign-in?next=${encodeURIComponent(next)}` as never}><Text style={{ color: colors.water, fontWeight: '700' }}>Sign in</Text></Link>
        </Text>
        <P muted style={{ fontSize: 13 }}>An account lets you see your trips, sign waivers and get updates in the app.</P>
      </View>
    );
  }

  async function send() {
    setError('');
    const problem = check?.();
    if (problem) return setError(problem);
    if (!name.trim() || !phone.trim()) return setError('Add your name and a phone number so we can reach you.');
    if (!session && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Add your email so we can send your quote.');
    setBusy(true);
    try {
      const list = items(notes.trim());
      if (session) {
        await requestBookings(list.map((i) => ({ ...i, guest_name: name.trim(), guest_email: session.user.email ?? '', guest_phone: phone.trim(), total_cents: 0 })));
        // Saying yes here turns specials on for their account too (never turns them off).
        const patch: Record<string, unknown> = {};
        if (!profile?.phone && phone.trim()) patch.phone = phone.trim();
        if (optSms && !profile?.marketing_sms) patch.marketing_sms = true;
        if (optEmail && !profile?.marketing_email) patch.marketing_email = true;
        if (Object.keys(patch).length) await saveMyProfile(patch).catch(() => {});
        onSent(null);
      } else {
        await guestInquiry(list, { name: name.trim(), email: email.trim(), phone: phone.trim(), marketingSms: optSms, marketingEmail: optEmail });
        onSent({ email: email.trim() });
      }
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <View>
      {!session ? (
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 16 }}>Checking out as a guest</Text>
          <Text onPress={() => setGuest(false)} style={{ color: colors.water, fontWeight: '700', paddingVertical: 6 }}>Back</Text>
        </Row>
      ) : null}
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />
      {!session ? <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" /> : null}
      <Field label="Mobile phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoComplete="tel" />
      <Field label={notesLabel} multiline placeholder={notesPlaceholder} value={notes} onChangeText={setNotes} />
      {!session || !profile?.marketing_sms ? <OptIn label={OPT_IN_SMS} value={optSms} onChange={setOptSms} /> : null}
      {!session || !profile?.marketing_email ? <OptIn label={OPT_IN_EMAIL} value={optEmail} onChange={setOptEmail} /> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Button title={buttonTitle} onPress={send} busy={busy} disabled={!ready} />
      <P muted style={{ fontSize: 13, marginTop: 8 }}>No payment now. We confirm the dates and send you a quote.</P>
    </View>
  );
}
