import { Slot, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { AuthProvider, PasswordGate } from '../lib/auth';
import { colors, fonts, FONT_CSS } from '../lib/theme';

// Site-wide fonts (web). Headings use the serif, everything else the sans, like pocpremierlodge.com.
const GLOBAL_CSS = `
html body [class] { font-family: ${fonts.body}; }
html body [role="heading"][class], html body [data-display][class] { font-family: ${fonts.display}; font-weight: 400; letter-spacing: -0.01em; }
body { background: ${colors.bg}; }
[data-logo][class] { font-family: ${fonts.logo} !important; font-weight: 700 !important; }
[data-oceanbar][class] { background: linear-gradient(115deg, #0a3149 0%, #0c4560 55%, #11697f 100%) !important; }
[data-oceanfoot][class] { background: linear-gradient(180deg, #0c4560 0%, #0a3149 100%) !important; }
[data-badge][class] { background: radial-gradient(circle at 50% 30%, #bff0ec 0%, #5fc9cf 32%, #1f8fb0 62%, #0c4a68 100%) !important; }
[data-beach][class] { background: linear-gradient(180deg, ${colors.shallows} 0px, #eaf5ef 220px, ${colors.bg} 520px) !important; }
[data-shore][class] { position: relative; background: linear-gradient(180deg, #a9e2e3 0%, #cdeeec 55%, #e7f4ee 100%) !important; }
[data-shore][class]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 26px; pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 26' preserveAspectRatio='none'%3E%3Cpath d='M0 14 C 40 2 80 2 120 14 S 200 26 240 14 V26 H0Z' fill='%23f7f0e3'/%3E%3Cpath d='M0 14 C 40 2 80 2 120 14 S 200 26 240 14' fill='none' stroke='%23ffffff' stroke-width='2' opacity='.8'/%3E%3C/svg%3E") repeat-x;
  background-size: 240px 26px; }
/* Start screen: the lodge's own photos, slowly crossfading and drifting like a film opening. */
[data-hero][class] { position: relative; overflow: hidden; background: #0c3a52 url(/brand/hero-boat.jpg) 40% 60% / cover no-repeat !important; }
[data-slide][class] { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-size: cover; background-repeat: no-repeat;
  opacity: 0; transform-origin: 60% 55%; animation: heroSlide 32s ease-in-out infinite; will-change: opacity, transform; }
[data-slide1][class] { background-image: url(/brand/hero-boat.jpg); background-position: 40% 60%; animation-delay: -1s; }
[data-slide2][class] { background-image: url(https://www.pocpremierlodge.com/Images/Optimized/Lodge%20Exteriors/balcony-bay-view.jpg); background-position: center; animation-delay: 7s; }
[data-slide3][class] { background-image: url(/brand/hero-redfish.jpg); background-position: 0% 50%; animation-delay: 15s; }
[data-slide4][class] { background-image: url(https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/hero-sunset-fishing-rods.jpg); background-position: center; animation-delay: 23s; }
@keyframes heroSlide {
  0% { opacity: 0; transform: scale(1.02) translate3d(0, 0, 0); }
  5% { opacity: 1; }
  25% { opacity: 1; }
  31% { opacity: 0; transform: scale(1.14) translate3d(-2%, -1%, 0); }
  100% { opacity: 0; transform: scale(1.14) translate3d(-2%, -1%, 0); }
}
[data-heroshade][class] { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(180deg, rgba(6, 26, 40, 0.62) 0%, rgba(6, 26, 40, 0.22) 45%, rgba(6, 26, 40, 0) 70%, rgba(6, 26, 40, 0.18) 100%) !important; }
[data-herotext][class] { text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35); }
@media (prefers-reduced-motion: reduce) { [data-slide][class] { animation: none; } [data-slide1][class] { opacity: 1; } }
[data-searchpill][class] { box-shadow: 0 6px 22px rgba(12, 58, 82, 0.14); }
[data-tabbar][class] { padding-bottom: max(6px, env(safe-area-inset-bottom)) !important; }
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
      {/* Web shows one screen at a time (no stacked cards): stacked pages are what froze and blacked out the phone app. */}
      {Platform.OS === 'web' ? <Slot /> : <Stack screenOptions={{ headerShown: false, animation: 'none' }} />}
      <PasswordGate />
    </AuthProvider>
  );
}
