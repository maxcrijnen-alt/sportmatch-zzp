# Instructeursgegevens — R1-1

Basis: actuele main `5775eccaae7cb708fcb336afdc90fc295046cd3c`.
Uitsluitend instructeursgegevens; R1-2 en andere audituitbreidingen zijn geen
onderdeel van deze wijziging. Geen remote migration, backfill, productieaccount
of productiegegeven gebruikt.

## Oorzaak en reproductie

Authenticated had een tabelbrede SELECT-grant op `instructor_profiles`.
De SELECT-policy toetst `private.profile_in_demo_scope(user_id)`: dat scheidt
demo's van productie, maar begrenst geen kolommen binnen dezelfde scope.
Daardoor kon instructeur B rechtstreeks de geboortedatum en bedrijfsnummers
van A lezen, onafhankelijk van de zichtbare frontendvelden.

De nieuwe `instructor_privacy_test.sql` is vóór de migration uitgevoerd op
PostgreSQL 17.6 met alle bestaande migrations en synthetische fixtures. De test
faalde exact op `select birth_date from public.instructor_profiles`, met
`FAIL: private instructor data was readable`. Er is geen productierequest
uitgevoerd om de kwetsbaarheid te demonstreren.

## Inventaris van alle afhankelijkheden

| Route | Bestaande toegang | Gevolg/oplossing |
| --- | --- | --- |
| `src/app/(app)/profiel/page.tsx` | Eigen `select('*')`, incl. KvK/btw voor formulier | Gecontroleerde private RPC, uitsluitend eigen identiteit of admin |
| `src/app/(app)/organisatie/kandidaten/[id]/page.tsx` | Ruwe geboortedatum voor leeftijd; ervaring/tarief/afstand | Minimale kandidaat-RPC met berekende leeftijd; geen DOB of bedrijfsnummers |
| `src/app/(app)/organisatie/kandidaten/page.tsx` | Alleen user_id, ervaring, omschrijving, tarief en reisafstand | Expliciete veilige kolomgrants; query/ranking ongewijzigd |
| `src/app/(app)/dashboard/page.tsx` | Eigen tarief/afstand/omschrijving/ervaring | Alleen veilige kolommen, ongewijzigd |
| `src/app/(app)/opdrachten/[id]/page.tsx` | Embedded `instructor_profiles!inner(user_id)` voor vervangers | Veilige primaire sleutel blijft leesbaar binnen bestaande scope |
| `src/lib/admin/stats.ts` | `select('*', head/count)` voor aantal instructeurs | Telling vraagt alleen user_id; admin-UI gebruikt verder `admin_list_profiles`, niet deze tabel |
| `src/lib/profile/actions.ts` | Eigen upsert met bedrijfsnummers | INSERT/UPDATE via kleine server-only helper; bestaande RLS/grants behouden |
| `src/lib/onboarding/actions.ts` | Eigen upsert met DOB/KvK/btw | Zelfde helper, inclusief eerste insert en herhaalde opslag |
| `src/lib/demo/factory.ts` | Bestaande service-role inserts met synthetische demo's | Ongewijzigd; geen nieuwe service-role-route |
| `open_job_matches` | Definer leest eigen ervaring/afstand, geeft matchgegevens terug | Handtekening en resultaat ongewijzigd; geen administratie in resultaat |
| VOG-, apply-, vervangings- en triggerfuncties | Existencechecks op user_id, bestaande Definer-guards | Ongewijzigd; directe safe-column queries blijven werken |
| `set_instructor_connection` / `invite_connected_instructors` | SECURITY INVOKER; existencecheck op user_id | Blijven INVOKER; pouleprivacy en uitnodigingsgates behouden |
| FK's, trialtrigger en seed | Primaire sleutel en bestaande INSERT/UPDATE | Geen schema-/relatie-/trial-/datawijziging |
| TypeScript `InstructorProfile` | Eigen administratie | Behouden; aparte `InstructorCandidateProfile` sluit DOB/KvK/btw uit |
| SQL-/browserfixtures | Uitsluitend lokale synthetische data; service-role voor setup | Nieuwe rolmatrix en bestaande volledige suite |

Alle migrationverwijzingen naar de tabel, publieke RPC-returntypes en eventuele
views zijn geïnspecteerd. De bestaande code heeft geen publieke view die de
private kolommen opnieuw projecteert. Bestaande Definer-RPC's geven geen ruwe
instructeursadministratie door. Nieuwe SQL-tests bewaken dat geen alternatieve
composite-returnende API dit ongemerkt verandert.

## Databasegrens

De additieve migration `20261109154821_secure_instructor_profile_reads.sql`
verwijdert tabelbrede én expliciete kolom-SELECT-grants voor PUBLIC, anon en
authenticated. Alleen de veilige kolommen worden opnieuw aan authenticated
gegeven. Ook `select *`, een whole-row/JSON-projectie, een embedded read of een
filter op de geboortedatum vereist daardoor verboden privileges.

De bestaande SELECT-RLS blijft van kracht op veilige kolommen, inclusief
demo-isolatie. INSERT- en UPDATE-grants en hun policies blijven ongewijzigd.
Er zijn geen profielen of andere bestaande rijen gemuteerd.

Twee expliciete lees-API's hebben lege search_path en geen PUBLIC/anon-execute:

