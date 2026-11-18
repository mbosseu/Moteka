-- Jeu concours FIGHT & Furious x Moteka : lots et tirages du soir (back-office /admin).
-- Un tirage par soir du lundi 23 au samedi 28 novembre 2026 inclus : 6 tirages, 6 lots.
-- Par defaut le soir N (23 nov. = 1 ... 28 nov. = 6) attribue le lot d'ordre N s'il est encore disponible.
-- A executer dans l'editeur SQL Supabase APRES 001_moteka_concours.sql (tables moteka_concours et moteka_tickets).
-- Idempotent : peut etre rejoue sans dupliquer les lots.

create extension if not exists pgcrypto;

-- Lots a gagner, dans l'ordre d'attribution (nom et description modifiables depuis /admin).
-- Le lot 6 (jeu GTA 6, lot masterclass de la finale du samedi) declenche une animation speciale au tirage.
create table if not exists public.moteka_lots (
  id uuid primary key default gen_random_uuid(),
  ordre integer not null unique,
  nom text not null check (char_length(nom) between 1 and 120),
  description text not null default '',
  image_url text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.moteka_lots (ordre, nom, description) values
  (1, 'Vidange offerte', 'Vidange de votre véhicule offerte par Moteka.'),
  (2, 'Nettoyage complet intérieur et extérieur de votre voiture', 'Nettoyage complet, intérieur et extérieur, de votre voiture chez Moteka.'),
  (3, 'Géométrie et parallélisme offerts', 'Contrôle et réglage de la géométrie et du parallélisme offerts par Moteka.'),
  (4, 'Contrôle complet de votre véhicule', 'Contrôle complet de votre véhicule à l''atelier Moteka.'),
  (5, '24 h de location de la Golf 8 R', 'La Golf 8 R à votre disposition pendant 24 heures, offerte par Moteka.'),
  (6, 'Le jeu GTA 6 sur PS5', 'Lot masterclass de la finale du samedi : le jeu GTA 6 sur PS5, offert par Moteka.')
on conflict (ordre) do nothing;

-- Un tirage par soir. Un ticket, un lot et un participant ne peuvent gagner qu'une seule fois.
create table if not exists public.moteka_tirages (
  id uuid primary key default gen_random_uuid(),
  date_tirage date not null unique check (date_tirage between date '2026-11-23' and date '2026-11-28'),
  numero integer not null unique references public.moteka_tickets (numero) on delete restrict,
  participant_id uuid not null unique references public.moteka_concours (id) on delete restrict,
  lot_id uuid not null unique references public.moteka_lots (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Base deja installee avec l'ancienne periode (23-27) : on remplace la contrainte de date (idempotent).
alter table public.moteka_tirages drop constraint if exists moteka_tirages_date_tirage_check;
alter table public.moteka_tirages add constraint moteka_tirages_date_tirage_check
  check (date_tirage between date '2026-11-23' and date '2026-11-28');

-- Coherence : le ticket tire appartient bien au participant enregistre.
create or replace function public.moteka_tirages_verifier()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.moteka_tickets t
    where t.numero = new.numero and t.participant_id = new.participant_id
  ) then
    raise exception 'Le ticket % n''appartient pas au participant %', new.numero, new.participant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists moteka_tirages_verifier on public.moteka_tirages;
create trigger moteka_tirages_verifier
  before insert or update on public.moteka_tirages
  for each row execute function public.moteka_tirages_verifier();

create or replace function public.moteka_lots_horodater()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists moteka_lots_horodater on public.moteka_lots;
create trigger moteka_lots_horodater
  before update on public.moteka_lots
  for each row execute function public.moteka_lots_horodater();

-- RLS activee sans politique : seule la cle service_role (fonctions serverless /api/admin) lit et ecrit.
alter table public.moteka_lots enable row level security;
alter table public.moteka_tirages enable row level security;

grant all on public.moteka_lots to service_role;
grant all on public.moteka_tirages to service_role;

notify pgrst, 'reload schema';
