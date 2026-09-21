# SportMatch

SportMatch koppelt sportscholen aan sportinstructeurs voor invalwerk,
eenmalige en terugkerende lessen, tijdelijke opdrachten en vaste vacatures.
De applicatie faciliteert matching, documentcontrole, communicatie, digitale
bevestiging, agenda en reviews. Betaling van opdrachten loopt rechtstreeks
tussen partijen; SportMatch geeft geen juridisch of fiscaal advies.

## Stack

- Next.js 16 (App Router en server actions) met TypeScript
- React 19 en Tailwind CSS 4
- Supabase Auth, Postgres, Row Level Security, Storage en Realtime
- Playwright voor end-to-endtests
- Vercel voor hosting en dagelijks onderhoud

## Lokaal starten

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

Vul `.env.local` met de variabelen van het bestaande SportMatch-project. Zet
nooit een service-role key, wachtwoord of ander geheim in Git.

## Databasewijzigingen

Alle schemawijzigingen worden als nieuwe bestanden onder
`supabase/migrations/` vastgelegd. Het bestaande live project is ouder dan de
migration-historyregistratie; pas daarom eerst de niet-destructieve
baselineprocedure in [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md) toe. Voer de
oude migrations niet opnieuw uit op productie.

De interactieve demo gebruikt geen gedeelde accounts. Iedere browserstart
maakt via `src/lib/demo/factory.ts` een tijdelijke database-isolatie met eigen
gebruikers en een vaste baseline. Uitloggen, opnieuw starten of de dagelijkse
cleanup verwijdert die sessie.

## Onderhoudscron en tijdzone

Het bestaande Vercel-project gebruikt het Hobby-plan. Dat plan ondersteunt
cronjobs maximaal eenmaal per dag; `vercel.json` start het onderhoud daarom
dagelijks om 03:00 UTC. Opdrachtdata en -tijden worden voor herinneringen
expliciet als `Europe/Amsterdam` geïnterpreteerd, inclusief zomer- en
wintertijd.

De cron verstuurt één 24-uursherinnering per gebruiker en bevestigde opdracht.
Een 2-uursherinnering staat bewust uit: daarvoor is een Vercel-plan met minimaal
hourly cron nodig. Na een planwijziging moeten zowel het schema naar bijvoorbeeld
`0 * * * *` als de 2-uurslogica expliciet worden geactiveerd en getest.

## Validatie

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm test:e2e
```

`supabase/tests/` bevat aanvullende databasecontroles. Productiedata wordt
niet als testfixture gebruikt.

## Environment variables

| Variabele | Verplicht | Doel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | URL van het bestaande Supabase-project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | Publieke browserkey |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Tijdelijke demo's, cleanup en beheertaken |
| `NEXT_PUBLIC_APP_URL` | aanbevolen | Canonieke applicatie-URL |
| `CRON_SECRET` | productie | Autorisatie van de onderhoudscron; zonder geheim faalt de route gesloten |
| `PUBLIC_SPORTSCHOOL_PARTNERS_JSON` | nee | JSON-config voor echte, actieve publieke partners |
| `BILLING_PROVIDER` | nee | Huidige billing-adapter |
| `EMAIL_PROVIDER` | nee | `log` of `resend` |
| `EMAIL_FROM` | bij Resend | Geverifieerde afzender |
| `RESEND_API_KEY` | bij Resend | Server-only API-key |

## Beveiligingsmodel

- Contactvelden zijn niet breed uit de basistabellen leesbaar. Eigen of
  definitief gedeelde gegevens lopen via gecontroleerde RPC's.
- SECURITY DEFINER-functies hebben een expliciete allowlist; interne helpers
  zijn niet via de Data API uitvoerbaar.
- VOG- en openstaande-reviewregels worden server-side afgedwongen voor
  commerciële kernacties.
- Demo-rijen zijn op sessie-ID afgeschermd, ook bij directe API-toegang.
- Klachtbewijs en documentbestanden blijven in private storage.

Zie [`RAPPORT.md`](RAPPORT.md) voor de oorspronkelijke architectuurbeschrijving.
