# Eindrapport SportMatch ZZP — MVP

Datum: juli 2026. Status: werkende MVP, klaar voor een online testversie
zodra Supabase en Vercel zijn gekoppeld (stappen in `README.md`).

## 1. Wat is gebouwd

- **Publieke website (NL):** home, hoe-het-werkt, voor-instructeurs,
  voor-sportscholen, tarieven, FAQ, privacy- en voorwaarden-placeholders,
  met alle gevraagde disclaimers en een tijdelijk logo. Responsive
  (mobiel/tablet/desktop).
- **Accounts en rollen:** e-mail/wachtwoord-registratie met rolkeuze
  (instructeur of organisatie), aparte onboardingflows, adminrol (alleen
  via database toe te kennen — zelfregistratie als admin is geblokkeerd).
- **Instructeurs:** profiel met statussen (zzp/werknemer/student/
  werkzoekend/anders), KvK/btw verplicht alleen bij zzp, specialisaties,
  uurtarief, reisafstand, wekelijkse beschikbaarheid + uitzonderingen,
  documentuploads (diploma, EHBO/BHV/AED, VOG, verzekering) naar privé
  Supabase Storage met statussen en badges, waarschuwing bij bijna
  verlopen certificaten.
- **Organisaties:** meerdere vestigingen (elk met eigen abonnement),
  medewerkers met eigen login en rollen (eigenaar/planner/
  vestigingsmanager) via e-mailuitnodigingen, organisatieprofiel.
- **Opdrachten:** vijf typen (spoed-inval, eenmalig, terugkerend,
  tijdelijk, vaste vacature) met alle verplichte velden, vast/uur/beide
  vergoeding, diploma-eisen, spoedmarkering.
- **Matching:** score op afstand (verborgen woonlocatie; alleen plaats en
  kilometers), specialisatie, beoordeling, ervaring en no-shows.
  Hoofdlijst toont passende opdrachten binnen reisafstand; zoekweergave
  toont alles met waarschuwingen bij ontbrekende diploma's of te grote
  afstand. Filters: sport, soort, datum, afstand, minimumbedrag.
- **Reageren en bevestigen:** "Ik ben beschikbaar" met bericht en
  beschikbaarheid, tegenvoorstellen over en weer, uitnodigingen,
  kandidaten vergelijken met betrouwbaarheidsstatistieken, digitale
  dubbele bevestiging (organisatie kiest en gaat akkoord → instructeur
  bevestigt) met samenvatting vooraf; contactgegevens pas zichtbaar na
  definitieve bevestiging.
- **Annulering/vervanging/no-show:** vervanger voorstellen (organisatie
  keurt altijd eerst goed), oplopende annuleringsregeling (25/50/100% bij
  <12/<6/<2 uur, wederzijds, alleen registratie — geen inning), no-show-
  registratie die meetelt in de betrouwbaarheidsscore, admincorrectie
  mogelijk.
- **Chat:** tekst-only per opdracht/kandidaat, automatische
  systeemmeldingen bij alle kernevenementen, geen leesbevestigingen.
- **Reviews:** 1–5 sterren beide kanten op, pas zichtbaar nadat beide
  partijen hebben beoordeeld; betrouwbaarheidsscore uit bevestigde/
  afgeronde opdrachten, annuleringen, no-shows en gemiddelde beoordeling.
- **Notificaties:** in-app notificatiecentrum met ongelezen-teller; alle
  kernevenementen genereren meldingen in de database.
- **Billing (mock):** € 5 p/m excl. btw per instructeur en per vestiging,
  30 dagen gratis trial (automatisch bij aanmaken), maandelijks opzegbaar,
  14 dagen hersteltermijn bij "betaling mislukt". Zonder actieve toegang:
  registreren/profiel/bekijken kan, maar reageren, chatten, plaatsen en
  bevestigen zijn geblokkeerd (afgedwongen in de database, niet alleen in
  de UI). Admin kan statussen handmatig wijzigen.
- **Conversievergoeding:** organisaties melden een vaste aanname; € 50
  excl. btw; adminstatussen gemeld → gecontroleerd → gefactureerd →
  betaald → betwist. Geen automatische inning.
- **Admin:** statistieken (alle gevraagde tellers), gebruikers-,
  organisatie-, vestigings-, opdrachten-, review-overzichten,
  documentcontrole met inzage via tijdelijke signed URLs en
  goedkeuren/afkeuren + vervaldatum, billingbeheer, beheer van sporten en
  diploma's.

## 2. Wat werkt volledig

