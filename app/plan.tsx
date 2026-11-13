import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Photo } from '../components/ListingCard';
import { Button, Card, Eyebrow, H1, H2, Notice, P, Page, Row, Seo } from '../components/ui';
import { liveCatalog, type InquiryItem } from '../lib/api';
import { InquiryForm } from '../components/InquiryForm';
import { catalog } from '../lib/catalog';
import { addDays, niceDate } from '../lib/format';
import { boatsNeeded, decodeItems, encodeItems, LIKES, makePlans, swapOptions, WHO, type Answers, type Like, type Plan, type PlanItem, type Who } from '../lib/plan';
import { colors, radius } from '../lib/theme';
import type { Area, Listing } from '../lib/types';

type Q = { area?: string; who?: string; g?: string; like?: string; from?: string; n?: string; stay?: string; flex?: string; plan?: string; it?: string; step?: string };

// "Plan a trip for me": a few taps, then ready-made plans from the real listings, sent as one inquiry.
export default function PlanTrip() {
  const q = useLocalSearchParams<Q>();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [data, setData] = useState<{ areas: Area[]; listings: Listing[] }>(catalog);
  useEffect(() => { liveCatalog().then(setData); }, []);

  // Answers live in the address bar, so going back works and nothing is lost when signing in partway through.
  const a: Answers = {
    area: q.area || data.areas[0]?.id || catalog.areas[0]?.id || '',
    who: (q.who as Who) || 'couple',
    guests: Number(q.g) || WHO[(q.who as Who) || 'couple'].guests,
    likes: (q.like ? q.like.split(',') : []) as Like[],
    from: q.from || '',
    nights: Number(q.n ?? 2),
    stay: q.stay !== '0',
    flexible: q.flex === '1',
  };
  const multiArea = data.areas.length > 1;
  const steps = multiArea ? ['where', 'who', 'like', 'when'] : ['who', 'like', 'when'];
  const step = mounted && q.step ? q.step : steps[0];
  const next = (s: string) => steps[steps.indexOf(s) + 1] ?? 'ideas';
  const at = steps.indexOf(step) + 1;
  const set = (p: Partial<Q>) => router.setParams(p as never);
  const go = (p: Partial<Q>) => router.push({ pathname: '/plan', params: { ...q, ...p } } as never);

  const plans = useMemo(() => (step === 'ideas' || step === 'trip' ? makePlans(data.listings, a) : []), [step, data.listings, q.area, q.who, q.g, q.like, q.n, q.stay]);
  const chosen: Plan | null = useMemo(() => {
    if (step !== 'trip') return null;
    const base = plans.find((p) => p.key === q.plan) ?? plans[0];
    if (!base) return null;
    return q.it !== undefined ? { ...base, items: decodeItems(q.it, data.listings) } : base;
  }, [step, plans, q.plan, q.it, data.listings]);


  return (
    <Page>
      <Seo title="Plan a trip for me" description="Answer a few quick questions and get a ready-made coast trip: a place to stay and things to do." path="/plan" />
      <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {at > 0 ? (
          <>
            <Row gap={8} style={{ marginBottom: 6 }}>
              <Ionicons name="sparkles" size={18} color={colors.water} />
              <Eyebrow>{`Plan a trip for me · ${at} of ${steps.length}`}</Eyebrow>
            </Row>
            <Progress at={at} of={steps.length} />
          </>
        ) : null}

        {step === 'where' ? (
          <Step title="Where to?" sub="Pick a town.">
            {data.areas.map((ar) => <Choice key={ar.id} title={ar.name} sub={ar.region} active={a.area === ar.id} onPress={() => go({ area: ar.id, step: next('where') })} />)}
          </Step>
        ) : null}
        {step === 'who' ? <WhoStep a={a} go={go} next={next('who')} /> : null}
        {step === 'like' ? <LikeStep a={a} set={set} go={go} next={next('like')} /> : null}
        {step === 'when' ? <WhenStep a={a} set={set} go={go} next={next('when')} /> : null}

        {step === 'ideas' ? (
          <>
            <Eyebrow>Your trip ideas</Eyebrow>
            <H1>Pick the one that sounds best</H1>
            <P muted>{`${WHO[a.who].label}, ${a.guests} ${a.guests === 1 ? 'person' : 'people'}${a.stay ? `, ${a.nights} night${a.nights === 1 ? '' : 's'}` : ', day trip'}${a.from ? ` from ${niceDate(a.from)}` : ''}. You can change anything on the next screen.`}</P>
            {plans.length ? plans.map((p) => (
              <PlanCard key={p.key} plan={p} a={a} onPick={() => go({ plan: p.key, it: encodeItems(p.items), step: 'trip' })} />
            )) : <Notice>{"We couldn't put a plan together for that. Try different answers, or call 361-210-8494 and we'll plan it with you."}</Notice>}
            <View style={{ marginTop: 8 }}><Button title="Change my answers" kind="ghost" onPress={() => go({ step: steps[0] })} /></View>
          </>
        ) : null}

        {step === 'trip' && chosen ? <PlanDetail plan={chosen} a={a} listings={data.listings} set={set} back={() => go({ step: 'ideas' })} /> : null}
      </View>
    </Page>
  );
}

