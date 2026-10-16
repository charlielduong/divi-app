alter table public.receipts
  drop column if exists merchant_place_id,
  drop column if exists merchant_photo_lookup_attempted;
