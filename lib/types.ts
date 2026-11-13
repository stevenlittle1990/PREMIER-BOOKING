export type Kind = 'stay' | 'trip';
export type Category =
  | 'house' | 'fishing' | 'sunset_cruise' | 'beach_cruise' | 'island_tour' | 'bird_watching' | 'hunting' | 'other';

export type Area = { id: string; slug: string; name: string; region: string; description: string; sort: number };
export type BaySystem = { id: string; area_id: string; slug: string; name: string; description: string };

export type Listing = {
  id: string;
  slug: string;
  kind: Kind;
  category: Category;
  title: string;
  summary: string;
  description: string;
  area_id: string;
  bay_system_id: string | null;
  owner_id: string | null;
  photos: string[];
  price_cents: number;
  price_unit: 'night' | 'trip' | 'person';
  max_guests: number;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  min_nights: number;
  duration_hours: number | null;
  start_times: string[];
  amenities: string[];
  species: string[];
  address: string | null;
  meeting_point: string | null;
  published: boolean;
};

export type Booking = {
  id: string;
  listing_id: string;
  guest_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  guests: number;
  total_cents: number;
  status: 'requested' | 'accepted' | 'declined' | 'cancelled';
  notes: string | null;
  host_note: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'partner' | 'guest';
  business_name: string | null;
};

export type Catalog = { areas: Area[]; bays: BaySystem[]; listings: Listing[]; builtAt: string };

export const CATEGORY_LABELS: Record<Category, string> = {
  house: 'House',
  fishing: 'Fishing trip',
  sunset_cruise: 'Sunset cruise',
  beach_cruise: 'Beach cruise',
  island_tour: 'Island tour',
  bird_watching: 'Bird watching',
  hunting: 'Hunting',
  other: 'Experience',
};

export const TRIP_CATEGORIES: Category[] = [
  'fishing', 'sunset_cruise', 'beach_cruise', 'island_tour', 'bird_watching', 'hunting', 'other',
];
