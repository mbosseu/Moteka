"""Corrige l'affiche officielle : « BOXING TROPHY 19 » → « BOXING TROPHY 20 » (outil ponctuel).
Usage : python -I outils/corriger-affiche.py <affiche source> <affiche corrigée>"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")

# 1) zone du « 19 » (mesurée sur l'affiche 1122×1402)
x0, y0, x1, y1 = 523, 1213, 559, 1244
zone = im.crop((x0 - 14, y0 - 10, x1 + 14, y1 + 10))
lum = zone.convert("L")
texte = lum.point(lambda v: 255 if v > 150 else 0).filter(ImageFilter.MaxFilter(5))  # lettres blanches + leur bord
# on ne touche qu'au « 19 » : rien à gauche (le Y de TROPHY), rien au-dessus (le G de BOXING)
limite = Image.new("L", zone.size, 0)
ImageDraw.Draw(limite).rectangle([14 - 1, 10 - 2, zone.width - 6, zone.height - 6], fill=255)
texte = ImageChops.multiply(texte, limite)
# fond reconstitué : on remplit les lettres par diffusion du fond voisin (flous successifs)
fond = zone.copy()
for r in (2, 3, 5, 8, 12, 16):
    flou = fond.filter(ImageFilter.GaussianBlur(r))
    fond = Image.composite(flou, fond, texte)
fond = fond.filter(ImageFilter.GaussianBlur(1))
# léger grain pour que la zone retouchée ne paraisse pas trop lisse
grain = Image.effect_noise(zone.size, 18).convert("RGB")
fond = Image.blend(fond, ImageChops.overlay(fond, grain), 0.25)
nettoye = Image.composite(fond, zone, texte.filter(ImageFilter.GaussianBlur(1.2)))
im.paste(nettoye, (x0 - 14, y0 - 10))

# 2) « 20 » dans une police grasse condensée, inclinée comme le reste du titre
police = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 40)
police.set_variation_by_name("Bold Condensed")
calque = Image.new("L", (120, 70), 0)
ImageDraw.Draw(calque).text((18, 6), "20", font=police, fill=255)
pente = 0.2  # inclinaison italique
calque = calque.transform(calque.size, Image.AFFINE, (1, pente, -pente * 35, 0, 1, 0), Image.BICUBIC)
boite = calque.getbbox()
calque = calque.crop(boite)
hauteur_cible = 27
calque = calque.resize((round(calque.width * hauteur_cible / calque.height), hauteur_cible), Image.LANCZOS)
ombre = calque.filter(ImageFilter.GaussianBlur(2.5))
pos = (x0 + 1, 1215)
im.paste(Image.new("RGB", calque.size, (0, 0, 0)), (pos[0] + 2, pos[1] + 2), ombre.point(lambda v: int(v * 0.55)))
im.paste(Image.new("RGB", calque.size, (246, 246, 246)), pos, calque)
im.save(dst, quality=92, optimize=True, progressive=True)
print("ok", calque.size)
