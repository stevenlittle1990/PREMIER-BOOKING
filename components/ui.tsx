import { webData } from '../lib/web';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, maxWidth, radius } from '../lib/theme';
import { Footer, Header } from './chrome';
import { TabBar } from './TabBar';

// Every screen: header, scrolling content, and the phone tab bar pinned at the bottom.
export function Page({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Header />
        {bare ? children : <Container style={{ paddingVertical: 20 }}>{children}</Container>}
        <Footer />
      </ScrollView>
      <TabBar />
    </View>
  );
}

export function Container({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 16 }, style]}>{children}</View>;
}

// Page title, description and social preview. React 19 lifts these into <head> on the web build.
export function Seo({ title, description, path, jsonLd }: { title: string; description: string; path?: string; jsonLd?: object }) {
  if (Platform.OS !== 'web') return null;
  const full = title.includes('Premier Booking') ? title : `${title} | Premier Booking`;
  const site = process.env.EXPO_PUBLIC_SITE_URL || 'https://premier-booking.netlify.app';
  return (
    <>
      <title>{full}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Premier Booking" />
      <meta name="theme-color" content="#10222f" />
      {path ? <link rel="canonical" href={`${site}${path}`} /> : null}
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
    </>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text role="heading" aria-level={1} style={s.h1}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: object }) {
  return <Text role="heading" aria-level={2} style={[s.h2, style]}>{children}</Text>;
}
export function P({ children, muted, style, selectable }: { children: ReactNode; muted?: boolean; style?: object; selectable?: boolean }) {
  return <Text selectable={selectable} style={[s.p, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', disabled, busy, href, small }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean; busy?: boolean; href?: string; small?: boolean;
}) {
  const bg = kind === 'primary' ? colors.navy : kind === 'danger' ? colors.bad : kind === 'secondary' ? colors.sand : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : colors.navy;
  const body = (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      // Plain style (not a function): Link asChild drops function styles, which hid link buttons' backgrounds.
      style={StyleSheet.flatten([s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: colors.line }])}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
  return href ? <Link href={href as never} asChild>{body}</Link> : body;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12, flexGrow: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#98a3ad" {...props} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'good' | 'bad' }) {
  const c = tone === 'good' ? colors.good : tone === 'bad' ? colors.bad : colors.water;
  return (
    <View style={[s.notice, { borderLeftColor: c }]}>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

// Small uppercase label over a heading, like the website's section labels.
export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: light ? colors.accent : colors.water, marginBottom: 6 }}>{children}</Text>;
}

export function Stat({ value, label, onPress, tone }: { value: string | number; label: string; onPress?: () => void; tone?: 'warn' }) {
  return (
    <Pressable onPress={onPress} style={[s.card, { flexBasis: 150, flexGrow: 1, gap: 2 }]}>
      <Text {...webData('display')} style={{ fontSize: 30, color: tone === 'warn' ? colors.water : colors.navy }}>{String(value)}</Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

// Which dashboard you're looking at. Admins can flip between all three; guides between Guide and Customer.
export function ViewTabs({ current }: { current: 'admin' | 'guide' | 'customer' }) {
  const { isAdmin, isHost, profile } = useAuth();
  const isGuide = isHost && !isAdmin;
  if (!isAdmin && !isGuide) return null;
  const tabs: ['admin' | 'guide' | 'customer', string, string][] = [
    ...(isAdmin ? [['admin', 'Admin', '/host'] as ['admin', string, string]] : profile?.team_type === 'house_owner' ? [['admin', 'My houses', '/host'] as ['admin', string, string]] : []),
    ['guide', 'Guide', '/guide'], ['customer', 'Customer', '/account'],
  ];
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: radius, overflow: 'hidden', marginBottom: 14, backgroundColor: '#fff' }}>
      {tabs.map(([k, label, href]) => (
        <Link key={k} href={href as never} asChild>
          <Pressable style={{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: current === k ? colors.navy : 'transparent' }}>
            <Text style={{ color: current === k ? '#fff' : colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'center' }, style]}>{children}</View>;
}

export const s = StyleSheet.create({
  h1: { fontSize: 34, lineHeight: 42, color: colors.navy, marginBottom: 8 },
  h2: { fontSize: 24, lineHeight: 32, color: colors.navy, marginTop: 22, marginBottom: 10 },
  p: { fontSize: 16, lineHeight: 24, color: colors.text },
  btn: { paddingHorizontal: 20, paddingVertical: 14, minHeight: 48, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 40 },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  chip: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, padding: 16 },
  notice: { backgroundColor: '#fff', borderLeftWidth: 4, padding: 12, borderRadius: radius, marginVertical: 8 },
});
