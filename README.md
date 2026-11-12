# Erfgoedatlas met tijdelijke CSV-lagen

Een zelfstandige, statische kaartwebsite voor GitHub Pages. Combineer kaarten uit de openbare RCE Erfgoedatlas met eigen CSV-punten in **RD New (EPSG:28992)**. Geen installatie, API-sleutel, server of database nodig voor de gepubliceerde website.

## Publiceren op GitHub Pages

1. Pak `erfgoedatlas-csv-github-pages.zip` uit op je computer.
2. Maak op GitHub een nieuwe repository, bijvoorbeeld `erfgoedatlas-csv`. Een openbare repository is de eenvoudigste keuze voor gratis GitHub Pages.
3. Klik in de repository op **Add file → Upload files**. Sleep **de uitgepakte bestanden en mappen** naar GitHub. Upload dus niet de ZIP zelf en ook niet alleen een bovenliggende map.
4. Controleer dat `index.html`, `assets/`, `vendor/` en `voorbeeld-rd.csv` direct in de hoofdmap van de repository staan. Behoud de mappenstructuur. Sla op met **Commit changes** op de branch `main`.
5. Ga naar **Settings → Pages**.
6. Selecteer bij **Source**: **Deploy from a branch**.
7. Selecteer de branch **main**, kies de map **/(root)** en klik op **Save**.
8. Wacht tot de publicatie onder **Actions** is geslaagd. De website-URL verschijnt bij **Settings → Pages → Visit site**. Gebruik die URL; een github.com-repositorypagina voert de website niet uit.

Er is geen npm-build of eigen GitHub Actions-workflow nodig. Alle browserbibliotheken zitten in het pakket. De `.nojekyll` is meegeleverd; ook zonder dit bestand bevat deze site geen Jekyll-specifieke onderdelen.

Officiële uitleg: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>

### Als de website niet verschijnt

- **404:** controleer dat de publicatie is afgerond, de juiste branch/map is geselecteerd en `index.html` direct in die map staat. Let op hoofdletters.
- **Alleen een README of bestandslijst:** je bekijkt waarschijnlijk de repository in plaats van de Pages-URL, of `index.html` staat een map te diep.
- **De website is onopgemaakt of de kaart ontbreekt:** controleer of `assets/` én `vendor/` volledig zijn geüpload. Alle verwijzingen zijn relatief, dus een repositorynaam naar keuze werkt.
- **Pages ontbreekt of de build wordt tegengehouden:** controleer repositoryrechten, organisatiebeleid en het gekozen GitHub-abonnement. Open een mislukte run onder Actions voor de concrete fout.
- **Alleen een bepaalde kaartlaag blijft leeg:** zoom in en controleer de bron via ⓘ. Sommige bronlagen hebben schaalgrenzen of tijdelijke storingen. Een externe dienst kan informatieverzoeken vanuit een andere website blokkeren.

## Een CSV gebruiken

Dit minimale bestand is voldoende:

```csv
X,Y
155000,463000
121500,487000
```

Met extra attributen en Nederlandse decimale komma's:

```csv
X;Y;Naam
155000,25;463000,75;Amersfoort
121500;487000;Amsterdam
```

1. Sleep één of meer CSV-bestanden op de kaart of kies **CSV toevoegen**.
2. Controleer in het importvenster de kolommen voor X en Y. `X`, `Y`, `RD_X`, `RD_Y` en enkele gebruikelijke varianten worden automatisch herkend. Andere namen kun je zelf koppelen.
3. Wijzig zo nodig het scheidingsteken, de optie voor kolomnamen, de laagnaam en de kleur.
4. Bekijk het aantal geldige/ongeldige rijen. Download bij fouten desgewenst het rapport. Klik daarna op **punten toevoegen**.
5. De kaart zoomt naar de nieuwe laag. Onder **Mijn lagen** kun je de laag aan/uitzetten, kleuren, groeperen, bekijken als datatabel of verwijderen.
6. Klik op een punt voor de attributen. De datatabel bevat zoek- en bladerfuncties. Bij meerdere identieke locaties kun je groeperen inschakelen en via de tabel een afzonderlijk punt selecteren.

Gebruik **Probeer een voorbeeld** om de volledige import te doorlopen. `voorbeeld-rd.csv` bevat acht globale testlocaties, geen officiële monumentregistraties.

### Ondersteunde invoer

- CSV, TSV of tekst; komma, puntkomma, tab of pipe.
- Met kolomnamen, of zonder kolomnamen via het importvenster.
- Decimale punt of komma. Bij CSV met komma als scheidingsteken moeten getallen met een decimale komma tussen aanhalingstekens staan. Gebruik bij voorkeur een puntkomma als scheidingsteken.
- Geen duizendtalscheiding gebruiken: `155000.25` is duidelijk, `155.000` wordt als een decimaal getal gelezen.
- UTF-8, UTF-8 BOM, UTF-16 met BOM; terugval naar Windows-1252 bij ongeldige UTF-8. Andere encoderingen eerst exporteren naar UTF-8.
- Aanhalingstekens, scheidingstekens binnen geciteerde velden en regeleinden binnen velden.
- Maximaal **20 MiB**, **50.000 gegevensrijen** en **150 kolommen** per bestand; maximaal **100.000 punten** tegelijk. Groepering staat automatisch aan boven 5.000 punten per laag.
- Lege/ongeldige coördinaten, afwijkende veldentallen, geografische graden en waarden buiten X −50.000–350.000 / Y 250.000–650.000 meter worden gemeld en overgeslagen. Dit is een plausibiliteitscontrole, geen test of een punt binnen de landsgrens ligt. Verruim het bereik in `assets/csv-core.js` indien je onderzoeksgebied dat vereist.
- Het foutenrapport gebruikt **CSV-recordnummers** inclusief de kopregel; bij geciteerde regeleinden zijn dit geen fysieke tekstregelnummers.