function Progress({ at, of }: { at: number; of: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
      {Array.from({ length: of }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < at ? colors.water : colors.line }} />)}
    </View>
  );
}

function Step({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <H1>{title}</H1>
      {sub ? <P muted style={{ marginTop: -6 }}>{sub}</P> : null}
      {children}
    </View>
  );
}

function Choice({ title, sub, icon, active, onPress }: { title: string; sub?: string; icon?: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius + 4,
        borderWidth: 2, borderColor: active ? colors.navy : colors.line, backgroundColor: active ? '#eaf2f5' : '#fff' }}>
      {icon ? <Ionicons name={icon as never} size={26} color={colors.water} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.navy }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={22} color={active ? colors.navy : colors.muted} />
    </Pressable>
  );
}

type StepProps = { a: Answers; go: (p: Partial<Q>) => void; set?: (p: Partial<Q>) => void; next: string };

function WhoStep({ a, go, next }: StepProps) {
  return (
    <Step title="Who's coming?" sub="This helps us pick the right boat and the right trips.">
      {(Object.keys(WHO) as Who[]).map((k) => (
        <Choice key={k} title={WHO[k].label} sub={WHO[k].note} active={a.who === k}
          onPress={() => go({ who: k, g: String(WHO[k].guests), step: next })} />
      ))}
    </Step>
  );
}

function LikeStep({ a, set, go, next }: StepProps) {
  const toggle = (k: Like) => {
    const next = a.likes.includes(k) ? a.likes.filter((x) => x !== k) : [...a.likes, k];
    set!({ like: next.join(',') });
  };
  return (
    <Step title="What sounds good?" sub="Pick as many as you like.">
      {(Object.keys(LIKES) as Like[]).map((k) => <Choice key={k} icon={LIKES[k].icon} title={LIKES[k].label} active={a.likes.includes(k)} onPress={() => toggle(k)} />)}
      <Row style={{ marginTop: 6 }}>
        <Button title={a.likes.length ? 'Next' : 'Not sure, surprise me'} onPress={() => go({ step: next })} />
      </Row>
    </Step>
  );
}

function WhenStep({ a, set, go, next }: StepProps) {
  return (
    <Step title="When, and for how long?" sub="Not sure of the exact day? Pick a close one and tap 'My dates are flexible'.">
      <DateField label="Arriving" value={a.from} onChange={(d) => set!({ from: d })} placeholder="Pick a day" />
      <Text style={lbl}>How many people</Text>
      <Row gap={14} style={{ marginBottom: 14 }}>
        <Round icon="remove" onPress={() => set!({ g: String(Math.max(1, a.guests - 1)) })} label="One fewer person" />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.navy, minWidth: 34, textAlign: 'center' }}>{a.guests}</Text>
        <Round icon="add" onPress={() => set!({ g: String(Math.min(40, a.guests + 1)) })} label="One more person" />
      </Row>
      <Text style={lbl}>Place to stay</Text>
      <Row gap={8} style={{ marginBottom: 14 }}>
        {[1, 2, 3, 4, 5, 7].map((n) => <Pill key={n} label={`${n} night${n > 1 ? 's' : ''}`} active={a.stay && a.nights === n} onPress={() => set!({ stay: '1', n: String(n) })} />)}
        <Pill label="Day trip, no house" active={!a.stay} onPress={() => set!({ stay: '0' })} />
      </Row>
      <Pill label="My dates are flexible" active={a.flexible} onPress={() => set!({ flex: a.flexible ? '0' : '1' })} />
      <Row style={{ marginTop: 16 }}>
        <Button title="Show me trip ideas" onPress={() => go({ step: next })} />
      </Row>
    </Step>
  );
}

