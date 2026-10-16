alter table public.receipts
  add column if not exists receipt_address text,
  add column if not exists merchant_place_id text,
  add column if not exists merchant_photo_lookup_attempted boolean not null default false;
