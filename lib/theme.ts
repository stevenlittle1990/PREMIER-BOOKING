// Brand colors and fonts live here only. Beach look (trial, 2026-11-14): deep water, sea glass and dry sand,
// wordmark styled after the POC Premier Lodge logo. Swap this file when the brand package is final.
export const colors = {
  navy: '#0c3a52', // deep water: header, buttons, headings
  navy2: '#12506b',
  water: '#1880a0',
  bay: '#3b6f78',
  accent: '#6fd6d6', // shallows aqua, for use on dark water
  sand: '#f1e5cf',
  bg: '#f7f0e3', // dry sand
  card: '#ffffff',
  text: '#173141',
  muted: '#7a7365',
  line: '#e3d6bd',
  good: '#2e8455',
  bad: '#ac4431',
  busy: '#ece2cf',
  pending: '#d5ebf0',
  blocked: '#f0d9d4',
  shallows: '#d9f1ef', // light sea glass, top of the beach gradient
};
export const fonts = {
  display: '"DM Serif Display", Georgia, "Times New Roman", serif',
  body: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  logo: '"Oswald", "Arial Narrow", "Helvetica Neue", sans-serif', // tall bold caps, like the POC Premier Lodge logo
};
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Oswald:wght@500;700&display=swap';
export const radius = 10;
export const maxWidth = 1120;

// Photos from pocpremierlodge.com used as backgrounds.
export const PHOTOS = {
  // Whole redfish and the angler's face, landscape 1600x1066: shown uncropped on the home page.
  hero: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/holding-fish-redfish.jpg',
  heroRatio: 1600 / 1066,
  // Wide scenic shot (no people to crop) for banners.
  boats: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/charter-boats-shallow-water.jpg',
  trout: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/woman-holding-trout.jpg',
  redfish: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/holding-fish-redfish.jpg',
  water: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/boat-in-clear-water-wide.jpg',
  sunrise: 'https://www.pocpremierlodge.com/Images/Optimized/Real%20Photos/sunrise-fishing-rods.jpg',
};
