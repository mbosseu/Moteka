-- Jeu concours FIGHT & Furious x Moteka : 6 lots, tirages du lundi 23 au samedi 28 novembre 2026.
-- Ordre = soir du tirage (1 = lundi 23 ... 6 = samedi 28). Idempotent.

alter table public.moteka_tirages drop constraint if exists moteka_tirages_date_tirage_check;
alter table public.moteka_tirages add constraint moteka_tirages_date_tirage_check
  check (date_tirage between date '2026-11-23' and date '2026-11-28');

-- Libere temporairement les ordres pour pouvoir les reattribuer sans conflit d'unicite.
update public.moteka_lots set ordre = ordre + 100 where ordre < 100;

update public.moteka_lots set ordre = 1, nom = 'Vidange offerte',
  description = 'Vidange de votre véhicule offerte par Moteka.', actif = true
  where nom = 'Vidange offerte';
update public.moteka_lots set ordre = 2, nom = 'Nettoyage complet intérieur et extérieur de votre voiture',
  description = 'Nettoyage complet, intérieur et extérieur, de votre voiture chez Moteka.', actif = true
  where nom like 'Nettoyage complet%';
update public.moteka_lots set ordre = 3, nom = 'Géométrie et parallélisme offerts',
  description = 'Contrôle et réglage de la géométrie et du parallélisme offerts par Moteka.', actif = true
  where nom like 'Géométrie%';
update public.moteka_lots set ordre = 4, nom = 'Contrôle complet de votre véhicule',
  description = 'Contrôle complet de votre véhicule à l''atelier Moteka.', actif = true
  where nom like 'Révision complète%' or nom like 'Contrôle complet%';
update public.moteka_lots set ordre = 6, nom = 'Le jeu GTA 6 sur PS5',
  description = 'Lot masterclass : le jeu GTA 6 sur PS5, offert par Moteka. Finale du samedi 28 novembre.', actif = true
  where nom like 'Location 24 h d''une grosse voiture%' or nom like '%GTA%';

insert into public.moteka_lots (ordre, nom, description)
select 5, '24 h de location de la Golf 8 R', 'La Golf 8 R à votre disposition pendant 24 heures, offerte par Moteka.'
where not exists (select 1 from public.moteka_lots where nom like '%Golf 8 R%');
update public.moteka_lots set ordre = 5 where nom like '%Golf 8 R%';

notify pgrst, 'reload schema';
