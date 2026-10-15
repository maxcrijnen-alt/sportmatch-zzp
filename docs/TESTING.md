# Automatische regressiecontrole

`.github/workflows/ci.yml` draait op iedere pull request en iedere push naar
`main`. Er zijn geen repository-secrets nodig. Node 24 sluit aan bij het
bestaande Vercel-project; `.nvmrc` is de gedeelde major-versie. De workflow
installeert met `npm ci` uit `package-lock.json`.

De check **Lint, types, database and full E2E** moet volledig groen zijn:

1. ESLint en TypeScript, inclusief door Next gegenereerde route-types.
2. Alle migrations in bestandsvolgorde, seed en SQL-smoketests in een nieuwe
   PostgreSQL 17.6-container. Deze heeft geen netwerk of gepubliceerde poort.
3. Een afzonderlijke lokale Supabase-stack met een unieke projectnaam en een
   tijdelijke kopie van config, migrations en seed.
4. Een productiebuild tegen uitsluitend die lokale stack.
5. De volledige Playwright-suite, met `RUN_DEMO_E2E=true`, één worker, nul
   retries en alle desktop-/mobielprojecten uit de configuratie.

Ontbrekende dependencies, migratiefouten, `.only`, mislukte tests en iedere
overgeslagen of flaky test geven een foutstatus. De resultaatcontrole vereist
ook dat de demo-suite daadwerkelijk is opgenomen. Tests kunnen dus niet groen
worden door de demo ongemerkt uit te schakelen.

## Lokaal uitvoeren

Vereisten: Node 24 met npm, Bash, een lokale Docker-engine en Supabase CLI
**2.121.0**. Linux of WSL met Docker werkt hetzelfde als de GitHub-runner.

```bash
npm ci
npm run lint
npm run typecheck
npm run test:db
npx --no-install playwright install --with-deps chromium
npm run test:regression
```

`test:regression` start de tijdelijke stack, wacht op de API en seed, bouwt de
app en voert alle browsertests uit. Poorten 3000, 54321, 54322 en de overige
ingeschakelde lokale Supabase-poorten moeten vrij zijn. Een actieve ontwikkelstack
wordt niet gereset. Er wordt geen remote project gekoppeld en `.env.example`
of productieconfiguratie wordt niet naar de teststack gekopieerd. De app krijgt
de lokale testvariabelen rechtstreeks vanuit `supabase status`.

De scripts verwijderen hun containers en volumes bij succes en fouten via
een exit-trap. GitHub heeft daarnaast een `always()`-cleanupstap en gooit na de
job de volledige runner weg. De losse SQL-run raakt geen bestaande lokale
databases of rollen. Oude migrations worden uitsluitend in deze nieuwe
testdatabases afgespeeld; productie volgt `MIGRATIONS.md`.

Alleen publieke tests uitvoeren kan met `npm run build` en `npm run test:e2e`
zonder Supabase-variabelen. Daarbij worden de suites die lokale Auth/demo nodig
hebben expliciet overgeslagen. Dat is geen volledige regressieverificatie.
Playwright weigert externe app- en Supabase-URLs; CI weigert bovendien een run
zonder ingeschakelde demo-E2E.

## Dekking en diagnose

| Controle | Suite |
| --- | --- |
| Wachtwoordcontrole, inloggen, uitloggen, afgeschermde route | `auth.spec.ts` |
| Twee gelijktijdige demo's, opnieuw starten zonder datalek of verlies in andere sessie | `flows.spec.ts` |
| Sportschool/instructeur, kandidaten, agenda, vestigingsfilter, beschikbaarheid | `flows.spec.ts` |
| Lessenblokken, herhaling, sjablonen, poule opslaan/verwijderen, bulkbevestiging, mobiele navigatie | `flows.spec.ts` |
| RLS, organisatie- en demo-isolatie, VOG, uitnodiging/chat/notificatie, bevestiging, reviews en business gates | `supabase/tests/smoke_test.sql` |
| Publieke pagina's op desktop/mobiel en Amsterdamse tijd | `public.spec.ts`, `timezone.spec.ts` |

Iedere GitHub-run toont de fasen afzonderlijk. Het artifact
`sportmatch-test-results-*` bewaart zeven dagen het HTML-/JSON-rapport, de
SQL-smoketestuitvoer en bij falen screenshots en traces. Het joboverzicht noemt
geslaagd, gefaald, overgeslagen en flaky afzonderlijk. De rapporten bevatten
uitsluitend tijdelijke testaccounts en lokale sessies; de stack en sleutels
bestaan na cleanup niet meer. Deel geen productie-auth-state of `.env`-bestanden
als artifact.

Een lokaal HTML-rapport is te openen met:

```bash
npx --no-install playwright show-report
```

Maak na merge deze check verplicht in de branch protection/ruleset voor `main`
als merges ook technisch op een groene CI-status moeten wachten. De workflow
zelf verandert geen repositoryregels en bevat geen deploy- of remote
migrationstap; de bestaande Vercel Git-integratie blijft verantwoordelijk voor
deployments.