function Round({ icon, onPress, label }: { icon: string; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon as never} size={24} color={colors.navy} />
    </Pressable>
  );
}

function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999, borderWidth: 1,
        borderColor: active ? colors.navy : colors.line, backgroundColor: active ? colors.navy : '#fff' }}>
      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const dayLabel = (a: Answers, day: number) => {
  if (a.from) return niceDate(addDays(a.from, day));
  return a.stay ? (day === 0 ? 'Arrival day' : `Day ${day + 1}`) : 'Your day';
};

function Itinerary({ plan, a, onSwap, onRemove }: { plan: Plan; a: Answers; onSwap?: (i: PlanItem) => void; onRemove?: (i: PlanItem) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {plan.stay ? (
        <ItemRow icon="bed-outline" when={a.from ? `${niceDate(a.from)} → ${niceDate(addDays(a.from, a.nights))}` : `${a.nights} night${a.nights === 1 ? '' : 's'}`}
          title={plan.stay.title} note={a.guests > plan.stay.max_guests ? `Sleeps ${plan.stay.max_guests}. We'll help with room for the rest.` : `Sleeps ${plan.stay.max_guests}`} />
      ) : null}
      {plan.items.map((i) => {
        const boats = boatsNeeded(i.listing, a.guests);
        return (
          <ItemRow key={i.listing.id} icon={i.listing.category === 'fishing' ? 'fish-outline' : i.listing.category === 'sunset_cruise' ? 'sunny-outline' : i.listing.category === 'bird_watching' ? 'binoculars-outline' : 'boat-outline'}
            when={`${dayLabel(a, i.day)}${i.time ? ` · ${i.time}` : ''}`} title={i.listing.title}
            note={boats > 1 ? `${boats} boats for ${a.guests} people` : i.listing.duration_hours ? `About ${i.listing.duration_hours} hours` : undefined}
            onSwap={onSwap ? () => onSwap(i) : undefined} onRemove={onRemove ? () => onRemove(i) : undefined} />
        );
      })}
    </View>
  );
}

function ItemRow({ icon, when, title, note, onSwap, onRemove }: { icon: string; when: string; title: string; note?: string; onSwap?: () => void; onRemove?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e3eef2', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as never} size={20} color={colors.water} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>{when}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
        {note ? <Text style={{ fontSize: 13, color: colors.muted }}>{note}</Text> : null}
        {onSwap || onRemove ? (
          <Row gap={18} style={{ marginTop: 4 }}>
            {onSwap ? <Text onPress={onSwap} style={{ color: colors.water, fontWeight: '700', paddingVertical: 6 }}>Swap</Text> : null}
            {onRemove ? <Text onPress={onRemove} style={{ color: colors.bad, fontWeight: '700', paddingVertical: 6 }}>Remove</Text> : null}
          </Row>
        ) : null}
      </View>
    </View>
  );
}

function PlanCard({ plan, a, onPick }: { plan: Plan; a: Answers; onPick: () => void }) {
  const cover = plan.items.find((i) => i.listing.photos.length)?.listing ?? plan.stay ?? plan.items[0]?.listing;
  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
      {cover ? <Photo listing={cover} height={150} /> : null}
      <View style={{ padding: 16, gap: 10 }}>
        <Text role="heading" style={{ fontSize: 22, color: colors.navy }}>{plan.name}</Text>
        <P muted style={{ marginTop: -6 }}>{plan.blurb}</P>
        <Itinerary plan={plan} a={a} />
        <Button title="Pick this trip" onPress={onPick} />
      </View>
    </Card>
  );
}

