# SPEC — « 6 soirs, 6 vitesses » (jeu concours FIGHT & Furious × Moteka)

GOAL:    le spectateur a envie de s'inscrire tout de suite au jeu gratuit (jusqu'à 3 tickets, 6 lots, 23–28 nov.).
OUTPUT:  HyperFrames, 1080 × 1920 (9:16, stories/reels), 30 fps.
TIME:    41,5 s × 30 = 1245 images. La voix off est l'horloge (10 lignes, Henri neuronal, assets/voice/voix.json).
         Musique : Bandolero (90 bpm, 1 temps = 0,667 s), lit à 0,18 sous la voix, remonte à 0,6 sur la carte de fin.

LOOK:    sol = vraies photos d'atelier (logo MOTEKA sur les tenues) recadrées en vertical + dégradé noir 0→85 % haut/bas ;
         mondes à couleur pleine : rouge Moteka #d11414 (Golf, tickets), noir #0a0a0b + rouge (finale, roulette).
         encre #f4f2ef ; accent #ff2a2a réservé à l'aiguille, la zone rouge, le jour du lot, le bouton final.
         titres League Gothic, capitales, 150–520 px, interlettrage 0 ; étiquettes Inter 700, 34–40 px, capitales, +0,18 em.
         matière : le compte-tours du site (arc 240°, graduations 0–9, zone rouge 7–9), papier de tombola crème perforé,
         les trois bandes obliques du logo MOTEKA comme seul motif graphique.
OBJECTS: compte-tours (cadran sombre, graduations blanches, chiffres, zone rouge, aiguille rouge, moyeu avec le rapport engagé) ;
         tickets de tombola (papier crème, souche perforée, « N° 100 ») ; roulette (12 secteurs rouge/noir/crème numérotés 100–111,
         index en haut) ; ticket à gratter (zone argent qui se gratte) ; logos Boxing Center et MOTEKA (fichiers officiels).
MOTION:  entrée des titres = essuyage clip-path 0,22 s expo.out + décalage x 40→0 ; impact = échelle 1,25→1 en 0,18 s back.out(2) ;
         passage de vitesse = coupe sèche du fond + chiffre 1,35→1 + éclair du cadran 0,12 s + aiguille qui retombe puis remonte ;
         caméra = secousse ±12 px 0,3 s sur l'impact GTA 6 uniquement ; tickets = chute rotation −14°→−3°, back.out(1.6), 0,45 s.
SHOTS:
  0,0–5,6   compte-tours sur l'atelier ; « DU 23 AU 28 NOV. » à l'image 0 ; aiguille 0→7 000 (moteur) ;
            « 6 SOIRS. » à 1,86 · « 6 LOTS. » à 3,24 · « UN SEUL MOTEUR. » à 4,51 (impact). → coupe sur la 1re.
  5,6–14,9  1re à 4e : à chaque passage (5,60 · 7,70 · 10,50 · 12,65) clac de boîte, nouveau fond, jour + lot :
            LUNDI 23 VIDANGE OFFERTE · MARDI 24 NETTOYAGE COMPLET · MERCREDI 25 GÉOMÉTRIE & PARALLÉLISME · JEUDI 26 CONTRÔLE COMPLET.
  14,9–20,95 monde rouge, bandes MOTEKA qui balaient (whoosh) ; cadran réduit en haut ; 5e à 16,15 ;
            « 24 H » à 17,45 · « GOLF 8 R » à 18,51 · « 320 CH » compté 0→320 à 19,98.
  20,95–25,45 finale : régime dans le rouge (moteur), 6e à 22,02 + éclair rouge plein cadre ; « SAMEDI 28 · LA FINALE » ;
            « GTA 6 » à 23,31 (montée + impact, secousse) ; « SUR PS5 » à 24,59.
  25,45–30,75 monde rouge : « C'EST GRATUIT. » à 25,71 → « JUSQU'À 3 TICKETS » à 27,26 ; tickets N° 100/101/102
            tombent à 27,99 (inscription) · 28,78 (2 ami(e)s) · 29,97 (avis Google).
  30,75–35,95 roulette : « CHAQUE SOIR, EN STORY » à 31,69 ; elle tourne et s'arrête sur 104 à 33,45 ;
            ticket à gratter qui monte, grattage à 33,92 ; « CE SOIR, C'EST PEUT-ÊTRE TON NUMÉRO. » à 35,25.
  35,95–41,5 fin : bandes MOTEKA qui portent le titre FIGHT & FURIOUS (gong à 36,0) ; « JEU GRATUIT · 23–28 NOV. » ;
            bouton « JOUE MAINTENANT » à 38,0 ; adresse fight-and-furious.boxingcenter.fr ; logos Boxing Center × MOTEKA ; tenue 3 s.
BANNED:  vide noir avec petits éléments flottants ; glow, néon, particules ; dégradés violets/bleus ; tout centré-fondu-glissé vers le haut ;
         titres qui dérivent après leur arrivée ; logo en coin ; trois cartes en ligne ; logos Volkswagen / Rockstar / PlayStation
         (les lots sont nommés en texte seulement) ; toute affirmation absente du règlement.
QA:      0,0 (vignette lisible) · 1,9 · 6,9 · 8,4 · 11,4 · 13,4 · 17,6 · 20,2 · 23,4 · 26,0 · 30,1 · 33,5 · 35,4 · 38,3 · 41,0 ;
         chaque texte entre 168 et 1330 px de haut, ≥ 28 px, lisible sans le son.
