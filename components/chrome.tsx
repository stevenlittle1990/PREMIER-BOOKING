import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, maxWidth } from '../lib/theme';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{label}</Text></Pressable>
    </Link>
  );
}

export function Header() {
  const { session, isHost } = useAuth();
  return (
    <View style={{ backgroundColor: colors.navy }}>
      <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link href="/" asChild>
          <Pressable>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>
              Premier<Text style={{ color: colors.sun }}> Booking</Text>
            </Text>
          </Pressable>
        </Link>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink href="/search?kind=stay" label="Stays" />
          <NavLink href="/search?kind=trip" label="Trips" />
          {isHost ? <NavLink href="/host" label="Host dashboard" /> : null}
          {session ? <NavLink href="/account" label="My trips" /> : <NavLink href="/sign-in" label="Sign in" />}
        </View>
      </View>
    </View>
  );
}

export function Footer() {
  return (
    <View style={{ backgroundColor: colors.navy, marginTop: 'auto' }}>
      <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 28, gap: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Premier Booking</Text>
        <Text style={{ color: '#b8c7d4' }}>Houses, fishing guides and trips on the Texas coast.</Text>
        <Text style={{ color: '#b8c7d4' }}>Home of POC Premier Lodge · 110 East Monroe Ave., Port O'Connor, TX · 361-210-8494</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          <Link href="/areas/port-oconnor"><Text style={{ color: '#fff' }}>Port O'Connor</Text></Link>
          <Link href="/host"><Text style={{ color: '#fff' }}>Hosts and guides</Text></Link>
        </View>
      </View>
    </View>
  );
}
