import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ListingGrid } from '../../components/ListingCard';
import { Card, H1, H2, P, Page, Row, Seo } from '../../components/ui';
import { areaBySlug, baysForArea, catalog } from '../../lib/catalog';
import { colors } from '../../lib/theme';

export async function generateStaticParams() {
  return catalog.areas.map((a) => ({ area: a.slug }));
}

export default function AreaPage() {
  const { area: slug } = useLocalSearchParams<{ area: string }>();
  const area = areaBySlug(slug);
  if (!area) return <Page><H1>Area not found</H1></Page>;
  const bays = baysForArea(area.id);
  const listings = catalog.listings.filter((l) => l.area_id === area.id);
  const stays = listings.filter((l) => l.kind === 'stay');
  const trips = listings.filter((l) => l.kind === 'trip');
  return (
    <Page>
      <Seo title={`${area.name} houses, fishing guides and boat trips`}
        description={`Book places to stay, guided fishing and bay trips in ${area.name}, ${area.region}. ${area.description}`}
        path={`/areas/${area.slug}`}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'TouristDestination', name: area.name, description: area.description }} />
      <H1>{area.name}</H1>
      <P muted>{area.region}</P>
      <P style={{ marginTop: 8, maxWidth: 760 }}>{area.description}</P>

      <H2>Bay systems</H2>
      <Row gap={12} style={{ alignItems: 'stretch' }}>
        {bays.map((b) => (
          <Card key={b.id} style={{ flexBasis: 240, flexGrow: 1 }}>
            <Link href={`/search?area=${area.slug}&bay=${b.slug}` as never}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.navy }}>{b.name} ›</Text>
            </Link>
            <P muted style={{ marginTop: 4 }}>{b.description}</P>
          </Card>
        ))}
      </Row>

      {stays.length ? <><H2>Places to stay in {area.name}</H2><ListingGrid listings={stays} /></> : null}
      {trips.length ? <><H2>Trips and guides in {area.name}</H2><ListingGrid listings={trips} /></> : null}
      <View style={{ height: 12 }} />
    </Page>
  );
}