- `get_instructor_private_profile(uuid)`: expliciete authenticatie, eigen
  gebruikers-ID of database-adminrol, bestaande scopehelper; een vaste lijst
  administratieve velden, geen automatisch uitbreidend `select *`.
- `get_instructor_candidate_profile(uuid)`: uitsluitend eigen preview, admin
  of actieve sportschoolmedewerker in de bestaande scope. Een vaste lijst
  ervaring/omschrijving/tarief/reisafstand plus leeftijd; nooit DOB/KvK/btw.

De kandidaatroute gebruikt dezelfde doelgroep als de bestaande VOG-/kandidaat-
functionaliteit. Een gewone andere instructeur krijgt geen kandidaat-RPC-rij.
De bestaande administratieve bevoegdheid van echte admins blijft bestaan;
er wordt geen adminrol afgeleid van wijzigbare user_metadata. Een organisatie
krijgt ook na samenwerken geen onnodige instructeursadministratie.

Leeftijd gebruikt de kalenderdatum in Europe/Amsterdam. Geen geboortedatum of
vrij te kiezen referentiedatum naar de caller: een referentiedatumparameter
zou reconstructie van de geboortedag via herhaalde queries mogelijk maken.
Ontbrekende/toekomstige geboortedatums geven geen negatieve/verzonnen leeftijd.

De publieke Definer-API groeit bewust van 35 naar 37. De bestaande test vereist
nu exact 37 én afzonderlijk beide nieuwe functies; anon-revokes, lege
search_path en SECURITY INVOKER voor de poule blijven verplicht.

## Opslaan zonder heropenen van SELECT

Een eerste regressierun liet zien dat PostgreSQL bij `ON CONFLICT DO UPDATE`
ook SELECT op de private EXCLUDED-kolommen vereist. Die rechten opnieuw geven
zou het privacyherstel terugdraaien. `saveInstructorProfile` leest daarom
uitsluitend de eigen primaire sleutel en gebruikt normale INSERT of UPDATE,
met dezelfde gebruikersclient en dezelfde bestaande RLS. Een gelijktijdige
eerste insert wordt na unique_violation via UPDATE herhaald.

De twee bestaande actions blijven server-side authenticeren en hun eigen
user_id opbouwen; er komt geen clientgestuurde target of service-role-bypass.
Eigen DOB kan via de normale eigen UPDATE gewijzigd worden; onboarding en
de bestaande profielvelden behouden hun bestaande presentatie. Bredere
transactionaliteit van onboarding is bewust geen R1-1-onderdeel.

## Regressie en design

De SQL-suite test anon, zelf, andere instructeur, onbekende actieve school,
admin, verschillende demo's, demo/production beide richtingen, veilige
projecties, eigen writes, indirecte whole-row/JSON-/filterreads en leeftijd
op verjaardag, met ontbrekende/future DOB en afwijkende sessiontijdzone.

De nieuwe desktop-/mobiele `instructor-privacy.spec.ts` doet echte Data API-
requests met gewone gebruikerskeys voor de rolmatrix. Hij controleert eigen
profielopslag, avatarupload, kandidatenlijst/-details en berekende leeftijd,
afwezigheid van privéwaarden in kandidaat-HTML, VOG, uitnodiging en admin-
telling/dashboard. Alle accounts en bestanden zijn tijdelijk/synthetisch.
De bestaande registratie-/onboarding-, reviews-, kwalificatie-/poule-, matching-,
beschikbaarheids-, demo- en overige regressies blijven in de volledige CI.

Lokale verificatie: alle 14 migrations en seed op verse PostgreSQL 17.6,
alle zes SQL-suites, lint (twee bestaande waarschuwingen), TypeScript en
productiebuild slagen. De veilige browserselectie wordt afzonderlijk van
de volledige geïsoleerde API-/Supabase-run gerapporteerd in de PR.
De volledige lokale stack is geprobeerd maar de VFS-image-extractie liep
tegen `no space left on device` aan. De poging is gestopt en alleen de
hiervoor gedownloade testimages zijn opgeruimd; geen tests uitgezet.
De volledige GitHub CI met lokale wegwerp-Supabase bepaalt de definitieve
browser-/API-uitkomst. Een lokaal niet gedraaide suite wordt niet groen genoemd.

Geen wijziging aan CSS, branding, assets, client-UI-componenten, layout,
navigatie of kaarten. Alleen de twee noodzakelijke leesqueries veranderen;
leeftijd staat op dezelfde plek. Geen dependency toegevoegd.

## Uitrolgrens en resterende risico's

Deze PR past niets toe op productie en merge/deployt niets. De definitieve
CI-run en aantallen staan in de PR. Een gecontroleerde uitrol moet de additive
databasewijziging en appcode coördineren: de oude app gebruikt nog select('*')
en upsert, de nieuwe app vereist de nieuwe RPC's. Voorbereiding daarvan is
geen toestemming om de uitrol uit te voeren.

Leeftijd, ervaring en vrijgegeven beoordelingen blijven bedoelde kandidaatdata.
De bestaande adminbevoegdheid en service-role voor interne taken blijven
vertrouwd. De overige auditbevindingen, SMTP/pilotvoorwaarden en R1-2 zijn
hiermee niet opgelost of als gereed verklaard.
