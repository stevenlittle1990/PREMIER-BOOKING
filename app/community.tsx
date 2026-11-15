import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FeedCard, PhotoPicker } from '../components/Community';
import { Button, Chip, Eyebrow, H1, Notice, P, Page, Seo } from '../components/ui';
import { communityFeed, createPost, uploadPhotos, type FeedItem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { catalog } from '../lib/catalog';
import { hasDatabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';

// The community page: photos and stories from customers, guides and the lodge, plus trip reviews.
export default function Community() {
  const { session, isAdmin } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const load = useCallback(() => { communityFeed(60).then(setItems); }, []);
  useEffect(load, [load, session]);

  return (
    <Page>
      <Seo title="Community" description="Catches, sunsets and stories from Port O'Connor, plus reviews from our guests." path="/community" />
      <Eyebrow>Port O'Connor</Eyebrow>
      <H1>Community</H1>
      <P muted style={{ marginBottom: 14 }}>Catches, sunsets and stories from our guests and guides, plus trip reviews.</P>
      {!hasDatabase ? <Notice>Posts open once the database is connected.</Notice> : session ? <Composer onPosted={load} /> : (
        <View style={{ backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10, marginBottom: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.navy }}>Share your photos</Text>
          <P muted>Sign in or create an account to post your catch, your crew or the sunset.</P>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Sign in" href="/sign-in?next=/community" /></View>
            <View style={{ flex: 1 }}><Button title="Create account" kind="secondary" href="/sign-in?mode=signup&next=/community" /></View>
          </View>
        </View>
      )}
      {items === null ? <P muted>Loading…</P> : items.length === 0 ? (
        <P muted>Nothing here yet. Be the first to post a photo.</P>
      ) : (
        <View style={{ gap: 14, maxWidth: 620, width: '100%', alignSelf: 'center' }}>
          {items.map((it) => <FeedCard key={`${it.type}-${it.id}`} item={it} me={session?.user.id} isAdmin={isAdmin} onChanged={load} />)}
        </View>
      )}
    </Page>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [listingId, setListingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const post = async () => {
    setBusy(true); setError('');
    try {
      const urls = await uploadPhotos(`posts/${session!.user.id}`, photos.map((p) => p.blob));
      await createPost(body, urls, listingId);
      setBody(''); setPhotos([]); setListingId(null); setOpen(false); onPosted();
    } catch (e) { setError((e as Error).message || 'Could not post. Try again.'); }
    setBusy(false);
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.shallows, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera" size={20} color={colors.water} />
        </View>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 16 }}>Share a photo or a story…</Text>
        <Ionicons name="add-circle" size={28} color={colors.navy} />
      </Pressable>
    );
  }
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.water, padding: 14, gap: 12, marginBottom: 16 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.navy }}>New post</Text>
      <PhotoPicker value={photos} onChange={setPhotos} />
      <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="What happened out there? Fish, crew, sunset, the spot…"
        placeholderTextColor="#98a3ad" style={{ minHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 12, fontSize: 16, color: colors.text, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Which trip or house? (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
        <Chip label="None" active={!listingId} onPress={() => setListingId(null)} />
        {catalog.listings.map((l) => <Chip key={l.id} label={l.title} active={listingId === l.id} onPress={() => setListingId(l.id)} />)}
      </ScrollView>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Cancel" kind="ghost" onPress={() => { setOpen(false); setError(''); }} /></View>
        <View style={{ flex: 2 }}><Button title={busy ? 'Posting…' : 'Post'} onPress={post} busy={busy} disabled={!body.trim() && !photos.length} /></View>
      </View>
    </View>
  );
}
