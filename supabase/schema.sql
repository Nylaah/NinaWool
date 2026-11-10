-- ============================================================================
-- NinaWool — schéma Supabase complet
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Le script peut être relancé sans danger (il est idempotent).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.request_status as enum
    ('nouvelle', 'acceptee', 'en_cours', 'terminee', 'livree', 'payee', 'refusee', 'annulee');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Admin : un seul compte, listé dans cette table
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- Aucune policy : la table n'est lisible que par is_admin() ci-dessous.

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  name text not null,
  email text not null,
  instagram text,
  phone text,
  subject text not null,
  size_cm int not null check (size_cm between 5 and 200),
  details text,
  reference_image_path text,
  proposed_price numeric(10, 2) not null check (proposed_price >= 0),
  boost numeric(10, 2) not null default 0 check (boost >= 0),
  desired_date date,
  status public.request_status not null default 'nouvelle',
  manual_order int,              -- ordre manuel dans la file (null = ordre automatique)
  private_notes text,
  final_price numeric(10, 2) check (final_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_email_day_idx on public.requests (lower(email), created_at);

create table if not exists public.status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  old_status public.request_status,
  new_status public.request_status not null,
  changed_at timestamptz not null default now()
);
create index if not exists status_history_request_idx on public.status_history (request_id);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists work_sessions_request_idx on public.work_sessions (request_id);
-- Un seul chrono actif à la fois, garanti par la base.
create unique index if not exists work_sessions_one_active
  on public.work_sessions ((true)) where ended_at is null;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  description text not null,
  category text not null default 'laine',
  amount numeric(10, 2) not null check (amount >= 0),
  receipt_path text,
  request_id uuid references public.requests (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  size_cm int,
  final_price numeric(10, 2),
  make_minutes int,
  show_time boolean not null default false,
  published boolean not null default false,
  photos text[] not null default '{}',
  request_id uuid references public.requests (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  orders_open boolean not null default true,
  closed_message text not null default 'Les commandes sont en pause pour le moment. Revenez bientôt !',
  max_requests_per_day int not null default 3,
  price_ranges jsonb not null default
    '[{"max_cm":15,"min":15,"max":30},{"max_cm":25,"min":25,"max":50},{"max_cm":40,"min":45,"max":90},{"max_cm":60,"min":80,"max":160}]',
  hourly_goal numeric(10, 2) not null default 10,
  paused_request_id uuid references public.requests (id) on delete set null
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Triggers : updated_at + historique des statuts
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists requests_touch on public.requests;
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();

create or replace function public.log_status_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (request_id, old_status, new_status)
    values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.status_history (request_id, old_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end $$;

drop trigger if exists requests_status_log on public.requests;
create trigger requests_status_log after insert or update of status on public.requests
  for each row execute function public.log_status_change();

-- ---------------------------------------------------------------------------
-- Row Level Security : tout est fermé, sauf pour l'admin.
-- Le public ne passe que par les fonctions RPC plus bas.
-- ---------------------------------------------------------------------------
alter table public.requests enable row level security;
alter table public.status_history enable row level security;
alter table public.work_sessions enable row level security;
alter table public.expenses enable row level security;
alter table public.creations enable row level security;
alter table public.settings enable row level security;

drop policy if exists "admin all" on public.requests;
create policy "admin all" on public.requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.status_history;
create policy "admin all" on public.status_history for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.work_sessions;
create policy "admin all" on public.work_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.expenses;
create policy "admin all" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.creations;
create policy "admin all" on public.creations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read published" on public.creations;
create policy "public read published" on public.creations for select to anon, authenticated
  using (published);

drop policy if exists "admin all" on public.settings;
create policy "admin all" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- File d'attente
-- Ordre : ordre manuel s'il existe, sinon boost décroissant puis date croissante.
-- ---------------------------------------------------------------------------
create or replace function public.queue_positions()
returns table (id uuid, pos bigint)
language sql stable security definer
set search_path = public
as $$
  select r.id,
         row_number() over (order by r.manual_order asc nulls last, r.boost desc, r.created_at asc)
  from public.requests r
  where r.status in ('acceptee', 'en_cours');
$$;
revoke all on function public.queue_positions() from public, anon, authenticated;

-- Enregistre l'ordre manuel après un glisser-déposer (admin).
create or replace function public.set_queue_order(p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.requests r
     set manual_order = o.ord
    from unnest(p_ids) with ordinality as o (id, ord)
   where r.id = o.id;
end $$;

-- Revient à l'ordre automatique (boost puis date).
create or replace function public.reset_queue_order()
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.requests set manual_order = null where manual_order is not null;
end $$;

-- ---------------------------------------------------------------------------
-- RPC publiques
-- ---------------------------------------------------------------------------

-- Réglages visibles par tout le monde (commandes ouvertes ?, fourchettes de prix…)
create or replace function public.get_public_settings()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'orders_open', s.orders_open,
    'closed_message', s.closed_message,
    'price_ranges', s.price_ranges,
    'queue_length', (select count(*) from public.requests where status in ('acceptee', 'en_cours'))
  )
  from public.settings s where s.id = 1;
$$;

-- Dépôt d'une demande. Renvoie le code de suivi.
create or replace function public.submit_request(
  p_name text,
  p_email text,
  p_subject text,
  p_size_cm int,
  p_proposed_price numeric,
  p_payment_ack boolean,
  p_instagram text default null,
  p_phone text default null,
  p_details text default null,
  p_reference_image_path text default null,
  p_boost numeric default 0,
  p_desired_date date default null,
  p_website text default null          -- honeypot : doit rester vide
)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_settings public.settings;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  i int;
begin
  -- Honeypot : un robot a rempli le champ caché. On fait semblant que tout va bien.
  if coalesce(trim(p_website), '') <> '' then
    return 'NW-00000';
  end if;

  select * into v_settings from public.settings where id = 1;
  if not v_settings.orders_open then
    raise exception 'ORDERS_CLOSED';
  end if;

  if p_payment_ack is not true then raise exception 'PAYMENT_ACK_REQUIRED'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'INVALID_NAME'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'INVALID_EMAIL'; end if;
  if length(trim(coalesce(p_subject, ''))) not between 1 and 200 then raise exception 'INVALID_SUBJECT'; end if;
  if p_size_cm is null or p_size_cm not between 5 and 200 then raise exception 'INVALID_SIZE'; end if;
  if p_proposed_price is null or p_proposed_price < 0 or p_proposed_price > 100000 then raise exception 'INVALID_PRICE'; end if;
  if coalesce(p_boost, 0) < 0 or coalesce(p_boost, 0) > 100000 then raise exception 'INVALID_BOOST'; end if;
  if length(coalesce(p_details, '')) > 4000 then raise exception 'DETAILS_TOO_LONG'; end if;
  if length(coalesce(p_instagram, '')) > 100 or length(coalesce(p_phone, '')) > 40 then raise exception 'INVALID_CONTACT'; end if;
  if p_reference_image_path is not null
     and p_reference_image_path !~ '^[0-9a-f-]{36}\.(jpg|png|webp)$' then
    raise exception 'INVALID_IMAGE';
  end if;

  -- Limite par email et par jour
  if (select count(*) from public.requests
       where lower(email) = v_email and created_at > now() - interval '24 hours')
     >= v_settings.max_requests_per_day then
    raise exception 'RATE_LIMIT';
  end if;
  -- Garde-fou global contre une inondation de demandes
  if (select count(*) from public.requests where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  -- Code de suivi unique : NW- + 5 caractères sans ambiguïté (pas de 0/O/1/I)
  loop
    v_bytes := gen_random_bytes(5);
    v_code := 'NW-';
    for i in 0..4 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.requests where tracking_code = v_code);
  end loop;

  insert into public.requests
    (tracking_code, name, email, instagram, phone, subject, size_cm, details,
     reference_image_path, proposed_price, boost, desired_date)
  values
    (v_code, trim(p_name), v_email, nullif(trim(p_instagram), ''), nullif(trim(p_phone), ''),
     trim(p_subject), p_size_cm, nullif(trim(p_details), ''),
     p_reference_image_path, round(p_proposed_price, 2), round(coalesce(p_boost, 0), 2), p_desired_date);

  return v_code;
end $$;

-- Suivi : ne renvoie que les infos non personnelles de LA demande correspondant au code.
create or replace function public.get_request_status(p_code text)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'tracking_code', r.tracking_code,
    'status', r.status,
    'subject', r.subject,
    'size_cm', r.size_cm,
    'boost', r.boost,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'position', (select q.pos from public.queue_positions() q where q.id = r.id),
    'queue_length', (select count(*) from public.requests where status in ('acceptee', 'en_cours'))
  )
  from public.requests r
  where r.tracking_code = upper(trim(p_code));
$$;

-- ---------------------------------------------------------------------------
-- Chronomètre (admin). Les heures viennent du serveur : aucun souci d'horloge.
-- ---------------------------------------------------------------------------
create or replace function public.start_timer(p_request_id uuid)
returns public.work_sessions
language plpgsql
set search_path = public
as $$
declare
  v_session public.work_sessions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.work_sessions set ended_at = now() where ended_at is null;
  update public.requests set status = 'en_cours' where id = p_request_id and status = 'acceptee';
  update public.settings set paused_request_id = null where id = 1;
  insert into public.work_sessions (request_id) values (p_request_id) returning * into v_session;
  return v_session;
end $$;

-- p_pause = true  : met en pause (le projet reste « épinglé » dans le widget)
-- p_pause = false : arrête complètement
create or replace function public.stop_timer(p_pause boolean default false)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_request uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.work_sessions set ended_at = now() where ended_at is null
    returning request_id into v_request;
  if p_pause then
    if v_request is not null then
      update public.settings set paused_request_id = v_request where id = 1;
    end if;
  else
    update public.settings set paused_request_id = null where id = 1;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution des fonctions
-- ---------------------------------------------------------------------------
revoke all on function public.set_queue_order(uuid[]) from public, anon;
revoke all on function public.reset_queue_order() from public, anon;
revoke all on function public.start_timer(uuid) from public, anon;
revoke all on function public.stop_timer(boolean) from public, anon;
grant execute on function public.set_queue_order(uuid[]) to authenticated;
grant execute on function public.reset_queue_order() to authenticated;
grant execute on function public.start_timer(uuid) to authenticated;
grant execute on function public.stop_timer(boolean) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;
grant execute on function public.get_request_status(text) to anon, authenticated;
grant execute on function public.submit_request(text, text, text, int, numeric, boolean, text, text, text, text, numeric, date, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage : 3 buckets
--   references : images envoyées par les clients (privé, 5 Mo, jpg/png/webp)
--   creations  : photos de la galerie (public en lecture)
--   receipts   : tickets de caisse (privé)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('references', 'references', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('creations', 'creations', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Les clients peuvent déposer une image de référence, mais jamais lire ni lister.
drop policy if exists "ninawool references upload" on storage.objects;
create policy "ninawool references upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'references');

drop policy if exists "ninawool admin all" on storage.objects;
create policy "ninawool admin all" on storage.objects for all to authenticated
  using (bucket_id in ('references', 'creations', 'receipts') and public.is_admin())
  with check (bucket_id in ('references', 'creations', 'receipts') and public.is_admin());

-- ============================================================================
-- DERNIÈRE ÉTAPE (à faire une seule fois, après avoir créé ton compte dans
-- Authentication > Users) : déclare-toi admin en remplaçant l'email ci-dessous.
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'ton-email@exemple.com';
-- ============================================================================
