-- Divi MVP schema.
-- Monetary values are stored as integer minor units (for example, cents).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  phone_number text,
  venmo_username text,
  default_currency_code text not null default 'USD'
    check (default_currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.divis (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  payer_id uuid references public.profiles(id),
  title text not null,
  receipt_date date,
  state text not null default 'draft'
    check (state in ('draft', 'claiming', 'finalized', 'settled')),
  currency_code text not null default 'USD'
    check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.divi_participants (
  id uuid primary key default gen_random_uuid(),
  divi_id uuid not null references public.divis(id) on delete cascade,
  user_id uuid references public.profiles(id),
  display_name text not null,
  phone_number text,
  venmo_username text,
  joined_at timestamptz not null default now(),
  unique (id, divi_id)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  divi_id uuid not null unique references public.divis(id) on delete cascade,
  image_uri text,
  merchant_name text,
  receipt_date date,
  tax_minor_units bigint not null default 0,
  tip_minor_units bigint not null default 0,
  entered_total_minor_units bigint not null,
  created_at timestamptz not null default now(),
  check (tax_minor_units >= 0),
  check (tip_minor_units >= 0),
  check (entered_total_minor_units >= 0),
  unique (id, divi_id)
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  divi_id uuid not null references public.divis(id) on delete cascade,
  receipt_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  name text not null,
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  amount_minor_units bigint not null check (amount_minor_units >= 0),
  created_at timestamptz not null default now(),
  foreign key (receipt_id, divi_id) references public.receipts(id, divi_id) on delete cascade,
  unique (id, divi_id)
);

create table if not exists public.receipt_adjustments (
  id uuid primary key default gen_random_uuid(),
  divi_id uuid not null references public.divis(id) on delete cascade,
  receipt_id uuid not null,
  kind text not null check (kind in ('fee', 'discount')),
  name text not null,
  amount_minor_units bigint not null check (amount_minor_units >= 0),
  created_at timestamptz not null default now(),
  foreign key (receipt_id, divi_id) references public.receipts(id, divi_id) on delete cascade
);

create table if not exists public.item_claims (
  item_id uuid not null,
  divi_id uuid not null references public.divis(id) on delete cascade,
  participant_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (item_id, participant_id),
  foreign key (item_id, divi_id) references public.receipt_items(id, divi_id) on delete cascade,
  foreign key (participant_id, divi_id)
    references public.divi_participants(id, divi_id) on delete cascade
);

create table if not exists public.divi_allocations (
  id uuid primary key default gen_random_uuid(),
  divi_id uuid not null references public.divis(id) on delete cascade,
  participant_id uuid not null,
  items_minor_units bigint not null default 0 check (items_minor_units >= 0),
  tax_minor_units bigint not null default 0 check (tax_minor_units >= 0),
  tip_minor_units bigint not null default 0 check (tip_minor_units >= 0),
  fees_minor_units bigint not null default 0 check (fees_minor_units >= 0),
  discounts_minor_units bigint not null default 0 check (discounts_minor_units >= 0),
  total_minor_units bigint not null check (total_minor_units >= 0),
  paid_minor_units bigint not null default 0 check (paid_minor_units >= 0),
  request_initiated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (divi_id, participant_id),
  foreign key (participant_id, divi_id)
    references public.divi_participants(id, divi_id) on delete cascade
);

create index if not exists divis_creator_id_idx on public.divis(creator_id);
create index if not exists divi_participants_divi_id_idx on public.divi_participants(divi_id);
create index if not exists divi_participants_user_id_idx on public.divi_participants(user_id);
create index if not exists receipt_items_divi_id_idx on public.receipt_items(divi_id, sort_order);
create index if not exists item_claims_divi_id_idx on public.item_claims(divi_id);
create index if not exists divi_allocations_divi_id_idx on public.divi_allocations(divi_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists divis_set_updated_at on public.divis;
create trigger divis_set_updated_at
before update on public.divis
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, 'Divi user'), '@', 1), ''),
      'Divi user'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- These security-definer helpers avoid recursive RLS evaluation when a policy
-- checks membership in another table.
create or replace function public.can_access_divi(target_divi_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.divis d
    where d.id = target_divi_id
      and (
        d.creator_id = auth.uid()
        or exists (
          select 1
          from public.divi_participants p
          where p.divi_id = d.id and p.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_manage_divi(target_divi_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.divis d
    where d.id = target_divi_id and d.creator_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.divis enable row level security;
alter table public.divi_participants enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.receipt_adjustments enable row level security;
alter table public.item_claims enable row level security;
alter table public.divi_allocations enable row level security;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.divis to authenticated;
grant select, insert, update, delete on public.divi_participants to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;
grant select, insert, update, delete on public.receipt_items to authenticated;
grant select, insert, update, delete on public.receipt_adjustments to authenticated;
grant select, insert, update, delete on public.item_claims to authenticated;
grant select on public.divi_allocations to authenticated;

create policy "users can view their profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "users can update their profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "divi members can view divis"
on public.divis for select to authenticated
using (public.can_access_divi(id));

create policy "users can create their own divis"
on public.divis for insert to authenticated
with check (creator_id = auth.uid());

create policy "divi creators can update divis"
on public.divis for update to authenticated
using (public.can_manage_divi(id))
with check (public.can_manage_divi(id));

create policy "divi creators can delete divis"
on public.divis for delete to authenticated
using (public.can_manage_divi(id));

create policy "divi members can view participants"
on public.divi_participants for select to authenticated
using (public.can_access_divi(divi_id));

create policy "divi creators can manage participants"
on public.divi_participants for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));

create policy "divi members can view receipts"
on public.receipts for select to authenticated
using (public.can_access_divi(divi_id));

create policy "divi creators can manage receipts"
on public.receipts for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));

create policy "divi members can view receipt items"
on public.receipt_items for select to authenticated
using (public.can_access_divi(divi_id));

create policy "divi creators can manage receipt items"
on public.receipt_items for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));

create policy "divi members can view receipt adjustments"
on public.receipt_adjustments for select to authenticated
using (public.can_access_divi(divi_id));

create policy "divi creators can manage receipt adjustments"
on public.receipt_adjustments for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));

create policy "divi members can view item claims"
on public.item_claims for select to authenticated
using (public.can_access_divi(divi_id));

create policy "divi creators can manage item claims"
on public.item_claims for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));

create policy "divi members can view allocations"
on public.divi_allocations for select to authenticated
using (public.can_access_divi(divi_id));
