import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import { webData } from '../lib/web';

type Tab = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap; match: (p: string) => boolean };

// Thumb-reach navigation for phones (always on in the iPhone/Android app; on the web only on narrow screens).
export function TabBar() {
  const { session, isHost, isAdmin, profile } = useAuth();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const guideOnly = isHost && !isAdmin && profile?.team_type !== 'house_owner';
  const tabs: Tab[] = [
    { href: '/', label: 'Explore', icon: 'compass-outline', match: (p) => p === '/' || p.startsWith('/stays') || p.startsWith('/trips') || p.startsWith('/areas') },
    { href: '/search', label: 'Search', icon: 'search-outline', match: (p) => p.startsWith('/search') },
    ...(isHost ? [guideOnly
      ? { href: '/guide', label: 'My jobs', icon: 'boat-outline', match: (p: string) => p.startsWith('/guide/') || p === '/guide' } as Tab
      : { href: '/host', label: 'Dashboard', icon: 'grid-outline', match: (p: string) => p.startsWith('/host') || p === '/guide' || p.startsWith('/guide/') } as Tab] : []),
    session
      ? { href: '/account', label: 'My trips', icon: 'person-circle-outline', match: (p) => p.startsWith('/account') || p.startsWith('/waiver') }
      : { href: '/sign-in', label: 'Sign in', icon: 'log-in-outline', match: (p) => p.startsWith('/sign-in') },
  ];
  return (
    <View {...webData('tabbar')} style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line,
      paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
      {tabs.map((t) => {
        const on = t.match(path);
        return (
          <Link key={t.href} href={t.href as never} asChild>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 }}>
              <Ionicons name={on ? (t.icon.replace('-outline', '') as Tab['icon']) : t.icon} size={24} color={on ? colors.navy : colors.muted} />
              <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? colors.navy : colors.muted }}>{t.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

export const showTabBarOnWeb = Platform.OS === 'web';