## Kaarten en bronnen

De catalogus is op **11 november 2026** afgeleid van de openbare kaartconfiguratie op <https://rce.webgis.nl/nl/map/erfgoedatlas>.

- **191 rasterlagen**: 178 WMS-lagen en 13 WMTS-lagen, in de oorspronkelijke thema-indeling.
- **8 WFS-items** staan herkenbaar in de catalogus met een verwijzing naar de oorspronkelijke atlas. Deze worden niet als vectorlaag ingeladen in deze versie.
- De ondergronden omvatten BRT grijs/blauw, luchtfoto en water. Andere ondergronden zijn beschikbaar in de catalogus.
- Kaartbeelden worden live bij de bronhouder geladen. De catalogus is een momentopname; wijzigingen in endpoints, laagnamen en stijlen kunnen onderhoud vereisen.
- Bronverwijzingen staan achter ⓘ. Bronhouders en gebruiksvoorwaarden blijven bij hun datasets horen. Er is geen claim dat alle verschillende kaarten dezelfde actualiteit of nauwkeurigheid hebben.
- Een klik op de kaart probeert objectinformatie op te vragen uit maximaal vier actieve, zichtbare WMS-lagen die JSON ondersteunen. Dit is afhankelijk van de CORS-instellingen van de bron. Eigen CSV-punten hebben voorrang bij aanklikken.
- Zoeken op plaats/adres gebruikt de [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Amersfoort&rows=1).

De website heeft een eigen kaarticoon en is een zelfstandige toepassing; dit pakket is geen officiële RCE-publicatie of volledige kopie van de oorspronkelijke viewer.

## Tijdelijke gegevens en privacy

CSV-bestanden worden uitsluitend in de browser gelezen, bij voorkeur in een Web Worker. Er is geen uploadendpoint, geen analytics en geen opslag van de CSV in localStorage, IndexedDB of cookies. Verwijderen, herladen of sluiten wist de tijdelijke lagen uit de actieve toepassing. Importeer de oorspronkelijke CSV opnieuw om verder te werken.

De website en kaartbeelden komen wel via het internet binnen. Externe kaartdiensten ontvangen het bekeken kaartgebied en normale verbindingsgegevens; een expliciet ingediende adreszoekopdracht gaat naar PDOK. Klikken voor WMS-objectinformatie bevraagt die kaartlocatie. CSV-attributen en het CSV-bestand worden daarbij niet meegestuurd.

## Techniek en lokaal ontwikkelen

- Statische HTML/CSS/JavaScript; OpenLayers **10.6.1**, Papa Parse **5.5.3** en Proj4js **2.15.0** zijn lokaal meegeleverd met hun licenties in `vendor/`.
- De kaart en eigen punten gebruiken rechtstreeks **EPSG:28992**. Er is geen RD→WGS84-omrekening van de geïmporteerde punten nodig. Alleen voor externe lagen in andere stelsels gebruikt de viewer Proj4js met de definitie uit de bronviewer. Dit is geen centimeter-nauwkeurige RDNAPTRANS2018-implementatie.
- Tekst uit CSV en objectinformatie wordt als tekst weergegeven, niet als HTML. Formules in gedownloade foutenrapporten worden geneutraliseerd.
- Alle asset-URL's zijn relatief en werken onder een GitHub Pages-projectpad.

Start vanuit de map met `index.html` een lokale webserver:

```bash
python -m http.server 8000
```

Open vervolgens <http://localhost:8000>. Gebruik een webserver; openen via `file://` beperkt workers en het voorbeeldbestand in sommige browsers.

Tests uitvoeren met Node.js (zonder npm-installatie):

```bash
node --test tests/*.test.cjs
```

Catalogus vernieuwen (Python 3, alleen standaardbibliotheek):

```bash
python scripts/update_catalog.py
```

Controleer de wijzigingen en publiceer daarna de bijgewerkte `assets/catalog.js`. Het script bewaart alleen openbare serviceconfiguratie en bronverwijzingen; geen tokens of proxies uit de oorspronkelijke viewer. Dit script is een onderhoudsfunctie en draait niet automatisch voor bezoekers.

## Verificatie

De parser is getest op minimale X/Y-invoer, Nederlandse Excel-export, BOM, scheidingstekens, aanhalingstekens, regeleinden, ongeldige/verwisselde coördinaten, lege bestanden, dubbele kolomnamen en de grens van 50.000 rijen. De browsercontrole omvat CSV-import, validatie, meerdere tijdelijke lagen, datatabel, puntlocatie, verwijderen en de combinatie met de WMS-laag Stads- en dorpsgezichten. Niet alle 191 externe lagen zijn afzonderlijk inhoudelijk gecontroleerd; beschikbaarheid hangt af van de bronhouder.
