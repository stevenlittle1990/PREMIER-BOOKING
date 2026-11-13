import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, Eyebrow, Field, H1, H2, Notice, P, Page, Row, Seo } from '../../components/ui';
import { myTaxForm, saveMyProfile, saveW9 } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, radius } from '../../lib/theme';
import { TEAM_TYPES, WORKER_TYPES, type TaxForm } from '../../lib/types';

const TAX_CLASSES = [
  ['individual', 'Individual / sole proprietor / single-member LLC'],
  ['c_corp', 'C corporation'],
  ['s_corp', 'S corporation'],
  ['partnership', 'Partnership'],
  ['llc_c', 'LLC taxed as C corp'],
  ['llc_s', 'LLC taxed as S corp'],
  ['llc_p', 'LLC taxed as partnership'],
  ['trust', 'Trust / estate'],
] as const;

// First sign-in for guides and subcontractors: profile, licenses and the W-9.
export default function Onboarding() {
  const { ready, session, profile, isHost, refresh } = useAuth();
  const [p, setP] = useState({ full_name: '', phone: '', bio: '', photo_url: '', emergency_contact: '', guide_license: '', captain_license: '', boat: '' });
  const [existing, setExisting] = useState<TaxForm | null>(null);
  const [w, setW] = useState({ legal_name: '', business_name: '', tax_class: 'individual', address: '', city_state_zip: '', tin_type: 'ssn', tin: '', signature_name: '' });
  const [certify, setCertify] = useState(false);
  const [editW9, setEditW9] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!profile) return;
    setP({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', bio: profile.bio ?? '', photo_url: profile.photo_url ?? '',
      emergency_contact: profile.emergency_contact ?? '', guide_license: profile.guide_license ?? '', captain_license: profile.captain_license ?? '', boat: profile.boat ?? '' });
    setW((x) => ({ ...x, legal_name: x.legal_name || profile.full_name || '' }));
    myTaxForm(profile.id).then(setExisting);
  }, [profile]);

  if (!ready) return <Page><P>Loading…</P></Page>;
  if (!session || !isHost || !profile) return <Page><H1>Team paperwork</H1><P>Sign in with the email the admin added you with.</P><View style={{ maxWidth: 220, marginTop: 12 }}><Button title="Sign in" href="/sign-in?next=/guide/onboarding" /></View></Page>;

  const isSub = profile.worker_type === 'subcontractor';
  const showW9 = isSub && (!existing || editW9);
  const set = (k: keyof typeof p) => (t: string) => setP({ ...p, [k]: t });
  const setT = (k: keyof typeof w) => (t: string) => setW({ ...w, [k]: t });

  async function save() {
    setError(''); setDone('');
    if (!p.full_name.trim() || !p.phone.trim()) return setError('Add your name and mobile number.');
    if (showW9) {
      if (w.tin.replace(/\D/g, '').length !== 9) return setError(`Your ${w.tin_type === 'ssn' ? 'Social Security number' : 'EIN'} should be 9 digits.`);
      if (!certify) return setError('Check the box to certify your W-9.');
    }
    setBusy(true);
    try {
      await saveMyProfile({ ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.trim() || null])), full_name: p.full_name.trim(), onboarded_at: profile!.onboarded_at ?? new Date().toISOString() });
      if (showW9) {
        const last4 = await saveW9(w);
        setW({ ...w, tin: '' });
        setExisting(await myTaxForm(profile!.id));
        setEditW9(false);
        setDone(`Saved. Your W-9 is on file (tax ID ending ${last4}).`);
      } else setDone('Saved.');
      await refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <Page>
      <Seo title="Team paperwork" description="Profile, licenses and W-9." />
      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Eyebrow>{`${profile.team_type ? TEAM_TYPES[profile.team_type] : 'Team'}${profile.worker_type ? ` · ${WORKER_TYPES[profile.worker_type]}` : ''}`}</Eyebrow>
        <H1>Your profile and paperwork</H1>
        <P muted>Only you and the admin can see this page's details. Guests see just your name, photo and bio.</P>

        <H2>About you</H2>
        <Card>
          <Field label="Full name" value={p.full_name} onChangeText={set('full_name')} />
          <Field label="Mobile phone (job alerts come here)" keyboardType="phone-pad" value={p.phone} onChangeText={set('phone')} />
          <Field label="Short bio guests will see" multiline placeholder="Born and raised in Port O'Connor, 15 years guiding the back lakes…" value={p.bio} onChangeText={set('bio')} />
          <Field label="Photo link (optional)" autoCapitalize="none" value={p.photo_url} onChangeText={set('photo_url')} />
          <Field label="Emergency contact (name and phone)" value={p.emergency_contact} onChangeText={set('emergency_contact')} />
        </Card>

        {profile.team_type === 'guide' ? (
          <>
            <H2>Licenses and boat</H2>
            <Card>
              <Field label="Texas fishing guide license number" value={p.guide_license} onChangeText={set('guide_license')} />
              <Field label="USCG captain's license (number and expiration)" value={p.captain_license} onChangeText={set('captain_license')} />
              <Field label="Boat (make, length, registration)" value={p.boat} onChangeText={set('boat')} />
            </Card>
          </>
        ) : null}

        {isSub ? (
          <>
            <H2>W-9 (for your 1099)</H2>
            {existing && !editW9 ? (
              <Card style={{ gap: 4 }}>
                <Text style={{ fontWeight: '700', color: colors.good }}>On file</Text>
                <P>{`${existing.legal_name}${existing.business_name ? ` (${existing.business_name})` : ''} · ${existing.tin_type.toUpperCase()} ending ${existing.tin_last4}`}</P>
                <P muted>{`Signed by ${existing.signature_name} on ${new Date(existing.signed_at).toLocaleDateString()}`}</P>
                <Row><Button small kind="ghost" title="Update my W-9" onPress={() => setEditW9(true)} /></Row>
              </Card>
            ) : (
              <Card>
                <P muted style={{ marginBottom: 10, fontSize: 14 }}>
                  Same information as IRS Form W-9. Your tax ID is encrypted as soon as you save it. The app shows only the last 4 digits, and only the admin can open the full number when it's time to file 1099s.
                </P>
                <Field label="Name (as shown on your tax return)" value={w.legal_name} onChangeText={setT('legal_name')} />
                <Field label="Business name, if different (optional)" value={w.business_name} onChangeText={setT('business_name')} />
                <Text style={lbl}>Federal tax classification</Text>
                <Row gap={8} style={{ marginBottom: 12 }}>
                  {TAX_CLASSES.map(([k, label]) => <Chip key={k} label={label} active={w.tax_class === k} onPress={() => setW({ ...w, tax_class: k })} />)}
                </Row>
                <Field label="Street address" value={w.address} onChangeText={setT('address')} autoComplete="street-address" />
                <Field label="City, state, ZIP" value={w.city_state_zip} onChangeText={setT('city_state_zip')} />
                <Text style={lbl}>Tax ID type</Text>
                <Row gap={8} style={{ marginBottom: 12 }}>
                  <Chip label="Social Security number" active={w.tin_type === 'ssn'} onPress={() => setW({ ...w, tin_type: 'ssn' })} />
                  <Chip label="Employer ID (EIN)" active={w.tin_type === 'ein'} onPress={() => setW({ ...w, tin_type: 'ein' })} />
                </Row>
                <Field label={w.tin_type === 'ssn' ? 'Social Security number' : 'EIN'} keyboardType="number-pad" secureTextEntry autoComplete="off"
                  placeholder={w.tin_type === 'ssn' ? '123-45-6789' : '12-3456789'} value={w.tin} onChangeText={setT('tin')} />
                <Pressable onPress={() => setCertify(!certify)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ width: 22, height: 22, borderRadius: radius, borderWidth: 2, borderColor: colors.navy, backgroundColor: certify ? colors.navy : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    {certify ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                    Under penalties of perjury, I certify that: (1) the number shown is my correct taxpayer identification number; (2) I am not subject to backup withholding, or the IRS has told me I am no longer subject to it; (3) I am a U.S. citizen or other U.S. person; and (4) any FATCA code entered is correct.
                  </Text>
                </Pressable>
                <Field label="Type your full name to sign" value={w.signature_name} onChangeText={setT('signature_name')} />
              </Card>
            )}
          </>
        ) : profile.worker_type === 'employee' ? (
          <Notice>Employees do a W-4 and I-9 with payroll instead of a W-9. The office will send those.</Notice>
        ) : null}

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {done ? <Notice tone="good">{done}</Notice> : null}
        <Row style={{ marginTop: 12 }}>
          <Button title="Save" onPress={save} busy={busy} />
          <Button title="Back to my jobs" kind="ghost" onPress={() => router.replace('/guide')} />
        </Row>
      </View>
    </Page>
  );
}

const lbl = { fontSize: 13, fontWeight: '600' as const, color: colors.muted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
