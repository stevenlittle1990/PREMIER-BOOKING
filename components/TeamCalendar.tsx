import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addDays, iso, niceDate } from '../lib/format';
import { colors, radius } from '../lib/theme';
import type { Assignment, Booking, Listing, Profile } from '../lib/types';

type Row = Booking & { listing: Listing | null };
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// One calendar for everything: every house and trip, who is working it, and what's still waiting.
export function TeamCalendar({ bookings, assignments, people, onPick }: {
  bookings: Row[]; assignments: Assignment[]; people: Profile[]; onPick?: (b: Row) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const today = iso(new Date());
  const first = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); }, [offset]);
  const name = (id: string) => { const p = people.find((x) => x.id === id); return (p?.full_name || p?.email || 'Crew').split(' ')[0]; };

  const live = bookings.filter((b) => b.status === 'accepted' || b.status === 'requested');
  const byDay = useMemo(() => {
    const m: Record<string, Row[]> = {};
    for (const b of live) {
      const last = b.end_date > b.start_date ? addDays(b.end_date, -1) : b.start_date;
      for (let d = b.start_date; d <= last; d = addDays(d, 1)) (m[d] ??= []).push(b);
    }
    return m;
  }, [live]);

  const cells: (string | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7) cells.push(null);
  const crew = (b: Row) => assignments.filter((a) => a.booking_id === b.id && a.status !== 'declined');
  const label = (b: Row) => (b.listing?.title ?? 'Booking').replace(/^POC Premier /, '').split(' ').slice(0, 2).join(' ');

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Pressable onPress={() => setOffset(offset - 1)} style={{ padding: 8 }}><Text style={{ fontSize: 18, color: colors.navy }}>‹</Text></Pressable>
        <Text role="heading" style={{ fontSize: 20, color: colors.navy }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => setOffset(offset + 1)} style={{ padding: 8 }}><Text style={{ fontSize: 18, color: colors.navy }}>›</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 4 }}>{w}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line }}>
        {cells.map((d, i) => {
          const items = d ? byDay[d] ?? [] : [];
          return (
            <Pressable key={i} disabled={!d} onPress={() => d && setDay(d)}
              style={{ width: `${100 / 7}%`, minHeight: 78, padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line,
                backgroundColor: !d ? 'transparent' : d === day ? colors.pending : '#fff' }}>
              {d ? <Text style={{ fontSize: 12, fontWeight: d === today ? '800' : '500', color: d === today ? colors.water : colors.text }}>{Number(d.slice(8))}</Text> : null}
              {items.slice(0, 3).map((b) => {
                const c = crew(b);
                return (
                  <View key={b.id} style={{ marginTop: 2, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
                    backgroundColor: b.status === 'accepted' ? (c.length ? colors.navy : colors.bay) : colors.pending }}>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: b.status === 'accepted' ? '#fff' : colors.navy }}>
                      {`${label(b)}${c.length ? ` · ${name(c[0].assignee_id)}` : ''}`}
                    </Text>
                  </View>
                );
              })}
              {items.length > 3 ? <Text style={{ fontSize: 10, color: colors.muted }}>{`+${items.length - 3} more`}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        <Key color={colors.navy} label="Confirmed, crew assigned" />
        <Key color={colors.bay} label="Confirmed, needs crew" />
        <Key color={colors.pending} label="Request waiting" />
      </View>
      {day ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          <Text style={{ fontWeight: '800', color: colors.navy }}>{niceDate(day)}</Text>
          {(byDay[day] ?? []).length ? (byDay[day] ?? []).map((b) => (
            <Pressable key={b.id} onPress={() => onPick?.(b)} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 10, backgroundColor: '#fff' }}>
              <Text style={{ fontWeight: '700' }}>{`${b.listing?.title ?? 'Booking'}${b.start_time ? ` · ${b.start_time}` : ''}`}</Text>
              <Text style={{ color: colors.muted }}>{`${b.guest_name} · ${b.guests} guests · ${b.status === 'accepted' ? 'confirmed' : 'waiting on you'}`}</Text>
              <Text style={{ color: colors.muted }}>{crew(b).length ? `Crew: ${crew(b).map((a) => `${name(a.assignee_id)} (${a.status === 'accepted' ? 'accepted' : 'not answered'})`).join(', ')}` : 'No crew assigned'}</Text>
            </Pressable>
          )) : <Text style={{ color: colors.muted }}>Nothing booked.</Text>}
        </View>
      ) : null}
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color, borderWidth: 1, borderColor: colors.line }} />
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}
