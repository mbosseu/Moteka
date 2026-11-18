"""Voix off (Microsoft Henri, neuronale) : une prise par ligne, puis traitement « bande-annonce » avec ffmpeg.
Usage : python outils/voix.py  (depuis le dossier video-concours)"""
import asyncio, json, subprocess, os
import edge_tts

VOIX = "fr-FR-HenriNeural"
LIGNES = [
    ("l01", "Du vingt-trois au vingt-huit novembre... six soirs. Six lots. Un seul moteur.", "+10%"),
    ("l02", "Lundi, on démarre : vidange offerte.", "+16%"),
    ("l03", "Mardi : nettoyage complet, intérieur et extérieur.", "+18%"),
    ("l04", "Mercredi : géométrie et parallélisme.", "+16%"),
    ("l05", "Jeudi : contrôle complet de ton véhicule.", "+16%"),
    ("l06", "Vendredi, on passe la cinquième ! Vingt-quatre heures au volant d'une Golf huit R. Trois cent vingt chevaux.", "+14%"),
    ("l07", "Et samedi... la finale. G T A six, sur PS cinq !", "+6%"),
    ("l08", "C'est gratuit. Jusqu'à trois tickets : inscris-toi, invite deux amis, laisse un avis Google.", "+18%"),
    ("l09", "Chaque soir, en story, la roulette tourne. Ce soir... c'est peut-être ton numéro.", "+12%"),
    ("l10", "Fight and Furious. Joue maintenant !", "+6%"),
]

async def une(id_, texte, vitesse):
    brut = f"assets/voice/{id_}-brut.mp3"
    c = edge_tts.Communicate(texte, VOIX, rate=vitesse, pitch="-6Hz", volume="+0%", boundary="WordBoundary")
    mots = []
    with open(brut, "wb") as f:
        async for m in c.stream():
            if m["type"] == "audio":
                f.write(m["data"])
            elif m["type"] == "WordBoundary":
                mots.append({"text": m["text"], "start": m["offset"] / 1e7, "end": (m["offset"] + m["duration"]) / 1e7})
    sortie = f"assets/voice/{id_}.wav"
    # grave un peu plus présent, compression serrée, brillance, puis niveau constant
    filtre = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=70,equalizer=f=140:t=q:w=1:g=3,equalizer=f=3200:t=q:w=1.2:g=3,"
              "acompressor=threshold=-20dB:ratio=4:attack=5:release=80:makeup=4,"
              "loudnorm=I=-16:TP=-1.5:LRA=7")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", filtre, "-ar", "48000", "-ac", "1", sortie], check=True)
    os.remove(brut)
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sortie],
                             capture_output=True, text=True).stdout)
    if mots:
        z = mots[0]["start"]
        mots = [{"text": m["text"], "start": round(m["start"] - z, 3), "end": round(m["end"] - z, 3)} for m in mots]
    return {"id": id_, "texte": texte, "duree": round(d, 3), "mots": mots}

async def main():
    os.makedirs("assets/voice", exist_ok=True)
    res = [await une(*l) for l in LIGNES]
    json.dump(res, open("assets/voice/voix.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in res:
        print(r["id"], r["duree"], "s")
    print("total", round(sum(r["duree"] for r in res), 2))

asyncio.run(main())
