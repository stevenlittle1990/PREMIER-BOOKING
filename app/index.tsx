import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ListingGrid } from '../components/ListingCard';
import { SearchBox } from '../components/SearchBox';
import { Container, H2, P, Page, Row, Seo } from '../components/ui';
import { catalog } from '../lib/catalog';
import { colors } from '../lib/theme';
import { CATEGORY_LABELS, TRIP_CATEGORIES } from '../lib/types';

export default function Home() {
  const stays = catalog.listings.filter((l) => l.kind === 'stay');
  const trips = catalog.listings.filter((l) => l.kind === 'trip');
  const categories = TRIP_CATEGORIES.filter((c) => trips.some((t) => t.category === c));
  return (
    <Page bare>
      <Seo
        title="Premier Booking: houses, fishing guides and bay trips on the Texas coast"
        description="Book a house, a guided fishing trip, a sunset cruise or an island tour in Port O'Connor, Texas. See open dates and request your booking in one place."
        path="/"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Premier Booking',
          url: process.env.EXPO_PUBLIC_SITE_URL || 'https://premier-booking.netlify.app' }}
      />
      <View style={{ backgroundColor: colors.navy2, paddingVertical: 48 }}>
        <Container style={{ gap: 14 }}>
          <Text role="heading" aria-level={1} style={{ color: '#fff', fontSize: 40, fontWeight: '800', maxWidth: 720 }}>
            Your whole coast trip, <Text style={{ color: colors.sun, fontStyle: 'italic' }}>one booking</Text>.
          </Text>
          <Text style={{ color: '#d3dde6', fontSize: 18, maxWidth: 640, lineHeight: 26 }}>
            Houses for the crew, guides who know the bay, and cruises for everyone else. Pick your area, check the calendar and send your request.
          </Text>
          <SearchBox />
        </Container>
      </View>

      <Container style={{ paddingVertical: 12 }}>
        <H2>Things to do</H2>
        <Row gap={10}>
          {categories.map((c) => (
            <Link key={c} href={`/search?kind=trip&category=${c}` as never} asChild>
              <Pressable style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: colors.navy, fontWeight: '600' }}>{CATEGORY_LABELS[c]}</Text>
              </Pressable>
            </Link>
          ))}
        </Row>

        <H2>Places to stay</H2>
        <ListingGrid listings={stays} />

        <H2>Guided trips</H2>
        <ListingGrid listings={trips.slice(0, 6)} />
        <View style={{ marginTop: 12 }}>
          <Link href="/search?kind=trip"><Text style={{ color: colors.water, fontWeight: '700', fontSize: 16 }}>See all trips ›</Text></Link>
        </View>

        <H2>Areas</H2>
        <Row gap={16}>
          {catalog.areas.map((a) => (
            <Link key={a.id} href={`/areas/${a.slug}` as never} asChild>
              <Pressable style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16, flexBasis: 320, flexGrow: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.navy }}>{a.name}</Text>
                <Text style={{ color: colors.muted, marginBottom: 6 }}>{a.region}</Text>
                <P>{a.description}</P>
              </Pressable>
            </Link>
          ))}
        </Row>

        <View style={{ backgroundColor: colors.sand, borderRadius: 12, padding: 20, marginTop: 28 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.navy }}>Guide or own a house on the coast?</Text>
          <P style={{ marginTop: 6 }}>We work with local guides and owners by invitation. Call 361-210-8494 to list with us.</P>
        </View>
      </Container>
    </Page>
  );
}
