# SportMatch ZZP

SportMatch ZZP is een matchingplatform dat sportorganisaties en
sportinstructeurs koppelt voor spoed-inval, eenmalige opdrachten,
terugkerende lessen, tijdelijke functies en vaste vacatures. Startmarkt:
de Randstad. De werknaam is voorlopig; alle branding staat centraal in
`src/lib/branding.ts`.

**Belangrijk:** het platform faciliteert matching, communicatie,
documentcontrole en digitale bevestiging. Het geeft geen juridisch of
fiscaal advies; betaling van opdrachten verloopt rechtstreeks tussen
partijen, buiten het platform om.

## Stack

- Next.js 16 (App Router, server actions) + TypeScript
- Tailwind CSS 4 met shadcn-stijl componenten (`src/components/ui`)
- Supabase: Auth, Postgres (met Row Level Security), Storage
- Playwright voor E2E-tests
- Mock-billinglaag (Mollie kan later worden aangesloten)

## Lokaal starten

```bash
npm install
cp .env.example .env.local   # vul je Supabase-gegevens in
npm run dev
```

Zonder Supabase-configuratie werken de publieke marketingpagina's;
voor de app zelf is een Supabase-project nodig.

## Supabase instellen

1. Maak een project op [supabase.com](https://supabase.com).
2. Zet in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (de `anon`/publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (alleen voor het seed-script; nooit
     committen of in de browser gebruiken)
3. Voer de migrations uit in de SQL-editor van Supabase, in deze volgorde:
   1. `supabase/migrations/0001_schema.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_functions.sql`
   4. `supabase/seed.sql` (steden, sporten, diploma's, instellingen)
4. Zet e-mailbevestiging uit voor de testfase: Authentication → Sign in /
   Providers → Email → schakel "Confirm email" uit. (Anders moet elke
   registratie eerst een e-mail bevestigen.)
5. Optioneel: demo-data laden. Dat kan op twee manieren:
   - **Zonder terminal:** plak `supabase/seed_demo.sql` in de SQL-editor en
     klik Run (aanbevolen — geen service-role key nodig).
   - **Via de terminal:** `npm run seed:demo` (vereist
     `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`).

Beide maken demo-accounts, 20 instructeurs, 5 organisaties met 8
vestigingen en 16+ opdrachten aan.

## Demo-accounts

Wachtwoord voor alle accounts: `SportMatch2026!`

| Account | Rol |
| --- | --- |
| `admin@sportmatch.test` | Beheerder |
| `instructeur@sportmatch.test` | Instructeur met historie en badges |
| `instructeur2@sportmatch.test` | Instructeur met open reactie en tegenvoorstel |
| `sportschool@sportmatch.test` | Eigenaar FitZone Utrecht (2 vestigingen) |
| `planner@sportmatch.test` | Planner bij FitZone Utrecht |

## Tests

```bash
# Publieke pagina's (werkt zonder Supabase), desktop + mobiel
npx playwright test tests/public.spec.ts

# Volledige flows (vereist Supabase + npm run seed:demo)
npx playwright test tests/flows.spec.ts

# Database-smoketest (vereist lokale PostgreSQL)
npm run test:db
```

De database-smoketest draait alle migrations tegen een lokale Postgres met
Supabase-stubs en test de kernflows (reageren, tegenvoorstel, bevestigen,
vervanging, reviews, billing-gate, annuleringsregeling) op SQL-niveau.

## Deploy naar Vercel

1. Importeer de GitHub-repository in Vercel.
2. Zet de environment variables (zie `.env.example`; de service-role key is
   op Vercel alleen nodig als je daar seed-/admin-scripts draait — laat hem
   anders weg).
3. Deploy. De middleware (sessieverversing) en server actions werken op
   Vercel zonder extra configuratie.
4. Zet in Supabase onder Authentication → URL Configuration de site-URL op
   je Vercel-domein.

## Environment variables

| Variabele | Verplicht | Doel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase project-URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | Publieke API-key |
| `SUPABASE_SERVICE_ROLE_KEY` | alleen voor seed | Service-role key (geheim) |
| `NEXT_PUBLIC_APP_URL` | aanbevolen | Basis-URL van de app |
| `BILLING_PROVIDER` | nee | `mock` (standaard); later `mollie` |
| `EMAIL_PROVIDER` | nee | `log` (standaard); later `resend` |
| `RESEND_API_KEY` | nee | Alleen bij `EMAIL_PROVIDER=resend` |

## Architectuur in het kort

- Alle mutaties in het matchingsproces (reageren, uitnodigen,
  tegenvoorstel, kandidaat kiezen, bevestigen, annuleren, vervangen,
  no-show, afronden, review, chat, billing) lopen via SECURITY
  DEFINER-RPC's in `supabase/migrations/0003_functions.sql`. Die dwingen
  rollen, abonnementstoegang en statusovergangen af en schrijven
  systeemberichten en notificaties in dezelfde transactie.
- RLS-policies (`0002_rls.sql`) regelen wie wat mag lezen: documenten
  alleen eigenaar + admin, chats alleen deelnemers, contactgegevens pas na
  bevestiging via `get_job_contact_details`.
- Matching (`open_job_matches`) scoort open opdrachten op afstand
  (steden-coördinaten, haversine), specialisatie, beoordeling, ervaring en
  no-shows. De exacte woonlocatie van instructeurs blijft verborgen.
- Abonnementen: € 5 p/m (excl. btw) per instructeur en per vestiging,
  30 dagen trial (automatisch via triggers), 14 dagen hersteltermijn.
  In de MVP gesimuleerd; `src/lib/billing/` en de `subscriptions`-tabellen
  zijn voorbereid op een echte provider.

Zie `RAPPORT.md` voor het volledige opleverrapport.
