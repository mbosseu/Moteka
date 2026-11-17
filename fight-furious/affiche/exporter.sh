#!/bin/sh
# Exporte les deux formats de l'affiche (le serveur local doit tourner sur le port 5178)
cd "$(dirname "$0")"
E="/c/Program Files/Google/Chrome/Application/chrome.exe"; P=$(cygpath -w "$PWD")
for f in post story; do H=1350; [ $f = story ] && H=1920
  "$E" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=6000 --window-size=1080,$H --screenshot="$P\affiche-fight-furious-$f.png" "http://localhost:5178/affiche/affiche.html?format=$f" >/dev/null 2>&1
done
