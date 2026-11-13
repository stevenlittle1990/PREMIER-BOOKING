import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { busyDays, liveCatalog, listingBySlugLive, type InquiryItem } from '../lib/api';
import { areaById, bayById, catalog } from '../lib/catalog';
import { addDays, iso, listingPath, niceDate, nightsBetween } from '../lib/format';
import { colors } from '../lib/theme';
import { CATEGORY_LABELS, type Listing } from '../lib/types';
import { Calendar, type DayMark } from './Calendar';
import { InquiryForm } from './InquiryForm';
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
              image: listing.photos.slice(0, 5), address: listing.address ?? undefined,
              containsPlace: { '@type': 'Accommodation', numberOfBedrooms: listing.bedrooms ?? undefined,
                occupancy: { '@type': 'QuantitativeValue', maxValue: listing.max_guests } } }
          : { '@context': 'https://schema.org', '@type': 'TouristTrip', name: listing.title, description: listing.summary,
              image: listing.photos.slice(0, 5)}} />

      <Text style={{ color: colors.water, fontWeight: '700' }}>{CATEGORY_LABELS[listing.category]}{where ? ` · ${where}` : ''}</Text>
      <H1>{listing.title}</H1>
      <Gallery listing={listing} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginTop: 20, alignItems: 'flex-start' }}>
        <View style={{ flexBasis: 420, flexGrow: 2, flexShrink: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
            {isStay
              ? [`${listing.max_guests} guests`, listing.bedrooms && `${listing.bedrooms} bedrooms`, listing.beds && `${listing.beds} beds`, listing.bathrooms && `${listing.bathrooms} baths`].filter(Boolean).join(' · ')
              : [listing.duration_hours && `${listing.duration_hours} hours`, `up to ${listing.max_guests} people`, listing.start_times.length && `starts ${listing.start_times.join(' or ')}`].filter(Boolean).join(' · ')}
          </Text>

          {listing.highlights.length ? (
            <View style={{ gap: 8, marginTop: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
              {listing.highlights.map((h) => <P key={h}>✓  {h}</P>)}
            </View>
          ) : null}

          <P style={{ marginTop: 16 }}>{listing.description || listing.summary}</P>

          {listing.rooms.length ? (
            <>
              <H2>Where you'll sleep</H2>
              <Row gap={12}>
                {listing.rooms.map((r) => (
                  <Card key={r.name} style={{ flexBasis: 150, flexGrow: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{r.name}</Text>
                    <P muted>{r.beds}</P>
                  </Card>
                ))}
              </Row>
            </>
          ) : null}

          {listing.species.length ? <><H2>What you can catch</H2><P>{listing.species.join(' · ')}</P></> : null}
          {listing.amenities.length ? (
            <>
              <H2>{isStay ? 'What this place has' : "What's included"}</H2>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                {listing.amenities.map((a) => <View key={a} style={{ flexBasis: 260, flexGrow: 1 }}><P>• {a}</P></View>)}
              </View>
            </>
          ) : null}

          {isStay || listing.house_rules.length || listing.cancellation_policy ? (
            <>
              <H2>Things to know</H2>
              <View style={{ gap: 6 }}>
                {listing.check_in_time ? <P>{`Check-in after ${listing.check_in_time}`}</P> : null}
                {listing.check_out_time ? <P>{`Checkout before ${listing.check_out_time}`}</P> : null}
                {isStay && listing.min_nights > 1 ? <P>{`${listing.min_nights} night minimum`}</P> : null}
                {listing.security_deposit_cents ? <P>Refundable security deposit, returned within 7 days after checkout</P> : null}
                {isStay ? <P>{listing.pets_allowed ? `Pets welcome${listing.pet_fee_cents ? ' (refundable pet deposit)' : ''}` : 'No pets'}</P> : null}
                {listing.house_rules.map((r) => <P key={r}>• {r}</P>)}
                {listing.cancellation_policy ? <P>{`Cancellation: ${listing.cancellation_policy}`}</P> : null}
              </View>
            </>
          ) : null}

          {listing.address || listing.meeting_point ? <><H2>Where</H2><P>{listing.address || listing.meeting_point}</P></> : null}
        </View>
        <View style={{ flexBasis: 340, flexGrow: 1 }}>
          <BookingBox listing={listing} />
        </View>
      </View>
    </Page>
  );
}

// One big photo and four small ones on wide screens; a swipe row on phones.
function Gallery({ listing }: { listing: Listing }) {
  const real = useWindowDimensions().width;
  // Pages are pre-built at desktop width; switch to the phone layout after the page loads.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const width = mounted ? real : 1280;
  const [open, setOpen] = useState<number | null>(null);
  const photos = listing.photos;
  if (!photos.length) return <View style={{ borderRadius: 12, overflow: 'hidden' }}><Photo listing={listing} height={300} /></View>;
  if (open !== null) {
    return (
      <View style={{ gap: 8 }}>
        <Image source={{ uri: photos[open] }} style={{ width: '100%', height: Math.min(620, width * 0.62), borderRadius: 12, backgroundColor: '#000' }} resizeMode="contain" accessibilityLabel={listing.title} />
        <Row gap={8}>
          <Button small kind="ghost" title="‹ Back" onPress={() => setOpen((open + photos.length - 1) % photos.length)} />
          <Text style={{ color: colors.muted }}>{`${open + 1} of ${photos.length}`}</Text>
          <Button small kind="ghost" title="Next ›" onPress={() => setOpen((open + 1) % photos.length)} />
          <Button small kind="secondary" title="Close photos" onPress={() => setOpen(null)} />
        </Row>
      </View>
    );
  }
  if (width < 760 || photos.length < 5) {
    return (
      <ScrollView horizontal style={{ borderRadius: 12 }} contentContainerStyle={{ gap: 8 }}>
        {photos.map((p, i) => (
          <Pressable key={p} onPress={() => setOpen(i)}>
            <Image source={{ uri: p }} style={{ width: Math.min(width - 48, 460), height: 280, borderRadius: 12, backgroundColor: colors.busy }} accessibilityLabel={listing.title} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8, height: 420, borderRadius: 14, overflow: 'hidden' }}>
      <Pressable style={{ flex: 2 }} onPress={() => setOpen(0)}>
        <Image source={{ uri: photos[0] }} style={{ width: '100%', height: '100%', backgroundColor: colors.busy }} accessibilityLabel={listing.title} />
      </Pressable>
      <View style={{ flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.slice(1, 5).map((p, i) => (
          <Pressable key={p} style={{ width: '48.6%', height: 206 }} onPress={() => setOpen(i + 1)}>
            <Image source={{ uri: p }} style={{ width: '100%', height: '100%', backgroundColor: colors.busy }} />
            {i === 3 && photos.length > 5 ? (
              <View style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontWeight: '700' }}>{`Show all ${photos.length} photos`}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type AddOn = { listing: Listing; day: string; time: string };

function BookingBox({ listing }: { listing: Listing }) {
  const isStay = listing.kind === 'stay';
  const [today, setToday] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, DayMark>>({});
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [time, setTime] = useState(listing.start_times[0] ?? '');
  const [guests, setGuests] = useState('2');
  const [sent, setSent] = useState<{ guest: { email: string } | null } | null>(null);
  const [trips, setTrips] = useState<Listing[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);

  useEffect(() => { setToday(iso(new Date())); }, []);
  useEffect(() => { if (today) busyDays(listing.id, today).then(setBusy); }, [listing.id, today]);
  useEffect(() => {
    if (isStay) liveCatalog().then((c) => setTrips(c.listings.filter((l) => l.kind === 'trip' && l.area_id === listing.area_id)));
  }, [isStay, listing.area_id]);

  const nights = isStay && start && end ? nightsBetween(start, end) : 0;
  const people = Number(guests) || 1;

  const ready = isStay ? Boolean(start && end && nights >= listing.min_nights) : Boolean(start);
  const tooMany = people > listing.max_guests;
  const stayDays = useMemo(() => {
    if (!start || !end) return [] as string[];
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [start, end]);

  const items = (notes: string): InquiryItem[] => {
    const out: InquiryItem[] = [{ listing_id: listing.id, start_date: start!, end_date: isStay ? end! : start!, start_time: isStay ? null : time || null, guests: people, notes: notes || null }];
    for (const a of addOns) out.push({ listing_id: a.listing.id, start_date: a.day, end_date: a.day, start_time: a.time || null, guests: people, notes: notes || null });
    return out;
  };

  if (sent) {
    return (
      <Card>
        <H2 style={{ marginTop: 0 }}>Your request is in</H2>
        <P>{`${addOns.length ? 'Your stay and trips went over together. ' : ''}We'll check your dates and ${sent.guest ? `send your quote to ${sent.guest.email}.` : "get back to you with a quote. You'll see the answer under My trips."}`}</P>
        {!sent.guest ? <View style={{ marginTop: 12 }}><Button title="Go to My trips" href="/account" /></View> : null}
      </Card>
    );
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text role="heading" style={{ fontSize: 22, color: colors.navy }}>Check dates and send an inquiry</Text>
      <Text style={{ fontWeight: '700', color: colors.text }}>
        {isStay ? (start && !end ? 'Now pick your check-out day' : 'Pick check-in and check-out') : 'Pick a day'}
      </Text>
      {today ? (
        <Calendar busy={busy} start={start} end={end} range={isStay} months={1} today={today}
          onChange={(a, b) => { setStart(a); setEnd(isStay ? b : a); setAddOns([]); }} />
      ) : <View style={{ height: 320 }} />}
      {start ? <P>{isStay ? `${niceDate(start)} → ${end ? niceDate(end) : '…'}${nights ? ` · ${nights} nights` : ''}` : niceDate(start)}</P> : null}
      {isStay && nights > 0 && nights < listing.min_nights ? <Notice tone="bad">{`This place has a ${listing.min_nights} night minimum.`}</Notice> : null}
      {!isStay && listing.start_times.length > 1 ? (
        <Row gap={8}>{listing.start_times.map((t) => <Chip key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}</Row>
      ) : null}
      <Field label={`Guests (max ${listing.max_guests})`} keyboardType="number-pad" value={guests} onChangeText={setGuests} />
      {tooMany ? <Notice tone="bad">{`This one takes up to ${listing.max_guests}.`}</Notice> : null}

      {isStay && ready && trips.length ? <AddTrips trips={trips} days={stayDays} addOns={addOns} setAddOns={setAddOns} /> : null}

      <InquiryForm items={items} next={listingPath(listing)} ready={ready && !tooMany}
        buttonTitle={addOns.length ? `Book your trip today: stay + ${addOns.length} trip${addOns.length > 1 ? 's' : ''}` : 'Book your trip today'}
        notesLabel="Anything the host should know? (optional)" onSent={(guest) => setSent({ guest })} />
      <Link href="/search"><Text style={{ color: colors.water }}>Keep looking</Text></Link>
    </Card>
  );
}

// "Make it a trip": add guided fishing or a cruise on any day of the stay, booked in the same request.
function AddTrips({ trips, days, addOns, setAddOns }: { trips: Listing[]; days: string[]; addOns: AddOn[]; setAddOns: (a: AddOn[]) => void }) {
  const [pick, setPick] = useState<Listing | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState('');
  function add() {
    if (!pick || !day) return;
    setAddOns([...addOns, { listing: pick, day, time: time || pick.start_times[0] || '' }]);
    setPick(null); setDay(null); setTime('');
  }
  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 12, gap: 8 }}>
      <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 16 }}>Add a guided trip to your stay</Text>
      {addOns.map((a, i) => (
        <Row key={i} gap={8} style={{ justifyContent: 'space-between' }}>
          <P style={{ flexShrink: 1 }}>{`✓ ${a.listing.title}, ${niceDate(a.day)}${a.time ? `, ${a.time}` : ''}`}</P>
          <Button small kind="ghost" title="Remove" onPress={() => setAddOns(addOns.filter((_, j) => j !== i))} />
        </Row>
      ))}
      <Row gap={6}>{trips.map((t) => <Chip key={t.id} label={t.title} active={pick?.id === t.id} onPress={() => { setPick(t); setTime(t.start_times[0] ?? ''); }} />)}</Row>
      {pick ? (
        <>
          <P muted>{`${pick.duration_hours ? `${pick.duration_hours} hours. ` : ''}Which day?`}</P>
          <Row gap={6}>{days.map((d) => <Chip key={d} label={niceDate(d)} active={day === d} onPress={() => setDay(d)} />)}</Row>
          {pick.start_times.length > 1 ? <Row gap={6}>{pick.start_times.map((t) => <Chip key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}</Row> : null}
          <Button small title="Add to my stay" onPress={add} disabled={!day} />
        </>
      ) : null}
    </View>
  );
}
