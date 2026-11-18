-- Jeu concours FIGHT & Furious x Moteka
-- Meme projet Supabase que le concours Boxing Center (concours.boxingcenter.fr).
-- A executer dans l'editeur SQL Supabase (idempotent).
--
-- moteka_concours : un participant par ligne (telephone et email uniques).
-- moteka_tickets  : un numero de tombola par ticket gagne, sequentiel a partir de 100,
--                   un seul ticket par motif et par participant (inscription, amis, avis).

create extension if not exists pgcrypto;

create table if not exists public.moteka_concours (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  telephone text not null,
  phone_key text not null unique,
  email text not null unique,
  -- ami(e)s invite(e)s : [{ "prenom": "...", "email": "...", "telephone": "..." }, ...]
  amis jsonb not null default '[]'::jsonb check (jsonb_typeof(amis) = 'array'),
  avis boolean not null default false,
  -- nombre de tickets, tenu a jour automatiquement depuis moteka_tickets
  tickets integer not null default 0 check (tickets between 0 and 3),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moteka_concours_created_idx
  on public.moteka_concours (created_at desc);

create sequence if not exists public.moteka_ticket_seq start 100;

create table if not exists public.moteka_tickets (
  numero integer primary key default nextval('public.moteka_ticket_seq'),
  participant_id uuid not null references public.moteka_concours(id) on delete cascade,
  motif text not null check (motif in ('inscription', 'amis', 'avis')),
  created_at timestamptz not null default now(),
  unique (participant_id, motif)
);

alter sequence public.moteka_ticket_seq owned by public.moteka_tickets.numero;

create index if not exists moteka_tickets_participant_idx
  on public.moteka_tickets (participant_id);

-- Garde moteka_concours.tickets egal au nombre de tickets du participant.
create or replace function public.moteka_compter_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cible uuid := coalesce(new.participant_id, old.participant_id);
begin
  update public.moteka_concours c
     set tickets = (select count(*) from public.moteka_tickets t where t.participant_id = cible)
   where c.id = cible;
  return null;
end;
$$;

drop trigger if exists moteka_tickets_compte on public.moteka_tickets;
create trigger moteka_tickets_compte
  after insert or delete on public.moteka_tickets
  for each row execute function public.moteka_compter_tickets();

-- RLS activee sans politique : seule la cle service_role (fonctions serverless) peut lire et ecrire.
alter table public.moteka_concours enable row level security;
alter table public.moteka_tickets enable row level security;

grant all on public.moteka_concours to service_role;
grant all on public.moteka_tickets to service_role;
grant usage, select on sequence public.moteka_ticket_seq to service_role;

notify pgrst, 'reload schema';
