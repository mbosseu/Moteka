"""Donne à une photo prise en lumière du jour la même ambiance que les photos du gala :
salle sombre, projecteur sur les boxeurs, noirs profonds, couleurs denses, ombres légèrement rouges.
Usage : python -I outils/etalonner-photo.py <source> <sortie> [centre_x centre_y]  (centre du projecteur, en fraction)"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
cx, cy = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (0.5, 0.55)
im = Image.open(src).convert("RGB")
w, h = im.size

# 1) base : plus de contraste, exposition baissée
im = ImageEnhance.Contrast(im).enhance(1.18)
im = ImageEnhance.Brightness(im).enhance(0.82)

# 2) projecteur : une ellipse douce de lumière sur les boxeurs, le reste de la salle plonge dans l'ombre
masque = Image.new("L", (w // 4, h // 4), 0)
ImageDraw.Draw(masque).ellipse([(cx - 0.21) * w / 4, (cy - 0.40) * h / 4, (cx + 0.21) * w / 4, (cy + 0.40) * h / 4], fill=255)
masque = masque.filter(ImageFilter.GaussianBlur(w / 4 * 0.09)).resize((w, h), Image.BICUBIC)
# hors du projecteur, les surfaces claires et peu colorées (mur blanc, bâches) s'éteignent davantage
hsv = im.convert("HSV")
_, sat, val = hsv.split()
neutre_clair = ImageChops.multiply(val.point(lambda v: 255 if v > 120 else int(v * 2.1)), sat.point(lambda s_: 255 - min(255, s_ * 3)))
ombre = ImageEnhance.Brightness(im).enhance(0.24)
ombre = Image.composite(ImageEnhance.Brightness(ombre).enhance(0.45), ombre, neutre_clair)
im = Image.composite(im, ombre, masque)

# 3) courbe : noirs écrasés, hautes lumières préservées
im = im.point(lambda v: int(max(0, min(255, (v - 14) * 1.12))))

# 4) couleurs plus denses, ombres légèrement rouges (comme les éclairages du gala)
im = ImageEnhance.Color(im).enhance(1.18)
lum = im.convert("L")
ombres = lum.point(lambda v: int(max(0, 110 - v) * 1.1))
teinte = Image.new("RGB", (w, h), (70, 6, 12))
im = ImageChops.add(im, ImageChops.multiply(teinte, Image.merge("RGB", [ombres] * 3)))

# 5) vignette et grain fin pour l'aspect « photo de nuit »
vignette = Image.new("L", (w // 8, h // 8), 0)
ImageDraw.Draw(vignette).ellipse([-w // 40, -h // 40, w // 8 + w // 40, h // 8 + h // 40], fill=255)
vignette = vignette.filter(ImageFilter.GaussianBlur(w / 8 * 0.12)).resize((w, h), Image.BICUBIC)
im = Image.composite(im, ImageEnhance.Brightness(im).enhance(0.55), vignette)
grain = Image.effect_noise((w, h), 14).convert("RGB")
im = Image.blend(im, ImageChops.overlay(im, grain), 0.18)

im.thumbnail((1600, 1600))
im.save(dst, quality=86, optimize=True, progressive=True)
print("ok", im.size)
