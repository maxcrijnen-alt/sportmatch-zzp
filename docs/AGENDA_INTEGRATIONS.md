# Lesrooster en koppelingen — 12 november 2026

Deze uitbreiding bouwt voort op main `5775ecc` (de geïntegreerde redesign en
workflowfixes). PR #70, `bd0a42b`, blijft een afzonderlijke privacyfix. Er is geen
live koppeling aangezet en geen externe configuratie gewijzigd.

## Beschikbaar in deze branch

- Een sportschool kan gewone lessen toevoegen, met vestiging, naam, lesvorm,
  sport, datum, Nederlandse begin-/eindtijd en optionele instructeursweergavenaam.
  Eenmalig of maximaal 52 wekelijkse momenten; daarna bewerken per datum.
- De bestaande dag-, week-, maand- en lijstweergaven, locatiekeuze en ICS-export
  tonen deze lessen naast bestaande SportMatch-opdrachten. `Ingeplande les` en
  `Inval nodig · nog geen opdracht` zijn apart van de bestaande workflowstatussen.
- Vanuit een gewone les opent het bestaande opdrachtformulier met vooraf
  ingevulde roostergegevens. Contact, vergoeding, beschrijving en diploma-eisen
  blijven onderdeel van de bestaande workflow. Het gaat om één lesmoment.
- Publicatie en koppeling gebeuren atomair in de database. Een rijvergrendeling
  plus unieke les/opdrachtkoppeling voorkomt dubbele plaatsing bij herhalen of
  gelijktijdige verzoeken. Ook een gesloten/geannuleerde zoekopdracht blijft
  gekoppeld; er ontstaat niet stilzwijgend een tweede opdracht.
  Een gekoppelde opdracht kan niet naar een andere organisatie/vestiging worden
  verplaatst. De instructeur uit het rooster blijft naast de invalstatus zichtbaar.
- Bronwijzigingen overschrijven geen gepubliceerde voorwaarden. Lesrevisie en
  oorspronkelijke publicatierevisie signaleren wijzigingen in agenda en detail.
  Annuleren van een les annuleert de opdracht niet automatisch: de school krijgt
  een expliciete waarschuwing om die bestaande workflow af te handelen.
- Per vestiging kan uitsluitend een eigenaar een voorbeeldbron tonen,
  synchroniseren of verbergen. Deze bevat 12 duidelijk synthetische lessen over
  vier weken vanaf eerste activatie. De bron doet geen netwerkverzoeken en kan
  **geen echte invalopdracht publiceren**. Eigen lessen blijven beschikbaar.

## Officieel bevestigd en nog niet bevestigd

Alle onderstaande bronnen zijn op 12 november 2026 gelezen. Een productfunctie,
widget of bestaande partnerkoppeling bewijst geen vrij uitleesbare API.

