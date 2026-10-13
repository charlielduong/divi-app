create table if not exists public.receipt_parse_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  divi_id uuid references public.divis(id) on delete set null,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'failed')),
  source_key text not null unique,
  result_key text,
  source_file_name text not null,
  source_content_type text not null,
  parsed_receipt jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists receipt_parse_attempts_user_id_idx
  on public.receipt_parse_attempts(user_id, created_at desc);

alter table public.receipt_parse_attempts enable row level security;

grant select, insert on public.receipt_parse_attempts to authenticated;

create policy "users can view their receipt parse attempts"
on public.receipt_parse_attempts for select to authenticated
using (user_id = auth.uid());

create policy "users can create their receipt parse attempts"
on public.receipt_parse_attempts for insert to authenticated
with check (user_id = auth.uid());

drop trigger if exists receipt_parse_attempts_set_updated_at
  on public.receipt_parse_attempts;
create trigger receipt_parse_attempts_set_updated_at
before update on public.receipt_parse_attempts
for each row execute function public.set_updated_at();
