import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { Container, H2, Page, Seo } from '../components/ui';
import { WhereSearch } from '../components/WhereSearch';
import { webData } from '../lib/web';
import { useAuth } from '../lib/auth';
import { catalog } from '../lib/catalog';
import { colors, PHOTOS, radius } from '../lib/theme';
import type { Category } from '../lib/types';

// The app's start screen: no sales pitch, just "where to", the activities, and "plan a trip for me".
const ACTIVITIES: { label: string; icon: string; href: string; category?: Category }[] = [
  { label: 'Places to stay', icon: 'bed-outline', href: '/search?kind=stay' },
  { label: 'Fishing', icon: 'fish-outline', href: '/search?kind=trip&category=fishing', category: 'fishing' },
  { label: 'Sunset cruise', icon: 'sunny-outline', href: '/search?kind=trip&category=sunset_cruise', category: 'sunset_cruise' },
  { label: 'Beach day', icon: 'umbrella-outline', href: '/search?kind=trip&category=beach_cruise', category: 'beach_cruise' },
  { label: 'Island tour', icon: 'boat-outline', href: '/search?kind=trip&category=island_tour', category: 'island_tour' },
  { label: 'Bird watching', icon: 'binoculars-outline', href: '/search?kind=trip&category=bird_watching', category: 'bird_watching' },
];

export default function Home() {
  const { profile } = useAuth();
  const first = profile?.full_name?.split(' ')[0];
  const offered = ACTIVITIES.filter((a) => !a.category || catalog.listings.some((l) => l.category === a.category));
  return (
    <Page bare>
      <Seo
        title="Premier Booking: houses, fishing guides and bay trips on the Texas coast"
        description="Book a house, a guided fishing trip, a sunset cruise or an island tour in Port O'Connor, Texas. Or let us plan the whole trip for you."
        path="/"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Premier Booking',
          url: process.env.EXPO_PUBLIC_SITE_URL || 'https://premier-booking.netlify.app' }}
      />
      <View {...webData('shore')} style={{ backgroundColor: colors.shallows, zIndex: 2 }}>
        <Container style={{ paddingTop: 22, paddingBottom: 40, maxWidth: 720 }}>
          <Text style={{ fontSize: 15, color: colors.bay, marginBottom: 2, fontWeight: '600' }}>{first ? `Hi ${first}` : 'Welcome to the coast'}</Text>
          <Text role="heading" aria-level={1} style={{ fontSize: 34, color: colors.navy, marginBottom: 14 }}>Where to?</Text>
          <WhereSearch />
        </Container>
      </View>
      <Container style={{ paddingTop: 8, paddingBottom: 28, maxWidth: 720 }}>
        <Link href="/plan" asChild>
          <Pressable accessibilityRole="link" style={{ marginTop: 22, borderRadius: radius + 6, overflow: 'hidden', backgroundColor: colors.navy }}>
            <ImageBackground source={{ uri: PHOTOS.water }} resizeMode="cover" style={{ backgroundColor: colors.navy2 }}>
              <View style={{ backgroundColor: 'rgba(16,34,47,0.72)', padding: 20, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '800', letterSpacing: 1.2, fontSize: 12, textTransform: 'uppercase' }}>Not sure what to do?</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>Plan a trip for me</Text>
                <Text style={{ color: '#d3dde6', fontSize: 16, lineHeight: 22 }}>
                  Answer three quick questions and we'll put together a place to stay and things to do. Change anything you like.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 15 }}>Start planning</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.navy} />
                </View>
              </View>
            </ImageBackground>
          </Pressable>
        </Link>

        <H2>Activities</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {offered.map((a) => (
            <Link key={a.label} href={a.href as never} asChild>
              <Pressable accessibilityRole="link" style={{ flexBasis: '46%', flexGrow: 1, minHeight: 92, backgroundColor: '#fff', borderRadius: radius + 4,
                borderWidth: 1, borderColor: colors.line, padding: 14, justifyContent: 'space-between', gap: 8 }}>
                <Ionicons name={a.icon as never} size={28} color={colors.water} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{a.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <Link href="/account" asChild>
          <Pressable accessibilityRole="link" style={{ ...tile, marginTop: 22 }}>
            <Ionicons name="calendar-outline" size={24} color={colors.water} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.navy }}>My trips and waivers</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </Link>
      </Container>
    </Page>
  );
}

const tile = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12,
  backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.line };
