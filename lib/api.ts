import { catalog } from './catalog';
import { addDays } from './format';
import { supabase } from './supabase';
import type { Area, BaySystem, Booking, Listing, Profile } from './types';
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

export async function requestBooking(b: Omit<Booking, 'id' | 'status' | 'created_at' | 'host_note' | 'guest_id'>) {
  if (!supabase) throw new Error('Booking opens once the database is connected.');
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Please sign in first.');
  const { error } = await supabase.from('bookings').insert({ ...b, guest_id: u.user.id, status: 'requested' });
  if (error) throw new Error(error.message);
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
