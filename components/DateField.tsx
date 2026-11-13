import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { iso, niceDate } from '../lib/format';
import { colors, radius } from '../lib/theme';
import { Calendar } from './Calendar';
import { Button, Row } from './ui';

// Tap to pick a day from a calendar sheet. No typing dates on a phone.
export function DateField({ label, value, onChange, placeholder = 'Any date' }: {
  label: string; value: string; onChange: (d: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState('');
  useEffect(() => setToday(iso(new Date())), []);
  return (
    <View style={{ marginBottom: 12, flexGrow: 1 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? niceDate(value) : placeholder}`}
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff', minHeight: 46, justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: value ? colors.text : '#98a3ad' }}>{value ? niceDate(value) : placeholder}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(16,34,47,0.45)', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, width: '100%', maxWidth: 520, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 28, gap: 10 }}>
            <Text role="heading" style={{ fontSize: 22, color: colors.navy }}>{label}</Text>
            {today ? <Calendar busy={{}} start={value || null} end={value || null} months={1} today={today} onChange={(d) => { if (d) { onChange(d); setOpen(false); } }} /> : null}
            <Row>
              <Button title="Any date" kind="ghost" onPress={() => { onChange(''); setOpen(false); }} />
              <Button title="Close" kind="secondary" onPress={() => setOpen(false)} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
