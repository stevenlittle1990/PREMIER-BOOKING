import { useLocalSearchParams } from 'expo-router';
import { ListingDetail } from '../../components/ListingDetail';
import { catalog } from '../../lib/catalog';

export async function generateStaticParams() {
  return catalog.listings.filter((l) => l.kind === 'trip').map((l) => ({ slug: l.slug }));
}

export default function TripPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ListingDetail slug={slug} />;
}