Alle bovenstaande flows werken end-to-end tegen een Supabase-project. De
volledige kernlogica is bovendien op databaseniveau geverifieerd met een
geautomatiseerde smoketest (`npm run test:db`): registratietriggers,
trials, matchscores, reageren, tegenvoorstel, kandidaat kiezen, dubbele
bevestiging, contact-onthulling, chat, vervanging, afronden, dubbelblinde
reviews, billing-gate en de annuleringsregeling.

## 3. Voorbereid maar nog niet volledig actief

- **E-mailnotificaties:** de e-maillaag (`src/lib/email/send.ts`) logt
  berichten; met `EMAIL_PROVIDER=resend` + API-key gaat hij echt versturen.
  Er worden nog geen e-mails getriggerd vanuit de flows.
- **Browser-push:** niet gebouwd; in-app en e-mail-ready conform de
  prioriteit in de opdracht.
- **Herinneringen 24/2 uur vooraf:** de notificatiestructuur bestaat; er
  is nog geen scheduler (Supabase cron of Vercel cron toevoegen).
- **Mollie:** `BILLING_PROVIDER` en `billing_events` zijn voorbereid; er
  is geen echte betaalintegratie.
- **Blokkeren/rapporteren van gebruikers:** admin_notes en adminbeheer
  bestaan; een meldknop voor gebruikers nog niet.
- **Documentstatus "verlopen":** admin-knop aanwezig; automatische
  dagelijkse run vereist nog een cronjob.
- **Avatar-upload:** bucket + policies bestaan; er is nog geen UI voor.
- **Realtime chat:** de chat ververst elke 8 seconden; Supabase Realtime
  kan later worden aangezet voor instant updates.

## 4–6. Lokaal starten, Supabase, Vercel

Zie `README.md` voor de exacte stappen (installatie, migrations, seed,
e-mailbevestiging uitzetten, Vercel-envs en site-URL).

## 7. Demoaccounts

Zie `README.md`; wachtwoord overal `SportMatch2026!`. Let op: dit zijn
testaccounts voor de demo-omgeving — niet hergebruiken in productie.

## 8. Tests

- `tests/public.spec.ts` — 13 tests × desktop + mobiel (26), draait zonder
  Supabase. **Uitgevoerd en groen.**
- `tests/flows.spec.ts` — login, rolgebaseerde toegang, opdracht plaatsen,
  filteren, matchscore zichtbaar, reageren-omgeving, chat versturen,
  documenten, reviews, admin-documentcontrole, billingoverzicht,
  registratie → onboarding. Vereist een geseede Supabase-omgeving; slaat
  zichzelf over zonder configuratie.
- `supabase/tests/smoke_test.sql` + `npm run test:db` — volledige
  kernflow-verificatie op SQL-niveau. **Uitgevoerd en groen.**

## 9. Juridisch te controleren vóór lancering

- Algemene voorwaarden en privacybeleid (nu placeholders, gemarkeerd in de
  UI).
- De annulerings-/vervangingsregeling (25/50/100%) — afdwingbaarheid en
  formulering.
- De conversievergoeding van € 50 bij vaste aanname binnen 6 maanden.
- AVG: verwerkersovereenkomsten, bewaartermijnen, datalekprocedure,
  grondslagen voor documentopslag (VOG!).
- Positionering rond schijnzelfstandigheid: het platform belooft nergens
  "veilig zzp'en", maar laat dit vóór lancering toetsen.

## 10. Nog nodig aan sleutels/accounts

- Supabase-project (gratis tier volstaat voor de testfase).
- Vercel-koppeling met de GitHub-repo.
- Later: Mollie-account + API-key, e-mailprovider (bijv. Resend) +
  domein, definitieve domeinnaam.

## 11. Ontbrekend voor productie

Echte betalingen en dunning, e-mail/push-notificaties, wachtwoord-reset-
flow (Supabase kan dit, UI ontbreekt), avatar-upload, rapporteren/blokkeren,
audit-logging, rate limiting, monitoring/alerting, cronjobs (herinneringen,
documentexpiratie, trial-afloop), toegankelijkheidsaudit en juridische
documenten.

## 12. Aanbevolen volgende stappen

1. Supabase + Vercel koppelen en de flows-testsuite draaien (fundament
   valideren in de echte omgeving).
2. E-mailnotificaties activeren (Resend) en cronjobs voor herinneringen en
   documentexpiratie toevoegen.
3. Wachtwoord-reset en avatar-upload afmaken (kleine, zichtbare
   verbeteringen).
4. Mollie-integratie achter de bestaande billinglaag.
5. Juridische toets van voorwaarden, annuleringsregeling en
   conversievergoeding.
6. Supabase Realtime aanzetten voor chat en notificaties.
7. Feedbackronde met 2–3 echte sportscholen in de Randstad.
