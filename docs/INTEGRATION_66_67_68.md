# Integratiecontrole van SportMatch PR #66, #67 en #68

## Vastgelegde basis

Repository: `maxcrijnen-alt/sportmatch-zzp`. Tijdelijke integratiebranch:
`integration/sportmatch-pr-66-67-68`, met een afzonderlijke review-PR naar `main`.
Er wordt niets naar `main` gemerged en geen deployment of remote migration uitgevoerd.

| Onderdeel | Opgenomen commit |
| --- | --- |
| Ongewijzigde main-basis | `32abaf69397dfe8b1ab1bdb04e0be92e468585c3` |
| PR #66: organisatieautorisatie en uitnodigingsacceptatie | `74e56ee89e88adfb211c021d0c20c62725b678d1` |
| Testfix op de bestaande PR #66 | `4e765d23b8b2efa39ef5e319fb81d818117b920d` |
| Vervolgfix PR #66: medewerkerslijst en bestaande maandgrenscorrectie | `0ee8ef68923ed2ea1be0741b9c2067b39c67900c` |
| PR #67: goedgekeurde redesign | `a788d64781541694146404188b7e50e1a9643765` |
| PR #68: volledig groene hardening | `4e691d41247f9a747741d840b04118cb6151afab` |
| Lokale integratiemerge | `b670c09f2e47816b127aba5e6a3b9e25cf6176cc` |

De integratie is begonnen op de exacte PR #68-commit; PR #67 is daar al ancestor
van. De gerepareerde PR #66 is vervolgens uitsluitend op de integratiebranch
gemerged. Ancestorcontroles bevestigen dat alle drie bronnen aanwezig zijn.
De branches en commits van PR #67 en #68 blijven ongewijzigd.

## Membership-selector

De eerdere CI-run van PR #66 gaf tweemaal dezelfde strict-mode-fout, op desktop
en mobiel. De pagina bevat zowel de echte formulierfout als Next.js'
`__next-route-announcer__`, beide met `role="alert"`.

De test selecteert nu het formulier dat de knop **Uitnodiging accepteren** bevat
en zoekt daarbinnen het alert. De fouttekst blijft dezelfde `toContainText`-assertion.
Er is geen `.first()`, geen selectie op de verwachte fouttekst en geen verwijderde
assertion. De databasecontrole dat mislukte acceptatie onboarding niet voltooit,
de controle op de onboardingroute en alle succes-/rolcontroles blijven intact.
De wijziging is als afzonderlijke testcommit op PR #66 gepusht. Nadat deze stap
slaagde, toonde de volgende assertion dezelfde naam in zowel header als
medewerkerslijst. Ook die selector is nu tot de hoofdinhoud beperkt, met behoud
van de zichtbaarheidseis. De reeds in PR #68 aanwezige maandgrenscorrectie is
ongewijzigd naar de losse PR #66 overgenomen; de integratie houdt daardoor
precies de bestaande agendatest uit PR #68.

## Conflict en mobiele dekking

Alleen `playwright.config.ts` gaf een mergeconflict. De twee testpatronen uit
PR #68 zijn behouden en `membership` is toegevoegd:

```ts
testMatch: [
  /(public|pilot|auth|auth-confirm|registration|membership)\.spec\.ts/,
  /(hardening|link-semantics)\.spec\.ts/,
]
```

De collectie bevestigt dat alle drie expliciet gevraagde suites op mobiel zijn
opgenomen. De gecombineerde suite bevat **206 tests in 13 bestanden**, tegenover
204 tests in PR #68. Workers, retries, timeouts, loopback-beperkingen en verplichte
demo-E2E zijn ongewijzigd. Er zijn geen tests uitgezet of assertions afgezwakt.

## Migrationvolgorde en autorisatie

Er zijn dertien unieke migrations, zonder hernoemde of herschreven migrations.
De bestaande bestandsvolgorde plaatst de relevante wijzigingen als volgt:

1. `20261015155522_protect_private_status_checks.sql` — bestaande afgeschermde checks.
2. `20261016094828_revalidate_pending_workflow_actions.sql` — bestaande workflowcontrole.
3. `20261016170104_secure_organization_membership_acceptance.sql` — PR #66.
4. `20261031003228_functional_workflow_hardening.sql` — PR #68.

