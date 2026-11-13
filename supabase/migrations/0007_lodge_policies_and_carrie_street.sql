-- Taxes and deposits, policies from the 110 E Monroe short-term rental agreement, and the correct 29 Carrie St name.
alter table public.listings
  add column tax_pct numeric(5,2) not null default 0,
  add column security_deposit_cents int not null default 0,
  add column pets_allowed boolean not null default false,
  add column pet_fee_cents int not null default 0;

update public.listings set
  cleaning_fee_cents = 25000,
  tax_pct = 6,
  security_deposit_cents = 50000,
  pets_allowed = true,
  pet_fee_cents = 15000,
  house_rules = array[
    'Up to 14 guests',
    'Primary guest must be 25 or older (photo ID required)',
    'No smoking, vaping or drugs anywhere on the property',
    'Quiet hours 10 PM to sunrise',
    'Up to 2 pets, 150 lbs max each ($150 refundable pet deposit per pet)',
    'Parking on site',
    'Trash goes in the big cans downstairs; pickup is Tuesday',
    'Lost keys are a $100 replacement fee',
    'Extra cleaning after a party is $150'],
  cancellation_policy = 'Full refund if you cancel within 36 hours of booking and check-in is at least 30 days away. 50% refund if you cancel at least 20 days before check-in. No refund within 20 days of check-in. If weather, an evacuation or damage makes the house unusable, we cancel and refund you.'
where slug = 'poc-premier-lodge';

update public.listings set
  slug = 'carrie-street-house',
  title = 'Carrie Street House',
  summary = 'Brand-new Port O''Connor build with three bathrooms, a balcony and a pool on the way. Coming soon.',
  description = 'Our newest house, built from the ground up on Carrie Street. Quartz counters, a full kitchen, three bathrooms, a balcony, and a fiberglass pool with a fenced deck are part of the plan. Details and dates open when the house is finished.',
  bathrooms = 3,
  address = '29 Carrie St, Port O''Connor, TX 77982',
  amenities = array['Full kitchen','Washer and dryer','Balcony','Pool (coming)'],
  tax_pct = 6
where slug = 'carey-street-house';
