# Premier Booking

Book houses, fishing guides and bay trips in one place. Same setup as MHU Fleet: Expo (React Native, built for web), Supabase, Netlify.

- **Guests** search by area and bay system, open a listing, pick dates on the calendar and request to book.
- **Admin** (Jason) gets every request in the Host dashboard, accepts or declines, blocks days, edits listings, adds areas and bays, and invites guides and house owners.
- **Partners** (invited guides and owners) manage their own listings, calendar and bookings.

## Setup

1. Supabase: run `supabase/migrations/*.sql` in order.
2. Netlify environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and later `EXPO_PUBLIC_SITE_URL` (the real domain).
3. Make the first admin: after Jason signs in once, run `update profiles set role = 'admin' where email = '...';`

## Google

The build (`netlify.toml`) pulls published listings from Supabase, pre-renders a page for every area and listing with its own title, description and schema.org data, and writes `sitemap.xml` and `robots.txt`. Re-deploy after adding listings so they get their own page (they still open before that).

## Local

```
npm install
npm run web
```
