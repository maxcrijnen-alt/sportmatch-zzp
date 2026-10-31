# SportMatch functionele audit — 31 oktober 2026

## GitHub-basis en grenzen

- Repository en `origin`: `maxcrijnen-alt/sportmatch-zzp`.
- Startcheckout: branch `work`, commit `32abaf69397dfe8b1ab1bdb04e0be92e468585c3`, schone working tree.
- Actuele remote designbranch opgehaald: `origin/design/sportmatch-redesign` op
  `a788d64781541694146404188b7e50e1a9643765`. De vereiste ancestorcontrole slaagde.
- Werkbranch: `fix/sportmatch-functional-hardening`, rechtstreeks van die designbranch.
- De designbranch bevat de actuele `main`-basis `32abaf6`; er zijn geen extra
  main-wijzigingen meegenomen of overschreven.
- Open PR's bij aanvang: redesign [#67](https://github.com/maxcrijnen-alt/sportmatch-zzp/pull/67)
  en organisatieautorisatie [#66](https://github.com/maxcrijnen-alt/sportmatch-zzp/pull/66).
- Oplevering is een gestapelde PR naar `design/sportmatch-redesign`. Er wordt niets
  gemerged, gedeployd, naar een remote database geschreven of met productiegegevens getest.

## Bevestigde bugs en correcties

| Probleem | Oorzaak | Correctie en regressiedekking |
| --- | --- | --- |
| Segmentselecties kregen in de opdrachtenlijst geen wachtstatus | Alleen `job_confirmations` werd gelezen | Gezamenlijke `deriveJobWorkflow`, afzonderlijke RLS-beveiligde queries voor beide bevestigingstabellen; selectie, afwijzing en terminale statussen getest |
| Een gedeeltelijk bevestigd blok was niet als aparte situatie herkenbaar | Opdrachtstatus en losse bevestigingen werden zonder centrale lesdekking geïnterpreteerd | Dekking per uniek lesonderdeel, eigen oranje status ‘Gedeeltelijk bevestigd’; groen uitsluitend bij volledige definitieve dekking |
| Komende herhalingen ontbraken in urgentie | Filter op alleen `jobs.starts_on` | Gedeelde herhalingsdatums en eerstvolgende onvervulde les, één urgentievermelding per opdracht; bevestigde/cancelled/closed/completed opdrachten tellen niet als onvervuld |
| Eerstvolgende instructeursopdracht miste lessenblokken en herhalingen | Alleen hele bevestigingen en toekomstige oorspronkelijke startdatums werden geselecteerd | Het dashboard gebruikt eigen bevestigde agenda-lesmomenten, inclusief segmenten en herhalingen; afgelopen lessen vallen af |
| Tegenvoorstellen konden bij een vaste vergoeding | UI-bypass `pay_is_negotiable || true`; creatie-RPC controleerde onderhandelbaarheid en reactiestatus niet | Gedeelde UI-regel; creatie én beantwoording controleren onderhandelbaarheid, open opdracht, pending reactie en afwezigheid van een selectie; eigenaarschap en bestaande toegangsvoorwaarden behouden |
| Ingetrokken/afgewezen reacties konden rechtstreeks geselecteerd worden | Selectie-RPC's controleerden de reactiestatus niet | Beide selectie-RPC's eisen een pending reactie; directe SQL-regressies |
| Kalenderdatum week rond Nederlandse middernacht af | UTC-datum op instructeursdashboard, beschikbaarheid, opdrachtenzoeken en demo-fixtures; VOG gebruikte database-sessiondatum | Bestaande Amsterdam-helper hergebruikt; VOG-datum expliciet Amsterdam; kalenderoptelling voor dagen, absolute timestamps blijven absoluut |
| Agenda ‘vandaag’ volgde de browserzone | `new Date()`/`isToday` zonder zakelijke tijdzone | Amsterdamse kalenderdatum voor initiële dag, vandaagknop en dagmarkeringen |
| Buttons binnen links | 62 Next-links en twee native downloadlinks bevatten een button | Navigatie gebruikt Next `Link` met `buttonVariants`; ICS-downloads houden een native anchor met dezelfde styling. Geen geneste interactieve elementen, één tabstop; acties blijven buttons |
| Gesloten opdracht kon een actieve agenda-indicator krijgen of ontbreken | Geen eigen `AgendaEventState` voor `closed`, planning las alleen open opdrachten | Eigen neutrale gesloten status; gesloten planningsitems blijven van actieve zoekopdrachten te onderscheiden |
| Telefoon-/mailrij zonder inhoud | Contactkaart renderde iconen onafhankelijk van ontvangen veldwaarden | Veld en icoon alleen bij niet-lege RPC-uitkomst; geen extra contactquery, geen verruimde privacyrechten |
| Reviewscore in opdrachtdetails was geen navigatie | Sterrenbadge had geen link | Link naar het bestaande kandidaatprofiel `?job=…#reviews`; bestaande naam-/fotolinks en terugnavigatie behouden |
| Reacties konden bij gemengde segment-/hele reacties op verkeerde lessen ontbreken | Eén scoped reactie zette de interpretatie voor alle reacties op een opdracht om | Per les optellen van eigen segmentreacties én ongescopeerde reacties in de agenda |

### Gekozen status- en urgentiecontract

Er is één instructeur nodig per bestaand lesonderdeel, of één voor een opdracht
zonder onderdelen. Geannuleerde segmentbevestigingen dekken geen les. Een selectie
is pas definitieve dekking na bevestiging door de instructeur. Afgerond,
geannuleerd en gesloten behouden hun eigen betekenis en krijgen voorrang.

Het urgentievenster loopt van **vandaag tot en met zeven kalenderdagen vooruit**,
in `Europe/Amsterdam`. Dit is een datumvenster, geen optelling van 168 absolute
uren. Reeds geëindigde lessen worden uitgesloten; een nog lopende onvervulde les
blijft relevant. Een reactie of uitnodiging vult geen plek definitief in. De
opdracht wordt één keer getoond bij de eerstvolgende ongedekte les binnen het
venster, met de datum/tijd van die les. Vestigingsfilters blijven op de query gelden.

De bestaande herhalingsgrens van maximaal 104 momenten blijft gelden. Bevestigingen
gelden volgens het huidige model voor de hele reeks; er is geen nieuw
lesmomentenmodel, geen backfill en geen aanpassing van opgeslagen opdrachtstatussen
om alleen de weergave te corrigeren.

## Workflow- en autorisatiecontrole

| Gebied | Inspectie en relevante verificatie |
| --- | --- |
| Opdracht maken, dupliceren, sjabloon, lessenblok en herhaling | Bestaande `flows.spec.ts` en `pilot.spec.ts`; formuliernamen, actions en bestemmingen behouden; dupliceren wordt op de juiste linkrol getest |
| Aanmelden, selecteren, bevestigen, onderhandelen | Bestaande SQL-smoke-/workflowtests; nieuwe status-/urgentie-unitcases; SQL-negatieven voor directe requests en selectie na intrekking; nieuwe desktop-/mobiel-E2E |
| Annuleren, afronden, vervanging, reviews | Bestaande SQL- en pilotsuites; aparte terminale statusregels en uitsluiting bij urgentie |
| Kandidaten, diploma's, betrouwbaarheid, poule, uitnodigingen | Bestaande kandidaat-/pouleflows en RPC-/RLS-tests; profiel- en reviewbestemmingen gecontroleerd; geen nieuwe profiel- of reviewfunctie |
| Organisatie, vestigingen, medewerkers | `getOrgContext`, vestigingsfilter en RLS beoordeeld; scopefilters blijven bestaan; ledenautorisatie/acceptatie blijft afhankelijk van PR #66 |
| Registratie, login, onboarding en sessies | Bestaande auth-, auth-confirm-, registration- en pilotsuites behouden; geen wijzigingen in die authenticatiestromen |
| Profiel, documenten en beschikbaarheid | Bestaande eigen-gebruikerqueries/-actions behouden; VOG en lokale kalenderdatum extra getest; onvolledige profielen blijven bestaande meldingen krijgen |
| Agenda, dashboard en to-do | Gedeelde workflow- en herhalingslogica; eigen instructeursgegevens, organisatiequery's en vestigingsfilter behouden; gesloten en gedeeltelijke statussen onderscheiden |
| Berichten en openbare/afgeschermde informatie | Bestaande RPC-/RLS-controles en regressies behouden; contacten uitsluitend via `get_job_contact_details`; directe mutations op tegenvoorstellen blijven verboden |

Dit overzicht onderscheidt broninspectie van daadwerkelijk uitgevoerde tests.
Volledige browserflows zijn pas geverifieerd wanneer de volledige CI-suite groen is.

## Database en beveiliging

De additieve migration `20261031003228_functional_workflow_hardening.sql` vervangt
bestaande functies voor tegenvoorstellen, selectie en VOG-geldigheid. Zij voegt geen
tabellen, kolommen, dependencies, nieuwe publieke RPC's of datamutaties/backfills toe.
De bestaande functiehandtekeningen, grantgrenzen en lege `search_path` blijven behouden.
De SQL-suite controleert ook de bestaande SECURITY DEFINER-allowlist, demo-isolatie,
contactprivacy, toegang en business gates.

PR #66 sluit het afzonderlijke lek in directe organisatie-lidmaatschapmutaties en
introduceert gecontroleerde uitnodigingsacceptatie. Deze PR dupliceert die oplossing
niet. **De bekende kwetsbaarheid is zonder #66 nog aanwezig in de designbasis.**
Voorgestelde integratievolgorde: #66 beoordelen/integreren, daarna redesign met
deze gestapelde hardening combineren en de volledige suite opnieuw uitvoeren.
Na akkoord moet de nieuwe additieve migration vóór de bijbehorende app-release
worden toegepast; in deze opdracht wordt dat niet op een remote project uitgevoerd.

De designbasis en #66 combineren met `git merge-tree` zonder conflict. De definitieve
hardening-combinatie wordt afzonderlijk gecontroleerd; met name de mobiele
Playwright-patronen moeten zowel `membership` uit #66 als de nieuwe hardeningtests houden.

## Verificatie en beperkingen

- Dependencies geïnstalleerd met `npm ci`; Node 24.19.0, Supabase CLI 2.121.0.
- Oorspronkelijke SQL-suite op een verse PostgreSQL 17.6-container: geslaagd.
- Nieuwe en bestaande SQL-suites na de migration, seed en alle migrations in
  bestandsvolgorde, op een verse container zonder netwerk: geslaagd.
- ESLint, TypeScript inclusief Next route-types en productiebuild: geslaagd.
- Gerichte lokale Playwright-run: **132 geslaagd, nul gefaald of overgeslagen**.
  Bevat workflow-, urgentie-, DST-/middernacht-, bronsemantiek-, toetsenbord-,
  publieke desktop-/mobiel- en auth-redirecttests.
- Nieuwe volledige desktop-/mobiel-Supabase-E2E toegevoegd voor segmentstatussen,
  herhalingsurgentie, vestigingsfilter, onderhandelen en ontbrekende contactvelden.
- Lokale volledige Supabase-run geprobeerd, maar **geblokkeerd**: eerst HTTP 403
  op registry-CDN `d2glxqk2uabbnd.cloudfront.net`, vervolgens bij toegestane downloads
  onvoldoende schijfruimte bij uitpakken van images met de beheerde VFS-driver.
  Alleen de door deze test gedownloade images zijn opgeruimd. Geen test uitgeschakeld.
- Het geïnstalleerde volledige Chromium is via een tijdelijke lokale config gebruikt;
  de CI-config blijft de gebruikelijke Playwright-installatie gebruiken.
- GitHub CI-resultaat en definitieve integratiecontrole worden vóór afronding
  bijgewerkt. De volledige lokale suite wordt niet als geslaagd gepresenteerd.

### Visuele vergelijking

Veertien voor/na-screenshots, met dezelfde browser en viewport, zijn pixel voor pixel
vergeleken: homepage, beide doelgroeppagina's, tarieven, demo, login en registratie,
elk op 1440 en 390 pixels. **Alle veertien zijn identiek**, inclusief afmetingen.
Design tokens, globale CSS, branding, sidebar-/topbarontwerp en logo's zijn ongewijzigd.
Statusinhoud verandert waar de oude functionele uitkomst fout was.

Afgeschermde schermen zijn lokaal niet visueel vóór/na vergeleken omdat de volledige
Supabase-stack niet paste. De toegevoegde E2E en bestaande desktop-/mobielregressies
zijn de verdere controle; een pixel-identieke private redesign wordt niet geclaimd.
Echte apparaten, Safari en handmatige schermlezertests vallen buiten de uitgevoerde controle.

## Openstaand en backlog

- PR #66 vereist afzonderlijke beoordeling en autorisatie; niets automatisch mergen.
- Volledige lokale Supabase-/browserregressie vereist meer schijfruimte; CI biedt
  dezelfde geïsoleerde teststrategie zonder productiecredentials.
- Toekomstige productuitbreidingen staan apart in [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md).
