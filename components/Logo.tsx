import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { webData } from '../lib/web';

// Wordmark in the spirit of the POC Premier Lodge logo: a round badge, a tall bold name,
// and a small spaced line between rules underneath. Blues instead of the old orange sunset.
export function Logo({ size = 1, light = true }: { size?: number; light?: boolean }) {
  const ink = light ? '#fff' : colors.navy;
  const badge = 38 * size;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * size }} accessibilityRole="image" accessibilityLabel="Premier Booking, Port O'Connor, Texas">
      <View {...webData('badge')} style={{ width: badge, height: badge, borderRadius: badge / 2, backgroundColor: colors.water,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: light ? 'rgba(255,255,255,0.85)' : colors.navy, overflow: 'hidden' }}>
        <Ionicons name="fish" size={20 * size} color="#fff" style={{ transform: [{ rotate: '-25deg' }] }} />
      </View>
      <View>
        <Text {...webData('logo')} style={{ fontFamily: fonts.logo, color: light ? colors.accent : colors.water, fontSize: 25 * size, lineHeight: 27 * size, fontWeight: '700', letterSpacing: 1.6 * size, textTransform: 'uppercase' }}>
          Premier
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * size }}>
          <View style={{ width: 10 * size, height: 1.5, backgroundColor: ink }} />
          <Text style={{ color: ink, fontSize: 9.5 * size, fontWeight: '700', letterSpacing: 2.6 * size, textTransform: 'uppercase' }}>Booking · TX</Text>
          <View style={{ width: 10 * size, height: 1.5, backgroundColor: ink }} />
        </View>
      </View>
    </View>
  );
}
