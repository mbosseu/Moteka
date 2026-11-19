"""Voix off V2 (Microsoft Rémy, neuronale, gratuite) avec horodatage des mots, puis traitement « bande-annonce ».
Usage : python outils/voix_v2.py  (depuis video-concours ; accès réseau à speech.platform.bing.com)"""
import asyncio, json, os, subprocess, tempfile
import edge_tts
from voix_v2_lignes import L

FX = ("highpass=f=90,equalizer=f=180:t=q:w=1:g=2.5,equalizer=f=3200:t=q:w=1.2:g=4.5,equalizer=f=8000:t=q:w=1:g=2,"
      "acompressor=threshold=-22dB:ratio=6:attack=2:release=90:makeup=7,alimiter=limit=0.89")
COUPE = {"v1": "aselect='not(between(t,0.52,0.84))',asetpts=N/SR/TB,"}  # raccourcit le silence après « Toi... » pour que « Golf » tombe sur le temps fort

async def main():
    mots, tmp = {}, tempfile.mkdtemp()
    for i, texte in L:
        c = edge_tts.Communicate(texte, "fr-FR-RemyMultilingualNeural", rate="+10%", proxy=os.environ.get("HTTPS_PROXY"), boundary="WordBoundary")
        brut, m = os.path.join(tmp, i + ".mp3"), []
        with open(brut, "wb") as f:
            async for x in c.stream():
                if x["type"] == "audio": f.write(x["data"])
                elif x["type"] == "WordBoundary": m.append((x["text"], round(x["offset"] / 1e7, 3), round((x["offset"] + x["duration"]) / 1e7, 3)))
        mots[i] = m
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", brut, "-af", COUPE.get(i, "") + FX, "-ar", "48000", f"assets/voice/{i}.wav"], check=True)
    json.dump(mots, open("assets/voice/mots-v2.json", "w"), ensure_ascii=False, indent=0)

asyncio.run(main())
