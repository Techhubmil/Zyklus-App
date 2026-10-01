#!/bin/bash
# Startet die Zyklus-App als lokalen Webserver im Heim-WLAN.
# Keine Daten verlassen dein Netzwerk - der Server liefert nur die App-Dateien aus.

PORT=8765
cd "$(dirname "$0")"

IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ]; then
  IP="<deine-mac-ip>"
  echo "Konnte deine lokale IP nicht automatisch ermitteln."
  echo "Finde sie unter Systemeinstellungen > WLAN > Details, oder mit: ipconfig getifaddr en0"
fi

echo ""
echo "Zyklus-App läuft jetzt lokal."
echo "Öffne auf deinem iPhone (im gleichen WLAN) in Safari:"
echo ""
echo "    http://$IP:$PORT"
echo ""
echo "Dann: Teilen-Symbol -> 'Zum Home-Bildschirm' antippen."
echo "Zum Beenden: Strg+C"
echo ""

python3 -m http.server "$PORT"