| Leverancier | Wat officiële bronnen bevestigen | Contract voor SportMatch |
| --- | --- | --- |
| LogiFit (MyLogiFit is de portal/appnaam) | [Agenda/groepslessen](https://logifit.nl/oplossingen/agenda-groepslessen/), [instructeurs-app](https://logifit.nl/oplossingen/instructeurs-app/) en [prijspagina](https://logifit.nl/prijzen/) noemen planning, personeel en API-toegang. | Geen geverifieerde endpoints, authenticatiescopes of schema voor lesmomenten **én instructeurstoewijzingen** beschikbaar gekregen. Geen live adapter. |
| Gymly | [Officiële Developer API-publicatie](https://www.gymly.io/pulse/agent-ready) noemt lancering in december 2025, activatie via Business/add-on en documentatie/voorbeelden na activatie; er zijn groepsles-events. | API-bestaan is bevestigd. Het concrete leescontract voor rooster, vestiging, toegewezen instructeur, wijzigingen en uitzonderingen is nog niet ingezien. Geen live adapter. |
| SportBit Manager | [Lesrooster](https://www.sportbitmanager.nl/oplossingen/lesrooster-en-reserveringen), [weekpatronen](https://site.sportbitmanager.nl/functies/planning/) en [specifieke partnerkoppelingen](https://www.sportbitmanager.nl/oplossingen/slimme-koppelingen) zijn bevestigd. | Geen rechtstreeks verifieerbaar algemeen rooster-/instructeur-API-contract gevonden. Partnerboekingen bewijzen geen API-leesrecht voor SportMatch. Geen live adapter. |

Er zijn geen endpoints geraden, accounts aangemaakt, betaalde opties geactiveerd,
widgets gescrapet of leveranciers benaderd. Geen bestandsimport: er is geen
vastgesteld bronformaat met betrouwbare occurrence-, wijzigings- en annulerings-ID's.

## Architectuur en beveiliging

`AgendaProvider` blijft het weergavecontract. `agendaProvider` combineert de
bestaande `sportMatchAgendaProvider` met `lessonAgendaProvider`. Voor instructeurs
blijft alleen de eigen bestaande opdrachtagenda zichtbaar. Een gekoppelde
opdracht verschijnt één keer, met de bestaande workflowstatus en het actuele
rooster. Losse/terugkerende opdrachten en lessenblokken blijven ondersteund.

`LessonSourceProvider` is het aparte server-only broncontract; alleen de
synthetische implementatie bestaat. Een toekomstige adapter levert minimale,
gevalideerde `LessonInput`-momenten aan. Geen sleutels, URL's of credentials in
clientcode of deze nieuwe tabellen. De leveranciersregistry beschrijft alleen
beschikbaarheid; die is geen werkende connector.

`agenda_sources` is uniek per vestiging/provider. `scheduled_lessons` heeft een
unieke `(source_id, external_id)` en samengestelde foreign keys die bron,
organisatie en vestiging binden. RLS vereist een actief organisatielid met
organisatierol en dezelfde demo-/productiescope. Instructeurs, buitenstaanders,
uitgenodigde/inactieve leden en andere demosessies zien geen privélesrooster.
Planners kunnen eigen lessen beheren; voorbeeldbronconfiguratie is alleen voor
eigenaren. Directe tabelwrites en anonieme toegang zijn ingetrokken.

De twee publieke schrijf-RPC's zijn SECURITY INVOKER. De private implementaties
controleren dezelfde autorisatie ook wanneer ze rechtstreeks in SQL worden
aangeroepen, hebben een lege search_path en expliciete EXECUTE-grants. De private
RLS-helper controleert lidmaatschap/scope; de publieke Definer-allowlist blijft
ongewijzigd. Publicatie herhaalt vestigingstoegang, openstaande reviews, lesrevisie,
geldige vergoeding, actieve diploma-eisen en geannuleerd/verlopen lesmoment.
Een private trigger met ingetrokken EXECUTE-grants bewaakt de scope van een
gekoppelde opdracht bij latere writes.

Import vergrendelt de bron en gebruikt een bronversie tegen verouderde snapshots.
Ongewijzigde data behoudt les-ID en revisie. Een ongeldige synthetische snapshot
wordt geheel teruggedraaid; alleen een veilige foutcode/status wordt bewaard.
Ontbrekende momenten in een volledige snapshot worden geannuleerd, niet gewist.
Handmatige edits vereisen de actuele lesrevisie. Transportfouten worden in het
formulier gemeld; die tellen niet als geslaagde synchronisatie.

Lessen gebruiken datum plus lokale tijd in `Europe/Amsterdam`. Bestaande
kalenderrekenfuncties behouden de kloktijd over DST. Niet-bestaande kloktijden
worden geweigerd; dubbele wintertijd volgt de bestaande eerste-instantieconventie
voor omzetting. Geen nachtoverschrijdende lessen. Begrenzing: 104 momenten per
schrijfverzoek, 52 wekelijkse momenten in het formulier, één jaar terug/twee jaar
vooruit; laden in pagina's van 500 tot 10.000 momenten, daarna een zichtbare fout
met verzoek een vestiging te kiezen. Er wordt geen stilzwijgend afgekapt rooster
of ICS-bestand teruggegeven.

## Nodig vóór een live adapter

Per leverancier: officiële versievaste OpenAPI/API-documentatie, sandbox,
read-only credentials/scopes en expliciete toestemming van de deelnemende club.
Verifieer organisatie-/vestigings-ID's, stabiele serie- én occurrence-ID's,
toegewezen instructeur/alias, IANA-tijdzone, verplaatste/afgezegde momenten,
herhalingsexcepties, volledige snapshot versus delta, pagination, tombstones,
rate limits en webhookauthenticatie. Test dit met een contractsuite en twee
gescheiden organisaties voordat een connector actief kan worden.

Bewaar secrets vervolgens uitsluitend server-side in een daarvoor beoordeelde
secretstore, gebonden aan organisatie/vestiging met rotatie/intrekking. Gebruik
een stabiele oorspronkelijke occurrence-ID bij verschuiven; een ID op basis van
de nieuwe begintijd maakt duplicaten. Bewaar slechts een nodige staffweergavenaam
of pseudoniem; geen leden, boekingen, adressen, geboortedata of contactgegevens.
Voeg retries/backoff, periodieke reconciliatie en bewaartermijn pas toe met het
echte leveranciercontract. Het prototype claimt geen automatische live-sync.

## Migratie en pilot

`20261112110906_organization_lesson_agenda.sql` is additief en volgt zowel de
main-migrations als PR #70 (`20261109154821`). Geen backfill of remote uitvoering.
De samengestelde `jobs_location_organization_fk` vervangt de enkelvoudige
vestigings-FK atomair, zodat PostgREST één eenduidige vestigingsrelatie behoudt.
Hij is NOT VALID: nieuwe
inserts/gewijzigde sleutels moeten bij dezelfde organisatie horen, bestaande
rijen worden niet herschreven. Inventariseer eventuele historische afwijkingen
en valideer de constraint in staging vóór een productie-uitrol.

Registratie/bevestiging, recovery, uitnodigingen/reacties en wederzijdse
bevestiging worden door de bestaande volledige geïsoleerde CI-suite bewaakt.
Deze branch wijzigt die flows niet. De bekende instructeursprivacyfix blijft in
[PR #70](https://github.com/maxcrijnen-alt/sportmatch-zzp/pull/70), die vóór een
pilot met persoonsgegevens afzonderlijk beoordeeld en uitgerold moet worden.
Zie [PILOT_READINESS.md](PILOT_READINESS.md) voor externe SMTP-/Auth-configuratie
en voorwaarden; eerdere live inventarisaties zijn geen nieuwe verificatie.

Nieuwe tests staan in `agenda_security_test.sql`, `lesson-contract.spec.ts` en
`lesson-agenda.spec.ts` (desktop en mobiel). Ze bewijzen onder meer scope,
ongeldige/stale batches, DST, atomair publiceren, gelijktijdige verzoeken,
idempotente sync, behoud van voorwaarden en de complete les→inval→agenda→ICS-flow.