function PlanDetail({ plan, a, listings, set, back }: { plan: Plan; a: Answers; listings: Listing[]; set: (p: Partial<Q>) => void; back: () => void }) {
  const [swapping, setSwapping] = useState<PlanItem | null>(null);
  const [sent, setSent] = useState<{ guest: { email: string } | null } | null>(null);

  const save = (items: PlanItem[]) => set({ it: encodeItems(items) });
  const here = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/plan';

  const items = (extra: string): InquiryItem[] => {
    const summary = [
      `Trip plan: ${plan.name}.`, `${WHO[a.who].label}, ${a.guests} people.`,
      a.likes.length ? `Likes: ${a.likes.map((l) => LIKES[l].label.toLowerCase()).join(', ')}.` : '',
      a.flexible ? 'Dates are flexible.' : '',
      ...plan.items.filter((i) => boatsNeeded(i.listing, a.guests) > 1).map((i) => `${i.listing.title}: about ${boatsNeeded(i.listing, a.guests)} boats.`),
      extra,
    ].filter(Boolean).join(' ');
    const out: InquiryItem[] = [];
    if (plan.stay) out.push({ listing_id: plan.stay.id, start_date: a.from, end_date: addDays(a.from, a.nights), start_time: null, guests: a.guests, notes: summary });
    for (const i of plan.items) {
      const d = addDays(a.from, i.day);
      out.push({ listing_id: i.listing.id, start_date: d, end_date: d, start_time: i.time, guests: a.guests, notes: summary });
    }
    return out;
  };

  if (sent) {
    return (
      <Card style={{ gap: 8 }}>
        <Ionicons name="checkmark-circle" size={40} color={colors.good} />
        <H2 style={{ marginTop: 0 }}>Your trip request is in</H2>
        {sent.guest ? (
          <P>{`We'll check the dates, line up your guide, and send your quote to ${sent.guest.email}. Questions? Call 361-210-8494.`}</P>
        ) : (
          <>
            <P>{"We'll check the dates, line up your guide, and get back to you with a quote. You'll see the answer under My trips."}</P>
            <Row><Button title="Go to My trips" href="/account" /></Row>
          </>
        )}
      </Card>
    );
  }

  return (
    <>
      <Eyebrow>Your trip</Eyebrow>
      <H1>{plan.name}</H1>
      <Card style={{ gap: 12 }}>
        <Itinerary plan={plan} a={a} onSwap={setSwapping} onRemove={(i) => save(plan.items.filter((x) => x !== i))} />
      </Card>

      {swapping ? (
        <Card style={{ marginTop: 12, gap: 8, borderColor: colors.water }}>
          <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 16 }}>{`Instead of ${swapping.listing.title}:`}</Text>
          {swapOptions(listings, plan, swapping).map((l) => (
            <Choice key={l.id} title={l.title} sub={l.summary} onPress={() => {
              save(plan.items.map((x) => (x === swapping ? { listing: l, day: x.day, time: l.start_times[0] ?? null } : x)));
              setSwapping(null);
            }} />
          ))}
          {!swapOptions(listings, plan, swapping).length ? <P muted>Nothing else fits that time slot. You can remove it instead.</P> : null}
          <Row><Button small kind="ghost" title="Keep it" onPress={() => setSwapping(null)} /></Row>
        </Card>
      ) : null}

      <H2>Book your trip today</H2>
      <Card>
        {!a.from ? <Notice>{"Add the day you arrive so we can check it."}</Notice> : null}
        {!a.from ? <DateField label="Arriving" value={a.from} onChange={(d) => set({ from: d })} placeholder="Pick a day" /> : null}
        <InquiryForm items={items} next={here} buttonTitle="Book your trip today" ready={Boolean(plan.items.length || plan.stay)}
          check={() => (a.from ? null : 'Pick the day you arrive. If you are not sure, pick a close day and say your dates are flexible.')}
          notesLabel="Anything else? (optional)" notesPlaceholder="Kids' ages, a birthday, first time fishing…" onSent={(guest) => setSent({ guest })} />
      </Card>
      <View style={{ marginTop: 12 }}><Button title="See other ideas" kind="ghost" onPress={back} /></View>
    </>
  );
}

const lbl = { fontSize: 13, fontWeight: '600' as const, color: colors.muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
