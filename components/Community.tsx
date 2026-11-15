import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { deletePost, reviewsFor, setHidden, type FeedItem } from '../lib/api';
import type { Review } from '../lib/types';
import { catalog } from '../lib/catalog';
import { listingPath } from '../lib/format';
import { pickImages, shrink } from '../lib/photos';
import { colors, radius } from '../lib/theme';
import { Button, Notice } from './ui';

const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://premier-booking.netlify.app';

export function Stars({ value, size = 18, onChange }: { value: number; size?: number; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 6 : 2 }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? '#e0a526' : '#c9bfae'} />;
        return onChange
          ? <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>{icon}</Pressable>
          : <View key={n}>{icon}</View>;
      })}
    </View>
  );
}

export function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Photos swipe sideways; tap one to see it whole.
export function PhotoStrip({ photos, height = 300 }: { photos: string[]; height?: number }) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<string | null>(null);
  if (!photos.length) return null;
  const w = Math.min(width - 32, 560);
  return (
    <>
      <ScrollView horizontal pagingEnabled={photos.length > 1} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: photos.length > 1 ? 14 : 0 }}>
        {photos.map((p) => (
          <Pressable key={p} onPress={() => setOpen(p)}>
            <Image source={{ uri: p }} style={{ width: photos.length > 1 ? w - 48 : w, height, backgroundColor: colors.busy }} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {open ? <Image source={{ uri: open }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <Text style={{ color: '#fff', textAlign: 'center', marginTop: 12 }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

// Share to Facebook, Instagram, texts or any app on the phone. The photo goes along when the phone allows it,
// so Instagram can take it; otherwise the link is shared.
export function ShareButton({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const url = `${SITE}/post/${item.id}`;
  const listing = item.listing_id ? catalog.listings.find((l) => l.id === item.listing_id) : null;
  const text = item.type === 'review'
    ? `${'★'.repeat(item.stars)} ${item.body ? `"${item.body.slice(0, 180)}"` : ''} ${listing ? `on ${listing.title}` : ''} at POC Premier Lodge, Port O'Connor TX`.trim()
    : `${item.body ? item.body.slice(0, 200) : 'On the water in Port O\'Connor, TX'} #POCPremierLodge #PortOConnor`;
  useEffect(() => {
    if (!open || !item.photos[0] || file) return;
    fetch(item.photos[0]).then((r) => r.blob()).then((b) => setFile(new File([b], 'premier-booking.jpg', { type: b.type || 'image/jpeg' }))).catch(() => {});
  }, [open]);
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: object) => boolean }) : null;
  const canFiles = Boolean(file && nav?.canShare?.({ files: [file] }));

  const shareNative = async (withPhoto: boolean) => {
    setMsg('');
    try {
      if (withPhoto && file && canFiles) await nav!.share({ files: [file], text: `${text} ${url}` } as ShareData);
      else if (nav?.share) await nav.share({ title: 'Premier Booking', text, url });
      else throw new Error('no share');
      setOpen(false);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg('This phone or browser can\'t open the share menu here. Use the buttons below.');
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${text} ${url}`); setMsg('Copied. Paste it into any app.'); } catch { setMsg(url); }
  };
  const save = () => {
    if (!file) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = 'premier-booking.jpg'; a.click();
    setMsg('Saved. Open Instagram and pick it from your photos.');
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.shallows }}>
        <Ionicons name="share-outline" size={18} color={colors.navy} />
        <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 14 }}>Share</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(12,58,82,0.45)', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, width: '100%', maxWidth: 520, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, paddingBottom: 34, gap: 10 }}>
            <Text role="heading" style={{ fontSize: 22, color: colors.navy }}>Share</Text>
            {item.photos.length && Platform.OS === 'web' ? (
              <Button title={file ? 'Share photo (Instagram, Facebook, texts…)' : 'Getting the photo ready…'} disabled={!file} onPress={() => shareNative(true)} />
            ) : null}
            <Button title="Share link" kind={item.photos.length ? 'secondary' : 'primary'} onPress={() => shareNative(false)} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <SmallBtn icon="logo-facebook" label="Facebook" onPress={() => Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)} />
              {file ? <SmallBtn icon="download-outline" label="Save photo" onPress={save} /> : null}
              <SmallBtn icon="link-outline" label="Copy link" onPress={copy} />
            </View>
            {msg ? <Notice>{msg}</Notice> : null}
            <Text style={{ color: colors.muted, fontSize: 13 }}>For Instagram, use "Share photo" and pick Instagram, or save the photo and post it from Instagram.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function SmallBtn({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
      <Ionicons name={icon as never} size={18} color={colors.navy} />
      <Text style={{ color: colors.navy, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// One post or review in the feed.
export function FeedCard({ item, me, isAdmin, onChanged }: { item: FeedItem; me?: string; isAdmin?: boolean; onChanged?: () => void }) {
  const listing = item.listing_id ? catalog.listings.find((l) => l.id === item.listing_id) : null;
  const [busy, setBusy] = useState(false);
  const mine = item.type === 'post' && me && item.author_id === me;
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); onChanged?.(); } finally { setBusy(false); } };
  const badge = item.type === 'post' ? item.author_badge : 'Verified trip';
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius + 4, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10, overflow: 'hidden', opacity: item.hidden ? 0.55 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{item.author_name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 15 }} numberOfLines={1}>
            {item.author_name}{badge ? <Text style={{ color: colors.water, fontWeight: '700', fontSize: 13 }}>{`  ${badge}`}</Text> : null}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
            {timeAgo(item.created_at)}{listing ? ` · ${listing.title}` : ''}{item.hidden ? ' · Hidden' : ''}
          </Text>
        </View>
        {item.type === 'review' ? <Stars value={item.stars} size={16} /> : null}
      </View>
      <PhotoStrip photos={item.photos} />
      {item.body ? <Text style={{ fontSize: 16, lineHeight: 23, color: colors.text }}>{item.body}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ShareButton item={item} />
        {listing ? (
          <Link href={listingPath(listing) as never}><Text style={{ color: colors.water, fontWeight: '700', fontSize: 14 }}>{listing.kind === 'stay' ? 'See the house' : 'See this trip'}</Text></Link>
        ) : null}
        <View style={{ flex: 1 }} />
        {isAdmin ? <Text style={{ color: colors.muted, fontWeight: '700' }} onPress={() => !busy && run(() => setHidden(item.type, item.id, !item.hidden))}>{item.hidden ? 'Show' : 'Hide'}</Text> : null}
        {mine && !isAdmin ? <Text style={{ color: colors.muted, fontWeight: '700' }} onPress={() => !busy && run(() => deletePost(item.id))}>Delete</Text> : null}
      </View>
    </View>
  );
}

// Add up to 6 photos: shows thumbnails with a remove button. Returns shrunk JPEGs ready to upload.
export function PhotoPicker({ value, onChange, max = 6 }: { value: { blob: Blob; url: string }[]; onChange: (v: { blob: Blob; url: string }[]) => void; max?: number }) {
  const [err, setErr] = useState('');
  const latest = useRef(value);
  latest.current = value;
  const add = async () => {
    setErr('');
    const files = await pickImages(max - value.length);
    const out = [...latest.current];
    for (const f of files) {
      try { const blob = await shrink(f); out.push({ blob, url: URL.createObjectURL(blob) }); } catch (e) { setErr((e as Error).message); }
    }
    onChange(out.slice(0, max));
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {value.map((p, i) => (
          <View key={p.url}>
            <Image source={{ uri: p.url }} style={{ width: 84, height: 84, borderRadius: 8, backgroundColor: colors.busy }} />
            <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} accessibilityLabel="Remove photo" hitSlop={6}
              style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ))}
        {value.length < max ? (
          <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Add photos"
            style={{ width: 84, height: 84, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.water, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 2 }}>
            <Ionicons name="camera-outline" size={26} color={colors.water} />
            <Text style={{ fontSize: 12, color: colors.water, fontWeight: '700' }}>Add photos</Text>
          </Pressable>
        ) : null}
      </View>
      {err ? <Notice tone="bad">{err}</Notice> : null}
    </View>
  );
}

// Reviews on a trip or house page: average stars and the latest few.
export function ListingReviews({ listingId }: { listingId: string }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => { reviewsFor(listingId).then(setRows); }, [listingId]);
  if (!rows.length) return null;
  const avg = rows.reduce((a, r) => a + r.stars, 0) / rows.length;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 10 }}>
        <Text role="heading" aria-level={2} style={{ fontSize: 24, color: colors.navy }}>Reviews</Text>
        <Stars value={Math.round(avg)} size={18} />
        <Text style={{ color: colors.muted, fontWeight: '700' }}>{`${avg.toFixed(1)} · ${rows.length} review${rows.length > 1 ? 's' : ''}`}</Text>
      </View>
      <View style={{ gap: 12 }}>
        {(all ? rows : rows.slice(0, 3)).map((r) => <FeedCard key={r.id} item={{ type: 'review', ...r }} />)}
      </View>
      {rows.length > 3 && !all ? <View style={{ marginTop: 10 }}><Button title={`Show all ${rows.length} reviews`} kind="secondary" onPress={() => setAll(true)} /></View> : null}
    </View>
  );
}
