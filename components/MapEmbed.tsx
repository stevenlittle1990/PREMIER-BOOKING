import { createElement } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';

// A Google map for one address (no API key needed). On the phone app it opens Maps instead.
export function MapEmbed({ address, height = 240 }: { address: string; height?: number }) {
  const q = encodeURIComponent(address);
  return (
    <View style={{ gap: 6 }}>
      {Platform.OS === 'web' ? (
        <View style={{ height, borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sand }}>
          {createElement('iframe', {
            title: `Map of ${address}`, src: `https://maps.google.com/maps?q=${q}&z=15&output=embed`, loading: 'lazy',
            style: { border: 0, width: '100%', height: '100%' }, referrerPolicy: 'no-referrer-when-downgrade',
          })}
        </View>
      ) : null}
      <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`)}>
        Open in Google Maps
      </Text>
    </View>
  );
}
