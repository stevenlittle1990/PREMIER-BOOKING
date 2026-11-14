import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, usePathname } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import { webData } from '../lib/web';

type Tab = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap; match: (p: string) => boolean };

// Tabs switch screens instead of piling new ones on top. Each tap used to push another full page,
// so after a few taps the phone was holding a stack of pages and stopped responding.
export function go(href: string) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href as never);
}

// Thumb-reach navigation for phones (always on in the iPhone/Android app; on the web only on narrow screens).
export function TabBar() {
  const { isHost, isAdmin, profile } = useAuth();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const guideOnly = isHost && !isAdmin && profile?.team_type !== 'house_owner';
  const tabs: Tab[] = [
    { href: '/', label: 'Explore', icon: 'compass-outline', match: (p) => p === '/' || p.startsWith('/stays') || p.startsWith('/trips') || p.startsWith('/areas') || p.startsWith('/search') },
    { href: '/plan', label: 'Plan', icon: 'sparkles-outline', match: (p) => p.startsWith('/plan') },
    ...(isHost ? [guideOnly
      ? { href: '/guide', label: 'My jobs', icon: 'boat-outline', match: (p: string) => p.startsWith('/guide/') || p === '/guide' } as Tab
      : { href: '/host', label: 'Dashboard', icon: 'grid-outline', match: (p: string) => p.startsWith('/host') || p === '/guide' || p.startsWith('/guide/') } as Tab] : []),
    // Signed out, My trips shows Sign in and Create account.
    { href: '/account', label: 'My trips', icon: 'calendar-outline', match: (p) => p.startsWith('/account') || p.startsWith('/waiver') || p.startsWith('/sign-in') },
  ];
  return (
    <View {...webData('tabbar')} style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line,
      paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
      {tabs.map((t) => {
        const on = t.match(path);
        return (
          <Link key={t.href} href={t.href as never} asChild>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={(e) => { e.preventDefault(); go(t.href); }}
              style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 }}>
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
