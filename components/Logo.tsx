import { Image, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { webData } from '../lib/web';

// The POC Premier Lodge emblem (from the lodge's own logo) with the app name beside it.
const EMBLEM = require('../public/brand/poc-emblem.png');

export function Logo({ size = 1 }: { size?: number }) {
  const s = 44 * size;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * size }} accessibilityRole="image" accessibilityLabel="Premier Booking">
      <Image source={EMBLEM} style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }} />
      <Text {...webData('logo')} style={{ fontFamily: fonts.logo, color: '#fff', fontSize: 23 * size, fontWeight: '700', letterSpacing: 1.2 * size, textTransform: 'uppercase' }}>
        Premier <Text style={{ color: colors.accent }}>Booking</Text>
      </Text>
    </View>
  );
}
