import { useLocalSearchParams } from 'expo-router';
import { ListingDetail } from '../../components/ListingDetail';
import { catalog } from '../../lib/catalog';

export async function generateStaticParams() {
  return catalog.listings.filter((l) => l.kind === 'stay').map((l) => ({ slug: l.slug }));
}

export default function StayPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ListingDetail slug={slug} />;
}
