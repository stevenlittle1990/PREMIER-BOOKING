import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { busyDays, listingBySlugLive, requestBooking } from '../lib/api';
import { useAuth } from '../lib/auth';
import { areaById, bayById, catalog } from '../lib/catalog';
import { iso, listingPath, money, niceDate, nightsBetween, priceLabel } from '../lib/format';
import { hasDatabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { CATEGORY_LABELS, type Listing } from '../lib/types';
import { Calendar, type DayMark } from './Calendar';
import { Photo } from './ListingCard';
import { Button, Card, Chip, Field, H1, H2, Notice, P, Page, Row, Seo } from './ui';

export function ListingDetail({ slug }: { slug: string }) {
  const [listing, setListing] = useState<Listing | null | undefined>(catalog.listings.find((l) => l.slug === slug));
  useEffect(() => { listingBySlugLive(slug).then((l) => setListing(l)); }, [slug]);

  if (listing === undefined) return <Page><P>Loading…</P></Page>;
  if (!listing) return <Page><H1>Not found</H1><P>This listing may have been taken down.</P></Page>;

  const area = areaById(listing.area_id);
  const bay = bayById(listing.bay_system_id);
  const where = [bay?.name, area?.name].filter(Boolean).join(', ');
  const description = `${listing.summary} ${CATEGORY_LABELS[listing.category]} in ${where}.`.trim();
  const isStay = listing.kind === 'stay';

  return (
    <Page>
      <Seo title={`${listing.title}${area ? ` in ${area.name}` : ''}`} description={description} path={listingPath(listing)}
        jsonLd={isStay
          ? { '@context': 'https://schema.org', '@type': 'VacationRental', name: listing.title, description: listing.summary,
              address: listing.address ?? undefined, containsPlace: { '@type': 'Accommodation', occupancy: { '@type': 'QuantitativeValue', maxValue: listing.max_guests } } }
          : { '@context': 'https://schema.org', '@type': 'TouristTrip', name: listing.title, description: listing.summary,
              offers: listing.price_cents > 0 ? { '@type': 'Offer', price: listing.price_cents / 100, priceCurrency: 'USD' } : undefined }} />

      <Text style={{ color: colors.water, fontWeight: '700' }}>{CATEGORY_LABELS[listing.category]}{where ? ` · ${where}` : ''}</Text>
      <H1>{listing.title}</H1>

      {listing.photos.length > 1 ? (
        <ScrollView horizontal style={{ borderRadius: 12 }} contentContainerStyle={{ gap: 8 }}>
          {listing.photos.map((p) => <Image key={p} source={{ uri: p }} style={{ width: 420, height: 280, borderRadius: 12 }} accessibilityLabel={listing.title} />)}
        </ScrollView>
      ) : (
        <View style={{ borderRadius: 12, overflow: 'hidden' }}><Photo listing={listing} height={300} /></View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginTop: 20, alignItems: 'flex-start' }}>
        <View style={{ flexBasis: 420, flexGrow: 2, flexShrink: 1 }}>
          <Row gap={8}>
            {isStay ? (
              <>
                <Fact text={`Sleeps ${listing.max_guests}`} />
                {listing.bedrooms ? <Fact text={`${listing.bedrooms} bedrooms`} /> : null}
                {listing.beds ? <Fact text={`${listing.beds} beds`} /> : null}
                {listing.bathrooms ? <Fact text={`${listing.bathrooms} baths`} /> : null}
                {listing.min_nights > 1 ? <Fact text={`${listing.min_nights} night minimum`} /> : null}
              </>
            ) : (
              <>
                {listing.duration_hours ? <Fact text={`${listing.duration_hours} hours`} /> : null}
                <Fact text={`Up to ${listing.max_guests} people`} />
                {listing.start_times.length ? <Fact text={`Starts ${listing.start_times.join(' or ')}`} /> : null}
              </>
            )}
          </Row>
          <P style={{ marginTop: 16 }}>{listing.description || listing.summary}</P>
          {listing.species.length ? <><H2>What you can catch</H2><P>{listing.species.join(' · ')}</P></> : null}
          {listing.amenities.length ? (
            <>
              <H2>{isStay ? 'What this place has' : "What's included"}</H2>
              <View style={{ gap: 6 }}>{listing.amenities.map((a) => <P key={a}>• {a}</P>)}</View>
            </>
          ) : null}
          {listing.address || listing.meeting_point ? (
            <><H2>Where</H2><P>{listing.address || listing.meeting_point}</P></>
          ) : null}
        </View>
        <View style={{ flexBasis: 340, flexGrow: 1 }}>
          <BookingBox listing={listing} />
        </View>
      </View>
    </Page>
  );
}

function Fact({ text }: { text: string }) {
  return <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
    <Text style={{ color: colors.text }}>{text}</Text>
  </View>;
}

function BookingBox({ listing }: { listing: Listing }) {
  const { session, profile } = useAuth();
  const isStay = listing.kind === 'stay';
  const today = iso(new Date());
  const [busy, setBusy] = useState<Record<string, DayMark>>({});
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [time, setTime] = useState(listing.start_times[0] ?? '');
  const [guests, setGuests] = useState('2');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => { busyDays(listing.id, today).then(setBusy); }, [listing.id, today]);
  useEffect(() => { if (profile) { setName((n) => n || profile.full_name); setPhone((p) => p || profile.phone || ''); } }, [profile]);

  const nights = isStay && start && end ? nightsBetween(start, end) : 0;
  const total = useMemo(() => {
    if (listing.price_cents <= 0) return 0;
    if (isStay) return nights * listing.price_cents;
    return listing.price_unit === 'person' ? listing.price_cents * (Number(guests) || 1) : listing.price_cents;
  }, [listing, isStay, nights, guests]);

  const ready = isStay ? Boolean(start && end && nights >= listing.min_nights) : Boolean(start);
  const tooMany = Number(guests) > listing.max_guests;

  async function submit() {
    setError('');
    if (!name.trim() || !phone.trim()) return setError('Add your name and a phone number so the host can reach you.');
    setSending(true);
    try {
      await requestBooking({
        listing_id: listing.id, guest_name: name.trim(), guest_email: session?.user.email ?? '', guest_phone: phone.trim(),
        start_date: start!, end_date: isStay ? end! : start!, start_time: isStay ? null : time || null,
        guests: Number(guests) || 1, total_cents: total, notes: notes.trim() || null,
      });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <H2 style={{ marginTop: 0 }}>Request sent</H2>
        <P>The host will look at your dates and confirm. You'll see the answer under My trips.</P>
        <View style={{ marginTop: 12 }}><Button title="Go to My trips" href="/account" /></View>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.navy }}>{priceLabel(listing)}</Text>
      <Text style={{ fontWeight: '700', color: colors.text }}>
        {isStay ? (start && !end ? 'Now pick your check-out day' : 'Pick check-in and check-out') : 'Pick a day'}
      </Text>
      <Calendar busy={busy} start={start} end={end} range={isStay} months={1}
        onChange={(a, b) => { setStart(a); setEnd(isStay ? b : a); }} />
      {start ? (
        <P>{isStay ? `${niceDate(start)} → ${end ? niceDate(end) : '…'}${nights ? ` · ${nights} nights` : ''}` : niceDate(start)}</P>
      ) : null}
      {isStay && nights > 0 && nights < listing.min_nights ? <Notice tone="bad">{`This place has a ${listing.min_nights} night minimum.`}</Notice> : null}
      {!isStay && listing.start_times.length > 1 ? (
        <Row gap={8}>{listing.start_times.map((t) => <Chip key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}</Row>
      ) : null}
      <Field label={`Guests (max ${listing.max_guests})`} keyboardType="number-pad" value={guests} onChangeText={setGuests} />
      {tooMany ? <Notice tone="bad">{`This one takes up to ${listing.max_guests}.`}</Notice> : null}

      {!hasDatabase ? (
        <Notice>Online booking opens soon. Call 361-210-8494 to book these dates.</Notice>
      ) : !session ? (
        <Button title="Sign in to request" href={`/sign-in?next=${encodeURIComponent(listingPath(listing))}`} disabled={!ready} />
      ) : (
        <>
          <Field label="Your name" value={name} onChangeText={setName} />
          <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field label="Anything the host should know" multiline value={notes} onChangeText={setNotes} />
          {total > 0 ? <P>{`Estimated total: ${money(total)}`}</P> : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Button title="Request to book" onPress={submit} busy={sending} disabled={!ready || tooMany} />
          <P muted style={{ fontSize: 13 }}>You won't be charged yet. The host confirms first.</P>
        </>
      )}
      <Link href="/search"><Text style={{ color: colors.water }}>Keep looking</Text></Link>
    </Card>
  );
}
