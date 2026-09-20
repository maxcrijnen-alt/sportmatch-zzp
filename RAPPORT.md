# SportMatch — projectnotitie

Dit document vervangt de verouderde eerste oplevernotitie. De actuele werking,
installatie-instructies, omgevingsvariabelen en migratiestrategie staan in
`README.md` en `docs/MIGRATIONS.md`.

## Belangrijke uitgangspunten

- SportMatch gebruikt het bestaande Supabase-project en het bestaande
  Vercel-project.
- Er staan geen gedeelde demo- of admininloggegevens in de repository. Een
  demosessie wordt per browser server-side opgebouwd en bij reset of uitloggen
  verwijderd.
- Contactgegevens worden pas na definitieve bevestiging via een gecontroleerde
  databasefunctie vrijgegeven.
- Normale annulering registreert 150% van de totale afgesproken vergoeding.
  Aantoonbare overmacht heeft een aparte adminbeoordeling; SportMatch verwerkt
  nog geen automatische betaling.
- Externe agenda-integraties zijn voorbereid via een providerinterface. Er zijn
  bewust geen fictieve Gymly- of SportBit-endpoints opgenomen.

Voor actuele validatieresultaten en handmatige stappen vóór een release geldt
de changelog van de betreffende featurebranch of pull request als bron.
