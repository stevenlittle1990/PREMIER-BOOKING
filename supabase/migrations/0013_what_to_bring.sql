-- "What to bring" list for trips, editable by the admin in the listing editor. Starter lists below are drafts.
alter table public.listings add column if not exists what_to_bring text[] not null default '{}';

update public.listings set what_to_bring = array[
  'Texas fishing license with saltwater endorsement (anyone 17 or older)',
  'Polarized sunglasses',
  'Hat and sunscreen',
  'Food and drinks in a soft cooler (no glass)',
  'Rain jacket or a warm layer, depending on the weather',
  'Non-marking shoes',
  'Seasickness medicine if you need it',
  'Ice chest to take your cleaned fish home'
] where kind = 'trip' and category = 'fishing' and what_to_bring = '{}';

update public.listings set what_to_bring = array[
  'Texas fishing license with saltwater endorsement (anyone 17 or older)',
  'Wading boots or shoes that stay on in mud',
  'Quick-dry pants, or waders in cool months',
  'Stingray guards (ask your guide if they have some)',
  'Polarized sunglasses, hat and sunscreen',
  'Food and drinks in a soft cooler (no glass)',
  'Ice chest to take your cleaned fish home'
] where slug = 'wade-fishing-the-flats';

update public.listings set what_to_bring = array[
  'Hat, sunglasses and sunscreen',
  'Light jacket for the ride back',
  'Drinks and snacks (no glass)',
  'Phone or camera for the sunset'
] where category = 'sunset_cruise' and what_to_bring = '{}';

update public.listings set what_to_bring = array[
  'Swimsuit and towel',
  'Hat, sunglasses and reef-safe sunscreen',
  'Water and snacks for the day (no glass)',
  'Sandals or water shoes',
  'Beach chairs or an umbrella if you want them',
  'Bag to carry out your trash (the island has no services)'
] where category in ('beach_cruise', 'island_tour') and what_to_bring = '{}';

update public.listings set what_to_bring = array[
  'Binoculars',
  'Hat, sunglasses and sunscreen',
  'Bug spray',
  'Water and a snack',
  'Camera with a zoom lens if you have one',
  'Closed-toe shoes'
] where category = 'bird_watching' and what_to_bring = '{}';

update public.listings set what_to_bring = array[
  'Hat, sunglasses and sunscreen',
  'Water and snacks (no glass)',
  'A layer for wind on the water'
] where kind = 'trip' and what_to_bring = '{}';
