import { catalog } from './catalog';
import { addDays } from './format';
import { supabase } from './supabase';
import type { Area, Assignment, BaySystem, Booking, Listing, Notification, Post, Profile, Review, ReviewInfo, TaxForm, Waiver } from './types';
import type { DayMark } from '../components/Calendar';

// Everything that talks to the database lives here. Without a database, reads fall back to the built-in catalog.

export async function liveCatalog(): Promise<{ areas: Area[]; bays: BaySystem[]; listings: Listing[] }> {
  if (!supabase) return catalog;
  const [a, b, l] = await Promise.all([
    supabase.from('areas').select('*').eq('published', true).order('sort'),
    supabase.from('bay_systems').select('*').order('name'),
    supabase.from('listings').select('*').eq('published', true).order('created_at'),
  ]);
  if (a.error || b.error || l.error) return catalog;
  return { areas: a.data as Area[], bays: b.data as BaySystem[], listings: l.data as Listing[] };
}

export async function listingBySlugLive(slug: string): Promise<Listing | null> {
  if (!supabase) return catalog.listings.find((l) => l.slug === slug) ?? null;
  const { data } = await supabase.from('listings').select('*').eq('slug', slug).maybeSingle();
  return (data as Listing) ?? catalog.listings.find((l) => l.slug === slug) ?? null;
}

export async function busyDays(listingId: string, from: string, days = 400): Promise<Record<string, DayMark>> {
  if (!supabase) return {};
  const { data, error } = await supabase.rpc('listing_busy_days', { p_listing: listingId, p_from: from, p_to: addDays(from, days) });
  if (error || !data) return {};
  const out: Record<string, DayMark> = {};
  for (const r of data as { day: string; kind: DayMark }[]) out[r.day] = r.kind;
  return out;
}

export type BookingDraft = Omit<Booking, 'id' | 'status' | 'created_at' | 'host_note' | 'guest_id' | 'group_id'>;

// One request, or a stay plus trips sent together (they share a group id so the host sees them as one trip).
export async function requestBookings(items: BookingDraft[]) {
  if (!supabase) throw new Error('Booking opens once the database is connected.');
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Please sign in first.');
  const group = items.length > 1 ? (globalThis.crypto?.randomUUID?.() ?? null) : null;
  const { error } = await supabase.from('bookings')
    .insert(items.map((b) => ({ ...b, guest_id: u.user!.id, status: 'requested', group_id: group })));
  if (error) throw new Error(error.message);
}

export async function saveMyProfile(patch: Partial<Profile>) {
  const { data: u } = await supabase!.auth.getUser();
  const { error } = await supabase!.from('profiles').update(patch).eq('id', u.user!.id);
  if (error) throw new Error(error.message);
}

export async function customers(): Promise<Profile[]> {
  const { data } = await supabase!.from('profiles').select('*').order('created_at', { ascending: false });
  return (data as Profile[]) ?? [];
}

export async function myBookings(): Promise<(Booking & { listing: Listing | null })[]> {
  if (!supabase) return [];
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from('bookings').select('*, listing:listings(*)').eq('guest_id', u.user.id).order('start_date', { ascending: false });
  return (data as never) ?? [];
}

