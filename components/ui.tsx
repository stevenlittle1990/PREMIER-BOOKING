import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, maxWidth, radius } from '../lib/theme';
import { Footer, Header } from './chrome';

export function Page({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Header />
        {bare ? children : <Container style={{ paddingVertical: 24 }}>{children}</Container>}
        <Footer />
      </ScrollView>
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
      <meta name="theme-color" content="#0a1d2e" />
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
export function P({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[s.p, muted && { color: colors.muted }, style]}>{children}</Text>;
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
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: colors.line }]}
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

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'center' }, style]}>{children}</View>;
}

export const s = StyleSheet.create({
  h1: { fontSize: 32, fontWeight: '800', color: colors.navy, marginBottom: 8 },
  h2: { fontSize: 22, fontWeight: '700', color: colors.navy, marginTop: 20, marginBottom: 10 },
  p: { fontSize: 16, lineHeight: 24, color: colors.text },
  btn: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, padding: 16 },
  notice: { backgroundColor: '#fff', borderLeftWidth: 4, padding: 12, borderRadius: 8, marginVertical: 8 },
});
