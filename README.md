# Secret Hitler – Web-App fürs Handy

Online-Version des Gesellschaftsspiels *Secret Hitler* für 5–10 Leute **im selben Raum**: Jeder spielt auf
seinem eigenen iPhone (oder Android) im Browser, keine App-Installation nötig. Regeln = offizielle Regeln.

## So spielt ihr

1. Eine Person öffnet die Seite und tippt **„Neues Spiel erstellen“**.
2. Die anderen scannen den **QR-Code** oder öffnen den geteilten Link / geben den Raumcode ein.
3. Der Host startet, sobald 5–10 Leute drin sind. Jeder sieht seine Rolle per **Gedrückt-halten**.
4. Diskutiert wird laut am Tisch – die App übernimmt Karten, Abstimmungen und das Spielbrett.

Tipp: In Safari **Teilen → Zum Home-Bildschirm** – dann läuft das Spiel im Vollbild und der Bildschirm bleibt an.
Wird ein Handy gesperrt oder die Seite neu geladen, kommt man automatisch auf seinen Platz zurück.

## Technik

| Teil | Was | Wo |
|---|---|---|
| Spiellogik | Reiner TypeScript-Zustandsautomat (`applyAction`) + gefilterte Sicht pro Spieler (`viewFor`) | `src/game/` |
| Server | Ein Cloudflare **Durable Object pro Raum** (PartyServer), hält als Einziger den vollen Spielzustand | `src/server/` |
| Oberfläche | React + Vite, mobile-first, Reconnect-Logik für iOS Safari | `src/client/` |

Geheime Infos (Rollen, Stapel, Handkarten) verlassen den Server nie – jedes Handy bekommt nur, was es sehen darf.
Die Regeln sind über `GameConfig` (`src/game/rules.ts`) konfigurierbar, damit später eigene Varianten möglich sind.

```bash
npm install
npm run dev        # lokal: http://localhost:5173 (Server + Oberfläche zusammen)
npm test           # Regel-Tests inkl. 200 zufällig durchgespielter Partien
npm run typecheck
```

## Online stellen (Cloudflare, kostenlos)

**Variante A – über das Cloudflare-Dashboard (empfohlen, kein Terminal nötig):**

1. Kostenloses Konto auf [dash.cloudflare.com](https://dash.cloudflare.com) anlegen.
2. *Workers & Pages → Create → Import a repository* → GitHub verbinden → dieses Repo wählen.
3. Build command: `npm run build` · Deploy command: `npx wrangler deploy` · Branch: der Branch mit diesem Code.
4. Deploy – danach läuft die App unter `https://secret-hitler.<dein-name>.workers.dev`.
   Jeder Push auf den Branch deployt automatisch neu.

**Variante B – per Terminal:** `npx wrangler login` und dann `npm run deploy`.

Kosten: Für eine Freundesrunde reicht der kostenlose Workers-Plan (Durable Objects mit SQLite sind dort enthalten).
Räume ohne Verbindung werden nach 3 Tagen automatisch gelöscht.

## Datenverbrauch

Erster Start ca. 0,3–0,5 MB (App + Grafiken), danach aus dem Cache. Ein Spiel selbst überträgt nur wenige
hundert KB pro Person – weniger als eine Minute Telefonat.

## Lizenz & Credits

*Secret Hitler* ist von Max Temkin, Mike Boxleiter, Tommy Maranges, illustriert von Mackenzie Schubert,
herausgegeben von Goat, Wolf & Cabbage LLC, lizenziert unter
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Die Grafiken in `public/assets/` stammen
aus der Adaption von [Secret Hitler Online](https://github.com/ShrimpCryptid/Secret-Hitler-Online)
(ShrimpCryptid, CC BY-NC-SA 4.0) und wurden für diese App verkleinert und nach WebP konvertiert; sie stehen
weiterhin unter CC BY-NC-SA 4.0 (siehe `public/assets/LICENSE.md`). Schrift: Germania One (SIL OFL).

Privates, **nicht-kommerzielles** Fanprojekt – nicht verbunden mit Goat, Wolf & Cabbage. Keine Werbung,
kein Geld, kein App Store.

`research_notes/` und `reports/` enthalten die Recherche, die vor dem Bau gemacht wurde.
