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
  highlights: string[];
  rooms: { name: string; beds: string }[];
  house_rules: string[];
  check_in_time: string | null;
  check_out_time: string | null;
  cleaning_fee_cents: number;
  cancellation_policy: string;
  tax_pct: number;
  security_deposit_cents: number;
  pets_allowed: boolean;
  pet_fee_cents: number;
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
  group_id: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'partner' | 'guest';
  business_name: string | null;
  home_city: string | null;
  marketing_email: boolean;
  marketing_sms: boolean;
  marketing_email_at: string | null;
  marketing_sms_at: string | null;
  last_booking_at: string | null;
  created_at: string;
  team_type: 'guide' | 'house_owner' | 'staff' | null;
  worker_type: 'employee' | 'subcontractor' | null;
  bio: string | null;
  photo_url: string | null;
  guide_license: string | null;
  captain_license: string | null;
  boat: string | null;
  emergency_contact: string | null;
  onboarded_at: string | null;
};

export const TEAM_TYPES = { guide: 'Guide', house_owner: 'House owner', staff: 'Staff' } as const;
export const WORKER_TYPES = { employee: 'Employee', subcontractor: 'Subcontractor' } as const;

export type Assignment = {
  id: string;
  booking_id: string;
  assignee_id: string;
  job: string;
  status: 'pending' | 'accepted' | 'declined';
  note: string | null;
  responded_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  booking_id: string | null;
  read_at: string | null;
  created_at: string;
  send_error: string | null;
};

export type TaxForm = {
  profile_id: string;
  legal_name: string;
  business_name: string | null;
  tax_class: string;
  address: string;
  city_state_zip: string;
  tin_type: 'ssn' | 'ein';
  tin_last4: string;
  signature_name: string;
  signed_at: string;
};

export type Waiver = { id: string; booking_id: string; signer_id: string | null; signer_name: string; minors: string | null; signed_at: string };

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
