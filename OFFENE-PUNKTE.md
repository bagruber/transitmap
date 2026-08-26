# Offene Punkte

*Notiert am 26.08.2026 fuer spaetere Sitzungen. Erledigte Punkte bitte streichen,
nicht abhaken — die Datei soll kurz bleiben.*


## Toolchain-Stand

Dieses Repo laeuft seit dem 26.08.2026 auf **pnpm** (nicht npm) und auf der
projektweiten Hausbasis. **Die Zielversionen stehen nicht hier**, sondern in
`hausbasis/baseline.json` — eine Quelle statt einer Tabelle je Repo. Abgleich:

```bash
node ../hausbasis/check.mjs --kurz
```

Der Sinn ist Deduplizierung: alle Repos teilen sich einen pnpm-Store, der genau so
weit dedupliziert, wie die Versionen uebereinstimmen. Gemessen kostet ein Repo mit
abweichenden Versionen ~158 MB, ein Versions-Zwilling ~8 MB. **Einzelne Pakete
also nicht im Alleingang hochziehen** — das faellt allen anderen Repos zur Last.

## Warum `baseUrl` aus der tsconfig verschwunden ist

TypeScript 7 hat die Option entfernt (Fehler TS5102). Die Zeile
`"baseUrl": "."` wurde ersatzlos gestrichen — `paths` loest TS 7 relativ zur
tsconfig-Datei auf, die Eintraege stimmen unveraendert weiter. **Nicht
"reparieren", indem `baseUrl` wieder eingetragen wird.**

## GitHub Pages ist nicht eingerichtet

Der Deploy-Workflow laeuft, der `build`-Job ist gruen — der `deploy`-Job bricht
mit *"Ensure GitHub Pages has been enabled"* (HTTP 404) ab. Fuer dieses Repo
wurde Pages nie aktiviert; bis zum 26.08.2026 lag auch kein Code im Remote, der
Workflow ist also nie gelaufen.

**Zu tun**, falls die Seite oeffentlich erreichbar sein soll:
https://github.com/bagruber/transitmap/settings/pages — Source auf
"GitHub Actions" stellen. Das veroeffentlicht die Seite im Web, ist also eine
Entscheidung und kein Konfigurationsdetail. Solange sie aussteht, schlaegt jeder
Push den Deploy-Job fehl, ohne dass am Build etwas falsch waere.

## Der Code lag bis 26.08.2026 unversioniert

Das Repo hatte nur einen `Initial commit` mit der README; der gesamte Editor lag
uncommitted auf der Platte. Ist seitdem committet (`b345633`), aber noch nie
gepusht — es existiert also weiterhin nur eine Kopie.

## Nichts davon ist gepusht

Alle Aenderungen vom 26.08.2026 liegen als lokale Commits. Der Deploy-Workflow
wurde von `npm ci` auf `pnpm install --frozen-lockfile` umgestellt und bekommt
einen `pnpm/action-setup@v4`-Schritt. **Der erste Push aktiviert das.** Bricht
danach ein Deploy, ist das die erste Stelle zum Nachsehen — nicht der App-Code.

## Beim naechsten Paket-Update

Weder `pnpm install` noch `pnpm prune` raeumt die alte Version aus
`node_modules/.pnpm`. Nach einem Upgrade deshalb:

```bash
rm -rf node_modules && pnpm install
pnpm store prune
```

Ohne diesen Schritt bleibt der Speichergewinn auf dem Papier. In den beiden
Upgrade-Wellen am 26.08.2026 hat das zusammen ~1,2 GB freigegeben.
