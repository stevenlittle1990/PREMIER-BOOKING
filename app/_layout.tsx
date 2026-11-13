import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { AuthProvider } from '../lib/auth';
import { colors, fonts, FONT_CSS } from '../lib/theme';

// Site-wide fonts (web). Headings use the serif, everything else the sans, like pocpremierlodge.com.
const GLOBAL_CSS = `
html body [class] { font-family: ${fonts.body}; }
html body [role="heading"][class], html body [data-display][class] { font-family: ${fonts.display}; font-weight: 400; letter-spacing: -0.01em; }
body { background: ${colors.bg}; }
`;

export default function RootLayout() {
  return (
    <AuthProvider>
      {Platform.OS === 'web' ? (
        <>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={FONT_CSS} precedence="default" />
          <style href="premier-global" precedence="default">{GLOBAL_CSS}</style>
        </>
      ) : null}
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
