import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { markAllRead, myNotifications } from '../lib/api';
import { colors } from '../lib/theme';
import type { Notification } from '../lib/types';
import { Button, Card, Row } from './ui';

// The signed-in person's alerts: new requests, jobs assigned, bookings confirmed. Also sent by email/text once a sender is set up.
export function Notifications({ limit = 8 }: { limit?: number }) {
  const [rows, setRows] = useState<Notification[]>([]);
  const load = useCallback(() => { myNotifications(30).then(setRows); }, []);
  useEffect(load, [load]);
  const unread = rows.filter((n) => !n.read_at);
  if (!rows.length) return null;
  return (
    <Card style={{ marginTop: 14, gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.navy }}>{unread.length ? `Notifications (${unread.length} new)` : 'Notifications'}</Text>
        {unread.length ? <Button small kind="ghost" title="Mark all read" onPress={async () => { await markAllRead(); load(); }} /> : null}
      </Row>
      {rows.slice(0, limit).map((n) => (
        <View key={n.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, opacity: n.read_at ? 0.65 : 1 }}>
          <Text style={{ fontWeight: n.read_at ? '500' : '800', color: colors.text }}>
            {n.read_at ? '' : '● '}{n.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>{n.body}</Text>
          <Row gap={10}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(n.created_at).toLocaleString()}</Text>
            {n.link ? <Link href={n.link as never}><Text style={{ color: colors.water, fontSize: 13, fontWeight: '700' }}>Open</Text></Link> : null}
          </Row>
        </View>
      ))}
    </Card>
  );
}
