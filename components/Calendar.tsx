import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addDays, iso, parseIso } from '../lib/format';
import { colors } from '../lib/theme';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type DayMark = 'booked' | 'blocked' | 'requested';

// Month grid. Pick one day (trips) or a check-in/check-out range (stays). Busy days can't be picked.
export function Calendar({ busy, start, end, onChange, range, months = 2, onDayPress, today = iso(new Date()) }: {
  busy: Record<string, DayMark>;
  start?: string | null;
  end?: string | null;
  onChange?: (start: string | null, end: string | null) => void;
  range?: boolean;
  months?: number;
  onDayPress?: (day: string) => void; // host mode: tap any day
  today?: string;
}) {
  const [offset, setOffset] = useState(0);
  const first = useMemo(() => {
    const d = parseIso(today);
    return new Date(d.getFullYear(), d.getMonth() + offset, 1);
  }, [today, offset]);

  function press(day: string) {
    if (onDayPress) return onDayPress(day);
    if (!onChange) return;
    if (!range) return onChange(day, day);
    if (!start || (start && end && end !== start) || day <= start) return onChange(day, null);
    // Range can't cross a busy night.
    for (let d = start; d < day; d = addDays(d, 1)) if (busy[d] && busy[d] !== 'requested') return onChange(day, null);
    onChange(start, day);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable onPress={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} style={{ padding: 6, opacity: offset === 0 ? 0.3 : 1 }}>
          <Text style={{ fontSize: 18, color: colors.navy }}>‹ Earlier</Text>
        </Pressable>
        <Pressable onPress={() => setOffset((o) => o + 1)} style={{ padding: 6 }}>
          <Text style={{ fontSize: 18, color: colors.navy }}>Later ›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {Array.from({ length: months }, (_, i) => (
          <Month key={i} first={new Date(first.getFullYear(), first.getMonth() + i, 1)} busy={busy} start={start} end={end}
            today={today} onPress={press} hostMode={Boolean(onDayPress)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <Legend color={colors.navy} label="Selected" />
        <Legend color={colors.busy} label="Booked" />
        {onDayPress ? <Legend color={colors.pending} label="Requested" /> : null}
        {onDayPress ? <Legend color={colors.blocked} label="Blocked" /> : null}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Month({ first, busy, start, end, today, onPress, hostMode }: {
  first: Date; busy: Record<string, DayMark>; start?: string | null; end?: string | null;
  today: string; onPress: (d: string) => void; hostMode: boolean;
}) {
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7) cells.push(null);
  const last = end ?? start;
  return (
    <View style={{ width: 294 }}>
      <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text, textAlign: 'center', marginBottom: 6 }}>
        {first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w, i) => <Text key={i} style={{ width: 42, textAlign: 'center', color: colors.muted, fontSize: 12 }}>{w}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={{ width: 42, height: 40 }} />;
          const past = day < today;
          const mark = busy[day];
          const picked = start && last && day >= start && day <= last;
          const blockedForGuest = !hostMode && (past || (mark && mark !== 'requested'));
          const bg = picked ? colors.navy
            : mark === 'booked' ? colors.busy
            : hostMode && mark === 'requested' ? colors.pending
            : hostMode && mark === 'blocked' ? colors.blocked
            : !hostMode && mark === 'blocked' ? colors.busy
            : 'transparent';
          return (
            <Pressable key={day} onPress={() => onPress(day)} disabled={Boolean(blockedForGuest) || (hostMode && past)}
              accessibilityLabel={`${day}${mark ? ` ${mark}` : ''}`}
              style={{ width: 42, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderRadius: 8 }}>
              <Text style={{
                color: picked ? '#fff' : past ? '#c2c7cc' : colors.text, fontSize: 15,
                textDecorationLine: !hostMode && mark && mark !== 'requested' && !picked ? 'line-through' : 'none',
              }}>{Number(day.slice(8))}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