export async function cancelBooking(id: string) {
  const { error } = await supabase!.from('bookings').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Host side ------------------------------------------------------------------------------

export async function hostListings(): Promise<Listing[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('listings').select('*').order('kind').order('title');
  return (data as Listing[]) ?? [];
}

export async function hostBookings(): Promise<(Booking & { listing: Listing | null })[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('bookings').select('*, listing:listings(*)').order('start_date');
  return (data as never) ?? [];
}

export async function decideBooking(id: string, status: 'accepted' | 'declined', hostNote?: string) {
  const { data: u } = await supabase!.auth.getUser();
  const { error } = await supabase!.from('bookings')
    .update({ status, host_note: hostNote || null, decided_by: u.user?.id, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    if (error.message.includes('bookings_no_overlap')) throw new Error('Those dates overlap a booking you already accepted.');
    throw new Error(error.message);
  }
}

export async function hostCalendar(listingId: string, from: string): Promise<Record<string, DayMark>> {
  const marks = await busyDays(listingId, from);
  const { data } = await supabase!.from('bookings').select('start_date,end_date').eq('listing_id', listingId).eq('status', 'requested');
  for (const b of (data as { start_date: string; end_date: string }[]) ?? []) {
    for (let d = b.start_date; d < (b.end_date > b.start_date ? b.end_date : addDays(b.start_date, 1)); d = addDays(d, 1)) {
      if (!marks[d]) marks[d] = 'requested';
    }
  }
  return marks;
}

export async function toggleBlocked(listingId: string, day: string, blocked: boolean) {
  const q = blocked
    ? supabase!.from('blocked_dates').insert({ listing_id: listingId, day })
    : supabase!.from('blocked_dates').delete().eq('listing_id', listingId).eq('day', day);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function saveListing(l: Partial<Listing> & { id?: string }) {
  const { id, ...rest } = l;
  const res = id
    ? await supabase!.from('listings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    : await supabase!.from('listings').insert(rest).select().single();
  if (res.error) throw new Error(res.error.message);
  return res.data as Listing;
}

export async function hosts(): Promise<Profile[]> {
  const { data } = await supabase!.from('profiles').select('*').in('role', ['admin', 'partner']).order('full_name');
  return (data as Profile[]) ?? [];
}

export async function setRole(id: string, role: Profile['role']) {
  const { error } = await supabase!.from('profiles').update({ role }).eq('id', id);
  if (error) throw new Error(error.message);
}

export type Invite = { code: string; label: string; role: string; used_at: string | null; expires_at: string; created_at: string };
export async function invites(): Promise<Invite[]> {
  const { data } = await supabase!.from('invites').select('*').order('created_at', { ascending: false });
  return (data as Invite[]) ?? [];
}
export async function createInvite(label: string, email?: string) {
  const { data: u } = await supabase!.auth.getUser();
  const { data, error } = await supabase!.from('invites').insert({ label, email: email || null, created_by: u.user?.id }).select().single();
  if (error) throw new Error(error.message);
  return data as Invite;
}
export async function redeemInvite(code: string) {
  const { data, error } = await supabase!.rpc('redeem_invite', { invite_code: code });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function saveArea(a: Partial<Area>) {
  const res = a.id ? await supabase!.from('areas').update(a).eq('id', a.id) : await supabase!.from('areas').insert(a);
  if (res.error) throw new Error(res.error.message);
}
export async function saveBay(b: Partial<BaySystem>) {
  const res = b.id ? await supabase!.from('bay_systems').update(b).eq('id', b.id) : await supabase!.from('bay_systems').insert(b);
  if (res.error) throw new Error(res.error.message);
}
export async function allAreas(): Promise<{ areas: Area[]; bays: BaySystem[] }> {
  const [a, b] = await Promise.all([
    supabase!.from('areas').select('*').order('sort'),
    supabase!.from('bay_systems').select('*').order('name'),
  ]);
  return { areas: (a.data as Area[]) ?? [], bays: (b.data as BaySystem[]) ?? [] };
}

export const slugify = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');


// Team: guides, house owners, staff ------------------------------------------------------
export type PendingMember = { email: string; full_name: string | null; phone: string | null; team_type: Profile['team_type']; worker_type: Profile['worker_type']; created_at: string };

export async function team(): Promise<{ members: Profile[]; waiting: PendingMember[]; forms: TaxForm[] }> {
  const [m, p, f] = await Promise.all([
    supabase!.from('profiles').select('*').in('role', ['admin', 'partner']).order('full_name'),
    supabase!.from('preset_roles').select('*').order('created_at', { ascending: false }),
    supabase!.from('tax_forms').select(TAX_COLS),
  ]);
  const members = (m.data as Profile[]) ?? [];
  const known = new Set(members.map((x) => (x.email ?? '').toLowerCase()));
  const waiting = ((p.data as PendingMember[]) ?? []).filter((x) => !known.has(x.email.toLowerCase()));
  return { members, waiting, forms: (f.data as unknown as TaxForm[]) ?? [] };
}

export async function addTeamMember(m: { email: string; name: string; phone: string; team_type: string; worker_type: string }) {
  const { data, error } = await supabase!.rpc('add_team_member', {
    p_email: m.email, p_name: m.name, p_phone: m.phone, p_team_type: m.team_type, p_worker_type: m.worker_type,
  });
  if (error) throw new Error(error.message);
  return data as boolean; // true when they already had an account
}

export async function profileById(id: string): Promise<Profile | null> {
  const { data } = await supabase!.from('profiles').select('*').eq('id', id).maybeSingle();
  return data as Profile | null;
}

export async function publicTeam(): Promise<Pick<Profile, 'id' | 'full_name' | 'bio' | 'photo_url' | 'team_type'>[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc('public_team');
  return (data as never[]) ?? [];
}

// W-9 -----------------------------------------------------------------------------------
const TAX_COLS = 'profile_id, legal_name, business_name, tax_class, address, city_state_zip, tin_type, tin_last4, signature_name, signed_at';

export async function myTaxForm(userId: string): Promise<TaxForm | null> {
  const { data } = await supabase!.from('tax_forms').select(TAX_COLS).eq('profile_id', userId).maybeSingle();
  return data as unknown as TaxForm | null;
}

export async function saveW9(f: { legal_name: string; business_name: string; tax_class: string; address: string; city_state_zip: string; tin_type: string; tin: string; signature_name: string }) {
  const { data, error } = await supabase!.rpc('save_w9', {
    p_legal_name: f.legal_name, p_business_name: f.business_name, p_tax_class: f.tax_class, p_address: f.address,
    p_city_state_zip: f.city_state_zip, p_tin_type: f.tin_type, p_tin: f.tin, p_signature_name: f.signature_name,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function revealTin(profileId: string) {
  const { data, error } = await supabase!.rpc('reveal_tin', { p_profile: profileId });
  if (error) throw new Error(error.message);
  return data as string | null;
}

// Jobs (booking assignments) --------------------------------------------------------------
export type JobRow = Assignment & { booking: (Booking & { listing: Listing | null }) | null };

export async function assignmentsFor(bookingIds: string[]): Promise<Assignment[]> {
  if (!bookingIds.length) return [];
  const { data } = await supabase!.from('booking_assignments').select('*').in('booking_id', bookingIds);
  return (data as Assignment[]) ?? [];
}

export async function assign(bookingId: string, assigneeId: string, job: string) {
  const { data: u } = await supabase!.auth.getUser();
  const { error } = await supabase!.from('booking_assignments').insert({ booking_id: bookingId, assignee_id: assigneeId, job, assigned_by: u.user?.id });
  if (error) throw new Error(error.message.includes('duplicate') ? 'They are already on this booking.' : error.message);
}

export async function unassign(id: string) {
  const { error } = await supabase!.from('booking_assignments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function jobsFor(userId: string): Promise<JobRow[]> {
  const { data, error } = await supabase!.from('booking_assignments').select('*, booking:bookings(*, listing:listings(*))')
    .eq('assignee_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as JobRow[]) ?? []).filter((j) => j.booking).sort((a, b) => a.booking!.start_date.localeCompare(b.booking!.start_date));
}

export async function respondJob(id: string, accept: boolean, note?: string) {
  const { error } = await supabase!.rpc('respond_assignment', { p_id: id, p_accept: accept, p_note: note || null });
  if (error) throw new Error(error.message);
}

// Notifications ---------------------------------------------------------------------------
export async function myNotifications(limit = 30): Promise<Notification[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data as Notification[]) ?? [];
}

export async function markAllRead() {
  const { error } = await supabase!.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw new Error(error.message);
}

// Waivers -----------------------------------------------------------------------------------
export async function waiverText(): Promise<string> {
  const { data } = await supabase!.from('app_settings').select('value').eq('key', 'waiver_text').maybeSingle();
  return (data?.value as string) ?? '';
}

export async function getSetting(key: string): Promise<string> {
  const { data } = await supabase!.from('app_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as string) ?? '';
}

export async function saveSetting(key: string, value: string) {
  const { error } = await supabase!.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function waiversFor(bookingIds: string[]): Promise<Waiver[]> {
  if (!bookingIds.length) return [];
  const { data } = await supabase!.from('waivers').select('id, booking_id, signer_id, signer_name, minors, signed_at').in('booking_id', bookingIds);
  return (data as Waiver[]) ?? [];
}

export async function signWaiver(bookingId: string, signerName: string, minors: string, text: string) {
  const { data: u } = await supabase!.auth.getUser();
  const { error } = await supabase!.from('waivers').insert({
    booking_id: bookingId, signer_id: u.user?.id, signer_name: signerName, signer_email: u.user?.email, minors: minors || null, waiver_text: text,
  });
  if (error) throw new Error(error.message);
}

export async function bookingById(id: string): Promise<(Booking & { listing: Listing | null }) | null> {
  const { data } = await supabase!.from('bookings').select('*, listing:listings(*)').eq('id', id).maybeSingle();
  return data as (Booking & { listing: Listing | null }) | null;
}

// Guest checkout: no account. The database checks the request and files it with no guest login attached.
export type InquiryItem = Pick<BookingDraft, 'listing_id' | 'start_date' | 'end_date' | 'start_time' | 'guests' | 'notes'>;
export async function guestInquiry(items: InquiryItem[], contact: { name: string; email: string; phone: string; marketingSms?: boolean; marketingEmail?: boolean }) {
  if (!supabase) throw new Error('Booking opens once the database is connected.');
  const base = { p_items: items, p_name: contact.name, p_email: contact.email, p_phone: contact.phone };
  let { error } = await supabase.rpc('guest_inquiry', { ...base, p_marketing_sms: Boolean(contact.marketingSms), p_marketing_email: Boolean(contact.marketingEmail) });
  // Until the opt-in database update is applied, the older version (no opt-in) still takes the request.
  if (error && /could not find|PGRST202/i.test(`${error.code} ${error.message}`)) ({ error } = await supabase.rpc('guest_inquiry', base));
  if (error) throw new Error(error.message);
}

// Specials and check-ins from the admin: who would get it, and sending it.
export async function announcementAudience(): Promise<{ app: number; text: number; email: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('announcement_audience');
  return error ? null : (data as { app: number; text: number; email: number } | null);
}
export async function sendAnnouncement(m: { title: string; body: string; link: string; text: boolean; email: boolean }) {
  const { data, error } = await supabase!.rpc('send_announcement', { p_title: m.title, p_body: m.body, p_link: m.link, p_text: m.text, p_email: m.email });
  if (error) throw new Error(/could not find|PGRST202/i.test(`${error.code} ${error.message}`) ? 'This needs the messages database update first (see the script in your files).' : error.message);
  return data as number;
}

// ---- Community posts and reviews ----

export type FeedItem = ({ type: 'post' } & Post) | ({ type: 'review' } & Review);

export async function communityFeed(limit = 40): Promise<FeedItem[]> {
  if (!supabase) return [];
  const [p, r] = await Promise.all([
    supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(limit),
    supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(limit),
  ]);
  const items: FeedItem[] = [
    ...((p.data ?? []) as Post[]).map((x) => ({ type: 'post' as const, ...x })),
    ...((r.data ?? []) as Review[]).map((x) => ({ type: 'review' as const, ...x })),
  ];
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function feedItem(id: string): Promise<FeedItem | null> {
  if (!supabase) return null;
  const p = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  if (p.data) return { type: 'post', ...(p.data as Post) };
  const r = await supabase.from('reviews').select('*').eq('id', id).maybeSingle();
  return r.data ? { type: 'review', ...(r.data as Review) } : null;
}

export async function createPost(body: string, photos: string[], listingId: string | null) {
  const { data: u } = await supabase!.auth.getUser();
  const { error } = await supabase!.from('posts').insert({ author_id: u.user?.id, body: body.trim(), photos, listing_id: listingId });
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase!.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function setHidden(type: 'post' | 'review', id: string, hidden: boolean) {
  const { error } = await supabase!.from(type === 'post' ? 'posts' : 'reviews').update({ hidden }).eq('id', id);
  if (error) throw error;
}

export async function reviewsFor(listingId: string): Promise<Review[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('reviews').select('*').eq('listing_id', listingId).eq('hidden', false).order('created_at', { ascending: false });
  return (data ?? []) as Review[];
}

export async function reviewInfo(token: string): Promise<ReviewInfo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('review_info', { p_token: token });
  if (error) return null;
  return (data as ReviewInfo) ?? null;
}

export async function submitReview(token: string, r: { stars: number; body: string; photos: string[]; name?: string }) {
  const { data, error } = await supabase!.rpc('submit_review', { p_token: token, p_stars: r.stars, p_body: r.body, p_photos: r.photos, p_name: r.name ?? null });
  if (error) throw error;
  return data as string;
}

// Upload already-shrunk photos to the community bucket under folder (posts/<user id> or reviews/<token>).
export async function uploadPhotos(folder: string, blobs: Blob[]): Promise<string[]> {
  const urls: string[] = [];
  for (const b of blobs) {
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase!.storage.from('community').upload(path, b, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    urls.push(supabase!.storage.from('community').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
