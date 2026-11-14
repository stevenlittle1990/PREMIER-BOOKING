import { webData } from '../lib/web';
import { Link } from 'expo-router';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { colors, maxWidth } from '../lib/theme';
import { Logo } from './Logo';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{label}</Text></Pressable>
    </Link>
  );
}

export function Header() {
  const { session, isHost, isAdmin, profile } = useAuth();
  const guideOnly = isHost && !isAdmin && profile?.team_type !== 'house_owner';
  const insets = useSafeAreaInsets();
  const native = Platform.OS !== 'web';
  return (
    <View {...webData('oceanbar')} style={{ backgroundColor: colors.navy, paddingTop: native ? insets.top : 0 }}>
      <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link href="/" asChild>
          <Pressable>
            <View><Logo /></View>
          </Pressable>
        </Link>
        {native ? null : <View {...webData('desknav')} style={{ flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink href="/search?kind=stay" label="Stays" />
          <NavLink href="/search?kind=trip" label="Trips" />
          <NavLink href="/plan" label="Plan a trip" />
          <NavLink href="/guides" label="Guides" />
          {isHost && !guideOnly ? <NavLink href="/host" label="Dashboard" /> : null}
          {guideOnly ? <NavLink href="/guide" label="My jobs" /> : null}
          {session ? <NavLink href="/account" label="My trips" /> : <NavLink href="/sign-in" label="Sign in" />}
        </View>}
        {native ? null : <View {...webData('phonecall')}><Text style={{ color: '#fff', fontWeight: '700' }} onPress={() => Linking.openURL('tel:3612108494')}>Call</Text></View>}
      </View>
    </View>
  );
}

export function Footer() {
  return (
    <View {...webData('oceanfoot')} style={{ backgroundColor: colors.navy, marginTop: 'auto' }}>
      <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 28, gap: 6 }}>
        <View style={{ marginBottom: 6 }}><Logo size={0.9} /></View>
        <Text style={{ color: '#b8c7d4' }}>Houses, fishing guides and trips on the Texas coast.</Text>
        <Text style={{ color: '#b8c7d4' }}>Home of POC Premier Lodge · 110 East Monroe Ave., Port O'Connor, TX · 361-210-8494</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          <Link href="/areas/port-oconnor"><Text style={{ color: '#fff' }}>Port O'Connor</Text></Link>
          <Link href="/guides"><Text style={{ color: '#fff' }}>Our guides</Text></Link>
          <Link href="/guide"><Text style={{ color: '#fff' }}>Guide and crew login</Text></Link>
          <Text style={{ color: '#fff' }} onPress={() => Linking.openURL('https://www.pocpremierlodge.com')}>pocpremierlodge.com</Text>
        </View>
      </View>
    </View>
  );
}
