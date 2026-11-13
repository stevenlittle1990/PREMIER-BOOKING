import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { catalog } from '../lib/catalog';
import { colors, radius } from '../lib/theme';
import { DateField } from './DateField';
import { Button, Chip, Field, Row } from './ui';

// Where / what / when / how many. Sends the guest to /search with the choices in the address.
export function SearchBox({ initial }: { initial?: { area?: string; kind?: string; date?: string; guests?: string } }) {
  const [area, setArea] = useState(initial?.area ?? catalog.areas[0]?.slug ?? '');
  const [kind, setKind] = useState(initial?.kind ?? 'all');
  const [date, setDate] = useState(initial?.date ?? '');
  const [guests, setGuests] = useState(initial?.guests ?? '');
  function go() {
    const q = new URLSearchParams();
    if (area) q.set('area', area);
    if (kind !== 'all') q.set('kind', kind);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) q.set('date', date);
    if (Number(guests) > 0) q.set('guests', String(Number(guests)));
    router.push(`/search?${q.toString()}` as never);
  }
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius, padding: 16, gap: 10, maxWidth: 760, width: '100%' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' }}>Where</Text>
      <Row gap={8}>
        {catalog.areas.map((a) => <Chip key={a.slug} label={a.name} active={area === a.slug} onPress={() => setArea(a.slug)} />)}
      </Row>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: 4 }}>Looking for</Text>
      <Row gap={8}>
        <Chip label="Everything" active={kind === 'all'} onPress={() => setKind('all')} />
        <Chip label="Places to stay" active={kind === 'stay'} onPress={() => setKind('stay')} />
        <Chip label="Fishing and trips" active={kind === 'trip'} onPress={() => setKind('trip')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'flex-end' }}>
        <View style={{ flexBasis: 200, flexGrow: 1 }}>
          <DateField label="Date" value={date} onChange={setDate} />
        </View>
        <View style={{ flexBasis: 120, flexGrow: 1 }}>
          <Field label="Guests" placeholder="2" keyboardType="number-pad" value={guests} onChangeText={setGuests} />
        </View>
        <View style={{ flexBasis: 140, flexGrow: 1, marginBottom: 12 }}>
          <Button title="Search" onPress={go} />
        </View>
      </Row>
    </View>
  );
}
