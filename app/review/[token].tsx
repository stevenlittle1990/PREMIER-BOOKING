import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { FeedCard, PhotoPicker, Stars } from '../../components/Community';
import { Button, Card, Eyebrow, Field, H1, Notice, P, Page, Seo } from '../../components/ui';
import { feedItem, reviewInfo, submitReview, uploadPhotos, type FeedItem } from '../../lib/api';
import { niceDate } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import type { ReviewInfo } from '../../lib/types';

const WORDS = ['', 'Not good', 'Could be better', 'Good', 'Great', 'Amazing'];

// The review link we send after a trip. Works without an account: the link itself is the key.
export default function WriteReview() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<ReviewInfo | null | undefined>(undefined);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<FeedItem | null>(null);

  useEffect(() => {
    if (!token) return;
    reviewInfo(String(token)).then((r) => {
      setInfo(r);
      if (r?.review) { setStars(r.review.stars); setBody(r.review.body); }
      if (r) setName(r.name ?? '');
    });
  }, [token]);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const fresh = await uploadPhotos(`reviews/${token}`, photos.map((p) => p.blob));
      const all = [...(info?.review?.photos ?? []), ...fresh].slice(0, 6);
      const id = await submitReview(String(token), { stars, body, photos: all, name });
      const saved = await feedItem(id).catch(() => null);
      setDone(saved ?? { type: 'review', id, listing_id: '', author_name: name || 'Guest', stars, body, photos: all, hidden: false, created_at: new Date().toISOString() });
    } catch (e) { setError((e as Error).message || 'Could not send. Try again.'); }
    setBusy(false);
  };

  if (info === undefined) return <Page><P muted>Loading…</P></Page>;
  if (info === null) return <Page><H1>Review link not found</H1><P muted>Check the link in your text or email, or call us at 361-210-8494.</P></Page>;
  const when = info.start_date === info.end_date ? niceDate(info.start_date) : `${niceDate(info.start_date)} to ${niceDate(info.end_date)}`;

  if (done) {
    return (
      <Page>
        <View style={{ maxWidth: 620, width: '100%', alignSelf: 'center', gap: 14 }}>
          <Eyebrow>Thank you</Eyebrow>
          <H1>Your review is up</H1>
          <P muted>Share it with your friends so they know where to fish next time.</P>
          <FeedCard item={done} />
          <Button title="See it in Community" kind="secondary" href="/community" />
        </View>
      </Page>
    );
  }

  return (
    <Page>
      <Seo title="Write a review" description="Tell us how your trip went." />
      <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Eyebrow>How was your trip?</Eyebrow>
        <H1>{info.listing_title}</H1>
        <P muted style={{ marginBottom: 14 }}>{when}</P>
        {!info.ready ? (
          <Notice>{info.status === 'accepted' ? 'You can write your review once your trip day comes. We\'ll remind you.' : 'Reviews open once your booking is confirmed and the trip has happened.'}</Notice>
        ) : (
          <Card style={{ gap: 14 }}>
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 6 }}>
              <Stars value={stars} size={40} onChange={setStars} />
              <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 16, minHeight: 22 }}>{WORDS[stars] || 'Tap to rate'}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your review</Text>
              <TextInput value={body} onChangeText={setBody} multiline maxLength={3000}
                placeholder={info.listing_kind === 'stay' ? 'How was the house? What did you love?' : 'How was the fishing? What did you catch? How was your guide?'}
                placeholderTextColor="#98a3ad"
                style={{ minHeight: 120, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 12, fontSize: 16, color: colors.text, backgroundColor: '#fff', textAlignVertical: 'top', outlineStyle: 'none' } as never} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Photos</Text>
              {info.review?.photos.length ? <P muted style={{ fontSize: 14 }}>{`${info.review.photos.length} photo${info.review.photos.length > 1 ? 's' : ''} already added.`}</P> : null}
              <PhotoPicker value={photos} onChange={setPhotos} max={6 - (info.review?.photos.length ?? 0)} />
            </View>
            <Field label="Name shown" value={name} onChangeText={setName} placeholder="Your name" />
            <P muted style={{ fontSize: 13, marginTop: -6 }}>We show your first name and last initial.</P>
            {error ? <Notice tone="bad">{error}</Notice> : null}
            <Button title={info.review ? 'Update my review' : 'Post my review'} onPress={send} busy={busy} disabled={!stars} />
          </Card>
        )}
      </View>
    </Page>
  );
}