De security-migration en acceptatiecode zijn inhoudelijk identiek aan PR #66.
De hardening-migration, opdracht-/agendalogica en bijbehorende acties zijn
ongewijzigd overgenomen uit PR #68. De membership-SQL-test heeft alleen een
overbodige lege eindregel verloren om de diffcontrole schoon te houden.

De vijf SQL-suites controleren onder meer:

- Organisatie- en demo-isolatie, legitieme eigenaar-bootstrap en eigenaarbeheer.
- Afwijzen van gefabriceerde lidmaatschappen, rol-/organisatie-escalatie en heractivatie.
- Acceptatie van precies één bestaande uitnodiging met bevestigd, passend e-mailadres;
  behoud van de uitgenodigde rol en idempotente herhaling.
- Geen onboarding na mislukte acceptatie; geen anonieme toegang tot de acceptatie-RPC.
- De expliciete publieke SECURITY DEFINER-allowlist van 35 functies, inclusief de
  afzonderlijk gecontroleerde acceptatie-RPC, en behoud van lege `search_path`.
- De bestaande billing-, VOG-, selectie-, bevestigings-, intrek-, contactprivacy-
  en overige workflowcontroles uit PR #68.

Alle migrations en seed zijn lokaal in volgorde toegepast op een verse PostgreSQL
17.6-container zonder netwerk. Alle vijf SQL-suites zijn geslaagd. Er is geen
remote database gekoppeld, geen backfill uitgevoerd en geen productiegegeven gebruikt.

## Behoud van functionaliteit en redesign

Ten opzichte van PR #68 wijzigt de productcode alleen de bedoelde membership-
acceptatie: het bestaande onboardingformulier gebruikt `AcceptInviteForm` met de
gecontroleerde RPC en zichtbare foutstatus. De overige onboardingkaarten en layout
zijn behouden. Globale CSS, UI-componenten, branding, assets, dependencies,
opdrachten, dashboards, agenda, navigatie en tegenvoorstellen zijn ongewijzigd.

De volledige regressie omvat opnieuw de bestaande auth-/mailflows,
registratie/onboarding, demo-isolatie, opdracht maken/dupliceren, lessenblokken,
herhaling, poule, uitnodigingen, selectie/bevestiging/intrekken, reviews,
vestigingsfilter, beschikbaarheid, status-/urgentielogica en toetsenbordnavigatie.
De membershiptest voegt de echte mislukte en succesvolle uitnodigingsacceptatie
toe op zowel desktop als mobiel.

## Testoverzicht en grenzen

| Controle | Verificatie |
| --- | --- |
| Oorspronkelijke PR #67 en #68 | Bestaande succesvolle GitHub CI opnieuw gecontroleerd |
| Membership-selector | Oorzaak aangetoond met de mislukte desktop-/mobiele CI-logs; assertion behouden en tot het acceptatieformulier beperkt |
| ESLint op de gecombineerde code | Geslaagd; twee bestaande waarschuwingen uit PR #66 over ongebruikte actionparameters |
| TypeScript inclusief Next route-types | Geslaagd |
| Gecombineerde migrations, seed en vijf SQL-suites | Geslaagd op geïsoleerde PostgreSQL 17.6 |
| Playwright-collectie | 206 tests; membership, hardening en link-semantics expliciet op mobiel |
| Volledige productiebuild en Playwright/Supabase-regressie | De definitieve run en aantallen worden vastgelegd in de integratie-PR |
| Broncontrole redesign en PR #68-behoud | Geen wijziging aan globale styling, UI-basis, branding of hardeningcode; alle broncommits aanwezig |

De volledige lokale Supabase-stack paste bij de eerdere audit niet op de beheerde
VFS-schijf. Daarom bevestigt de vereiste GitHub CI de volledige gecombineerde
productiebuild en browserregressie met een tijdelijke lokale Supabase-stack.
Er wordt geen volledige lokale Supabase-run als geslaagd gepresenteerd.

De integratie-PR is uitsluitend ter beoordeling. De drie bron-PR's blijven open;
deze controle verleent geen toestemming om te mergen, productiegegevens te
wijzigen of naar productie te deployen.
