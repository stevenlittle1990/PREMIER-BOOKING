import { Link } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { bayById } from '../lib/catalog';
import { listingPath, priceLabel } from '../lib/format';
import { colors, radius } from '../lib/theme';
import { CATEGORY_LABELS, type Listing } from '../lib/types';

const TINTS: Record<string, string> = {
  house: '#22566b', fishing: '#1b7896', sunset_cruise: '#2b4f7a', beach_cruise: '#3a8f9a',
  island_tour: '#2f6f6a', bird_watching: '#4f6f8f', hunting: '#3d5566', other: '#40576b',
};

export function Photo({ listing, height = 190 }: { listing: Listing; height?: number }) {
  const src = listing.photos[0];
  if (src) return <Image source={{ uri: src }} style={{ width: '100%', height, backgroundColor: colors.busy }} resizeMode="cover" accessibilityLabel={listing.title} />;
  return (
    <View style={{ height, backgroundColor: TINTS[listing.category] ?? colors.navy2, justifyContent: 'flex-end', padding: 14 }}>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
        {CATEGORY_LABELS[listing.category]}
      </Text>
    </View>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const bay = bayById(listing.bay_system_id);
  const facts = listing.kind === 'stay'
    ? `Sleeps ${listing.max_guests}${listing.bedrooms ? ` · ${listing.bedrooms} bedrooms` : ''}`
    : `${listing.duration_hours ? `${listing.duration_hours} hours · ` : ''}Up to ${listing.max_guests} people`;
  return (
    <Link href={listingPath(listing) as never} asChild>
      <Pressable style={({ pressed }) => ({ flexBasis: 320, flexGrow: 1, maxWidth: 520, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ backgroundColor: '#fff', borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <Photo listing={listing} />
          <View style={{ padding: 14, gap: 4 }}>
            <Text style={{ fontSize: 13, color: colors.water, fontWeight: '700' }}>
              {CATEGORY_LABELS[listing.category]}{bay ? ` · ${bay.name}` : ''}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{listing.title}</Text>
            <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={2}>{listing.summary}</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>{facts}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy, marginTop: 4 }}>{priceLabel(listing)}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</View>;
}
