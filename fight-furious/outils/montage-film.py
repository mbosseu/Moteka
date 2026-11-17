"""Montage du film FIGHT & Furious (outil de production, non chargé par le site).

Plan 1 : vraie vidéo (Flora / Kling).  Plans 2 et 3 : images clés animées ici
(poussée de caméra, faisceaux de projecteurs, fumée, flashs du public, grain).
Transitions : les trois bandes rouges du logo Moteka.  Fin : carton logos + titre.

Sorties : film-fight-furious.mp4 (avec bandes cinéma et carton final)
          heros-film.mp4 (boucle sans fin, pour l'en-tête du site)
Usage : python -I outils/montage-film.py <dossier fight-furious>
"""
import math, os, random, shutil, subprocess, sys
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

RACINE = sys.argv[1]
FILM = os.path.join(RACINE, "affiche", "flora", "film")
TMP = os.path.join(FILM, "_images")
W, H, FPS = 1920, 1080, 24
random.seed(7)

def ease(t):  # douceur cinéma
    return 0.5 - 0.5 * math.cos(math.pi * max(0, min(1, t)))

# ---------- calques communs ----------
def vignette():
    v = Image.new("L", (W // 8, H // 8), 0)
    d = ImageDraw.Draw(v)
    for i in range(60):
        k = i / 60
        d.ellipse([-W // 16 + k * W // 10, -H // 16 + k * H // 10, W // 8 + W // 16 - k * W // 10, H // 8 + H // 16 - k * H // 10], fill=int(255 * min(1, 0.55 + k)))
    return v.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(40))

VIGNETTE = vignette()
FUMEE = Image.effect_noise((260, 150), 90).resize((W * 2, H * 2), Image.BICUBIC).filter(ImageFilter.GaussianBlur(28))
FUMEE = ImageEnhance.Contrast(FUMEE).enhance(1.6)

def faisceau():
    # cône dessiné avec une marge : il s'estompe avant les bords du calque (pas d'arête nette)
    f = Image.new("L", (900, 1400), 0)
    ImageDraw.Draw(f).polygon([(437, 0), (463, 0), (720, 1150), (180, 1150)], fill=255)
    f = f.filter(ImageFilter.GaussianBlur(38))
    fondu = Image.linear_gradient("L").resize((900, 1400)).point(lambda v: 255 - v)
    return ImageChops.multiply(f, fondu)

FAISCEAU = faisceau()

def finition(img, i, grain=0.055):
    """Étalonnage commun : vignette, grain argentique, légère désaturation."""
    img = ImageEnhance.Color(img).enhance(0.93)
    img = Image.composite(img, Image.new("RGB", (W, H), (0, 0, 0)), VIGNETTE)
    g = Image.effect_noise((W // 2, H // 2), 40 + (i % 3) * 4).resize((W, H)).convert("RGB")
    return Image.blend(img, ImageChops.overlay(img, g), grain * 6)

def ajoute(img, calque_l, couleur, force):
    teinte = Image.new("RGB", (W, H), couleur)
    return ImageChops.add(img, ImageChops.multiply(teinte, Image.merge("RGB", [calque_l.point(lambda v: int(v * force))] * 3)))

def poussee(src, p, z0, z1, c0, c1):
    """Cadre dans l'image source (2752×1536) avec zoom et centre interpolés, au sous-pixel."""
    sw, sh = src.size
    z = z0 + (z1 - z0) * ease(p)
    cx = (c0[0] + (c1[0] - c0[0]) * ease(p)) * sw
    cy = (c0[1] + (c1[1] - c0[1]) * ease(p)) * sh
    bw, bh = sw / z, sw / z * H / W
    x0 = min(max(cx - bw / 2, 0), sw - bw)
    y0 = min(max(cy - bh / 2, 0), sh - bh)
    return src.transform((W, H), Image.EXTENT, (x0, y0, x0 + bw, y0 + bh), Image.BICUBIC)

def effets_arene(img, i, n, flashs=8, faisceaux=True):
    t = i / FPS
    if faisceaux:
        for k, (x, vit, ph) in enumerate([(0.3, 0.9, 0), (0.5, 0.7, 2), (0.72, 1.1, 4)]):
            a = 14 * math.sin(t * vit + ph)
            f = FAISCEAU.rotate(a, resample=Image.BICUBIC, center=(450, 0), expand=False)
            calque = Image.new("L", (W, H), 0)
            calque.paste(f, (int(x * W) - 450, -60))
            img = ajoute(img, calque, (255, 245, 235), 0.16)
    ox = int((t * 38) % W)
    fumee = FUMEE.crop((ox, 200, ox + W, 200 + H))
    img = Image.blend(img, ImageChops.screen(img, fumee.convert("RGB")), 0.12)
    calque = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(calque)
    rnd = random.Random(i * 31)
    for _ in range(flashs):
        if rnd.random() < 0.35:
            x, y, r = rnd.uniform(0.04, 0.96) * W, rnd.uniform(0.48, 0.8) * H, rnd.uniform(3, 7)
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    img = ajoute(img, calque.filter(ImageFilter.GaussianBlur(4)), (255, 255, 255), 0.9)
    return ImageEnhance.Brightness(img).enhance(1 + 0.035 * math.sin(t * 9.0))

# ---------- transitions : les trois bandes Moteka ----------
BANDES = [((255, 35, 35), 0.42), ((209, 20, 20), 0.40), ((150, 8, 8), 0.62)]
PENTE = H * 0.62

def bandes(img, q):
    """q de 0 à 1 : les bandes traversent l'écran de gauche à droite (écran couvert vers q = 0,5)."""
    d = ImageDraw.Draw(img)
    total = sum(l for _, l in BANDES) * W + PENTE
    x = -total + q * (W + total + PENTE)
    for couleur, l in BANDES:
        w = l * W
        d.polygon([(x + PENTE, 0), (x + PENTE + w, 0), (x + w, H), (x, H)], fill=couleur)
        x += w + 0.012 * W
    return img

# ---------- carton final ----------
def police(taille, style="Bold Condensed"):
    f = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", taille)
    f.set_variation_by_name(style)
    return f

def texte_espace(d, xy, txt, f, couleur, espace, centre=True):
    largeurs = [d.textlength(c, font=f) for c in txt]
    total = sum(largeurs) + espace * (len(txt) - 1)
    x, y = (xy[0] - total / 2 if centre else xy[0]), xy[1]
    for c, l in zip(txt, largeurs):
        d.text((x, y), c, font=f, fill=couleur)
        x += l + espace

def carton(i, n):
    p = i / (n - 1)
    img = Image.new("RGB", (W, H), (6, 6, 7))
    lueur = Image.new("L", (W, H), 0)
    ImageDraw.Draw(lueur).ellipse([W * 0.2, H * 0.55, W * 0.8, H * 1.4], fill=255)
    img = ajoute(img, lueur.filter(ImageFilter.GaussianBlur(160)), (209, 20, 20), 0.45 * ease(p * 2))
    d = ImageDraw.Draw(img)
    a = ease(p * 2.2)
    esp = 40 * (1 - ease(p * 1.6)) + 4
    titre = police(170)
    texte_espace(d, (W / 2, 250), "FIGHT &", titre, tuple(int(c * a) for c in (244, 242, 239)), esp)
    texte_espace(d, (W / 2, 420), "FURIOUS", titre, tuple(int(c * a) for c in (255, 35, 35)), esp)
    b = ease((p - 0.25) * 2.5)
    texte_espace(d, (W / 2, 630), "11 — 13 DÉCEMBRE 2026 · TOULOUSE", police(40, "SemiBold Condensed"), tuple(int(c * b) for c in (200, 198, 194)), 6)
    c = ease((p - 0.4) * 2.5)
    if c > 0:
        moteka = Image.open(os.path.join(RACINE, "assets/logo/moteka-fond-noir.jpg")).convert("RGB").crop((90, 300, 940, 730))
        moteka = moteka.resize((int(moteka.width * 0.27), int(moteka.height * 0.27)), Image.LANCZOS)
        moteka = moteka.point(lambda v: 0 if v < 40 else v)  # fond gris du fichier → noir pur, plus de rectangle
        bc = Image.open(os.path.join(RACINE, "assets/logo/boxing-center.png")).convert("RGBA")
        bc = bc.resize((int(bc.width * 1.1), int(bc.height * 1.1)), Image.LANCZOS)
        y = 730
        x_bc = W // 2 - 50 - bc.width
        couche = Image.new("RGB", (W, H), (0, 0, 0))
        couche.paste(bc.convert("RGB"), (x_bc, y), bc)
        couche.paste(moteka, (W // 2 + 50, y + bc.height // 2 - moteka.height // 2))
        ImageDraw.Draw(couche).text((W // 2 - 10, y + bc.height // 2 - 30), "×", font=police(48, "Regular"), fill=(120, 120, 120))
        img = ImageChops.lighter(img, ImageEnhance.Brightness(couche).enhance(c))
    return img

# ---------- rendu ----------
def main():
    if os.path.isdir(TMP):
        shutil.rmtree(TMP)
    os.makedirs(os.path.join(TMP, "p1"))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.15", "-t", "4.6", "-i", os.path.join(FILM, "plan-1-voiture.mp4"),
                    "-vf", f"scale={W}:{H}:flags=lanczos", "-q:v", "2", os.path.join(TMP, "p1", "%04d.jpg")], check=True)
    p1 = sorted(os.listdir(os.path.join(TMP, "p1")))
    arene = Image.open(os.path.join(FILM, "cle-2-arene.png")).convert("RGB")
    boxeur = Image.open(os.path.join(FILM, "cle-3b-boxeur.png")).convert("RGB")

    N2, N3, NC, NT = int(3.2 * FPS), int(3.8 * FPS), int(3.2 * FPS), 12
    plans = []  # (nom, fonction qui rend l'image k)
    plans.append(("voiture", len(p1), lambda k: Image.open(os.path.join(TMP, "p1", p1[k])).convert("RGB")))
    plans.append(("arene", N2, lambda k: effets_arene(poussee(arene, k / (N2 - 1), 1.0, 1.18, (0.5, 0.55), (0.47, 0.58)), k, N2)))
    plans.append(("boxeur", N3, lambda k: effets_arene(poussee(boxeur, k / (N3 - 1), 1.05, 1.42, (0.5, 0.5), (0.55, 0.42)), k, N3, flashs=12, faisceaux=False)))

    images = []  # chaque image du film sans carton
    for nom, n, rendu in plans:
        for k in range(n):
            images.append((nom, k, n, rendu))
    debuts = {}
    pos = 0
    for nom, n, _ in plans:
        debuts[nom] = pos
        pos += n

    def ecrire(dossier, liste, bandes_aux, flash_aux, avec_carton, fondu_debut):
        os.makedirs(dossier, exist_ok=True)
        idx = 0
        for j, (nom, k, n, rendu) in enumerate(liste):
            img = finition(rendu(k), j)
            for centre in bandes_aux:  # transition centrée sur l'image « centre »
                q = (j - centre) / NT + 0.5
                if 0 <= q <= 1:
                    img = bandes(img, q)
            for f0 in flash_aux:
                if 0 <= j - f0 < 5:
                    img = Image.blend(img, Image.new("RGB", (W, H), (255, 250, 245)), 0.55 * (1 - (j - f0) / 5))
            if fondu_debut and j < 10:
                img = Image.blend(Image.new("RGB", (W, H)), img, j / 10)
            img.save(os.path.join(dossier, f"{idx:04d}.jpg"), quality=94)
            idx += 1
        if avec_carton:
            for k in range(NC):
                img = finition(carton(k, NC), idx, grain=0.03)
                if k < NT // 2:
                    img = bandes(img, (k + NT / 2) / NT)  # les bandes finissent de passer sur le carton
                img.save(os.path.join(dossier, f"{idx:04d}.jpg"), quality=94)
                idx += 1
        return idx

    coupe2, coupe3 = debuts["arene"], debuts["boxeur"]
    total = len(images)
    # le changement de plan a lieu quand les bandes couvrent l'écran (q = 0,5)
    film = os.path.join(TMP, "film")
    ecrire(film, images, [coupe2, coupe3, total], [coupe3], True, True)
    heros = os.path.join(TMP, "heros")
    ecrire(heros, images, [coupe2, coupe3, total, 0], [coupe3], False, False)

    sortie = os.path.join(RACINE, "assets", "video")
    barres = "drawbox=x=0:y=0:w=iw:h=132:color=black:t=fill,drawbox=x=0:y=ih-132:w=iw:h=132:color=black:t=fill"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(film, "%04d.jpg"), "-vf", barres + ",format=yuv420p",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", os.path.join(sortie, "film-fight-furious.mp4")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(heros, "%04d.jpg"), "-vf", "scale=1600:-2,format=yuv420p",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-movflags", "+faststart", "-an", os.path.join(sortie, "heros-film.mp4")], check=True)
    print("images film :", len(os.listdir(film)), "| images héros :", len(os.listdir(heros)))

if __name__ == "__main__":
    main()
