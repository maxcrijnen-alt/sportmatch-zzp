# Abonnementautorisatie — 15 oktober 2026

## Aangetoond en hersteld

De geïsoleerde negatieve test faalde vóór de fix: een gewone instructeur kon
`mock_activate_subscription` aanroepen voor een abonnement. Naast zelfactivatie
bestond in locatieabonnementen een NULL-bypass in zowel activatie als opzegging:
`NULL OR false OR false` werd niet geweigerd door `IF NOT v_allowed`.

- Mockactivatie vereist nu een eigen abonnement binnen een nog geldige demosessie.
- Opzegging weigert onbekende/andermans abonnementen ook bij een NULL-instructor.
- Eigen opzegging en de bestaande adminondersteuning blijven beschikbaar.
- Reguliere accounts krijgen geen mock-betaalknop; een afwijzing geeft een veilige foutmelding.
- Trialdatums en bestaande actieve abonnementen worden niet aangepast.

Er is geen echte betaalprovider toegevoegd. Na het einde van een trial kan een
reguliere gebruiker nog niet zelf een echte betaalactivatie uitvoeren. Voor een
commerciële uitrol is een geverifieerd betaalpad een afzonderlijke productbeslissing.
Een gecontroleerde pilot kan de bestaande 30-daagse trials gebruiken.

## Verificatie en uitrol

- Vereiste CI vóór uitrol: [run 38761856080](https://github.com/maxcrijnen-alt/sportmatch-zzp/actions/runs/38761856080).
- ESLint, TypeScript, productiebuild en alle migrations/SQL-tests geslaagd.
- 125 Playwright-tests geslaagd, 0 failed, 0 skipped, 0 flaky; 10 demoscenario's.
- De rode voorafgaande beveiligingstest blokkeerde de mergeknop onder de nieuwe main-ruleset.
- SQL wordt uitsluitend in wegwerpdatabases getest; geen productietestmutaties.
- Geteste nieuwe SQL eenmaal toegepast op het bestaande Supabase-project via de
  migration-tool. Die registreerde versie `20261015154313`; de bestandsnaam is
  daarna met die registratie gelijkgezet. De SQL-inhoud bleef identiek.
- Alleen functiedefinities en execute-grants veranderen. Geen bestaande rijmutaties,
  oude migrations, migration repair, accountwijzigingen of resets.

## Configuratie

Main-ruleset `main-required-ci` vereist een PR en de actuele GitHub Actions-check
`Lint, types, database and full E2E`; force-push en verwijderen zijn geblokkeerd,
de bypasslijst is leeg.

Supabase Auth minimumlengte is van 6 naar 8 verhoogd en na herladen geverifieerd,
in overeenstemming met de bestaande registratie-/herstelformulieren. Leaked-password
protection werd door Supabase expliciet geweigerd: vereist Pro of hoger. Geen plan
of facturatie gewijzigd. De Advisor-waarschuwing blijft daarom open.
