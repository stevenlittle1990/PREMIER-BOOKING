import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { AuthProvider } from '../lib/auth';
import { colors, fonts, FONT_CSS } from '../lib/theme';

// Site-wide fonts (web). Headings use the serif, everything else the sans, like pocpremierlodge.com.
const GLOBAL_CSS = `
html body [class] { font-family: ${fonts.body}; }
html body [role="heading"][class], html body [data-display][class] { font-family: ${fonts.display}; font-weight: 400; letter-spacing: -0.01em; }
body { background: ${colors.bg}; }
@media (max-width: 760px) { [data-desknav] { display: none !important; } }
@media (min-width: 761px) { [data-tabbar], [data-phonecall] { display: none !important; } }
`;

export default function RootLayout() {
  return (
    <AuthProvider>
      {Platform.OS === 'web' ? (
        <>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={FONT_CSS} precedence="default" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-title" content="Premier Booking" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <style href="premier-global" precedence="default">{GLOBAL_CSS}</style>
        </>
      ) : null}
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
