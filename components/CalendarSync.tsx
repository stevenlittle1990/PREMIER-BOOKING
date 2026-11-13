import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { calendarLinks, exportCalendarUrl, saveCalendarLinks, syncCalendarNow } from '../lib/api';
import { colors } from '../lib/theme';
import { Button, Card, Field, Notice, P, Row } from './ui';

// Two-way calendar sync for one listing: our feed goes into Hostfully/Airbnb, theirs comes in here.
export function CalendarSync({ listingId, slug }: { listingId: string; slug: string }) {
  const [urls, setUrls] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const feed = exportCalendarUrl(slug);

  useEffect(() => {
    calendarLinks(listingId)
      .then((c) => { setUrls((c?.import_urls ?? []).join('\n')); setSyncedAt(c?.synced_at ?? null); setProblem(c?.sync_error ?? null); })
      .catch(() => setProblem('Calendar sync is not switched on yet.'));
  }, [listingId]);

  async function saveAndSync() {
    setBusy(true); setNote('');
    try {
      const list = urls.split('\n').map((u) => u.trim()).filter(Boolean);
      if (list.some((u) => !/^https?:\/\//i.test(u) && !/^webcal:\/\//i.test(u))) throw new Error('Each line should be a calendar link starting with https://');
      await saveCalendarLinks(listingId, list.map((u) => u.replace(/^webcal:\/\//i, 'https://')));
      const nights = list.length ? await syncCalendarNow(listingId) : 0;
      setSyncedAt(new Date().toISOString()); setProblem(null);
      setNote(list.length ? `Synced. ${nights} night${nights === 1 ? '' : 's'} blocked from other calendars.` : 'Saved.');
    } catch (e) {
      setProblem((e as Error).message);
    }
    setBusy(false);
  }

  async function copy() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(feed);
      setNote('Calendar link copied.');
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 4 }}>Calendar sync</Text>
      <P muted>Keeps Hostfully, Airbnb, VRBO or Google Calendar and Premier Booking from double-booking each other. Updates every 30 minutes.</P>
      <Text style={lbl}>1. Paste this link into the other site's calendar import</Text>
      <View style={{ backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginBottom: 8 }}>
        <Text selectable style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 13 }}>{feed}</Text>
      </View>
      <Row style={{ marginBottom: 14 }}><Button title="Copy link" kind="ghost" onPress={copy} /></Row>
      <Field label="2. Paste the other sites' export links here (one per line)" multiline autoCapitalize="none"
        placeholder="https://… .ics link from Hostfully, Airbnb or Google Calendar" value={urls} onChangeText={setUrls} />
      <P muted>{syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString()}` : 'Not synced yet.'}</P>
      {problem ? <Notice tone="bad">{problem}</Notice> : null}
      {note ? <Notice tone="good">{note}</Notice> : null}
      <Row style={{ marginTop: 8 }}><Button title="Save and sync now" onPress={saveAndSync} busy={busy} /></Row>
    </Card>
  );
}

const lbl = { fontSize: 13, fontWeight: '600' as const, color: colors.muted, marginBottom: 6 };
