-- Jeu concours FIGHT & Furious x Moteka
-- Meme projet Supabase que le concours Boxing Center (concours.boxingcenter.fr).
-- A executer dans l'editeur SQL Supabase (idempotent).

create extension if not exists pgcrypto;

create table if not exists public.moteka_concours (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  telephone text not null,
  phone_key text not null unique,
  email text not null unique,
  ami_emails text[] not null default '{}',
  avis boolean not null default false,
  tickets integer not null default 1 check (tickets between 1 and 2),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moteka_concours_created_idx
  on public.moteka_concours (created_at desc);

-- RLS activee sans politique : seule la cle service_role (fonctions serverless) peut lire et ecrire.
alter table public.moteka_concours enable row level security;

grant all on public.moteka_concours to service_role;

notify pgrst, 'reload schema';
