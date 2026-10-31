# Productbacklog na de functionele audit

Deze uitbreidingen zijn **niet geïmplementeerd** in de hardening-PR. De prioriteiten
zijn aanbevelingen voor afzonderlijke productbesluiten; P2 betekent een volgende
productronde en P3 een latere verbetering.

| Wens | Wat bestaat | Wat ontbreekt | Technische wijziging | Database | Advies |
| --- | --- | --- | --- | --- | --- |
| Vooraf gedefinieerde reviewkenmerken | Sterrenscore, vrije toelichting, vrijgegeven reviews en bestaande reviewfilters | Kenmerken zoals ‘Reageert snel’, ‘Professioneel’ en ‘Klantvriendelijk’ | Productkeuze voor toegestane kenmerken; selectie bij review, servervalidatie, weergave en toegankelijkheid; bestaande regels voor publicatie en wederzijdse reviews behouden | Ja: kenmerken en hun koppeling aan reviews, inclusief RLS en gecontroleerde schrijfrechten | P2 |
| Connecties onderscheiden van pouleleden | Eén private relatie via `organization_instructor_connections`; opslaan/verwijderen en poule-uitnodigingen | Een afzonderlijke betekenis, levenscyclus en toestemmingsmodel voor beide relaties | Eerst vastleggen wie een connectie initieert/accepteert en welke relatie voor uitnodigingen telt; daarna UI, queries, RPC's en isolatietests aanpassen | Ja als beide relaties zelfstandig moeten bestaan; apart type of aparte tabel, met expliciet migratiebeleid voor bestaande relaties | P2, na productbesluit |
| Persoonlijk ‘Over mij’-veld | `instructor_profiles.work_experience`, jaren ervaring en afgeronde opdrachten; de ervaringsbeschrijving wordt onder ‘Over mij’ getoond | Een aparte persoonlijke biografie | Optioneel bio-veld, profiel-/onboardingformulieren, validatie en bestaande publieke profielweergave aanpassen; bestaande tekst niet zonder besluit herinterpreteren | Ja: optioneel veld op het instructeursprofiel | P2 |
| Nieuwe reviewfilters | Filter op sterren en sortering via `src/lib/reviews/filter.ts`, ook op bestaande profiel-/reviewpagina's | Alleen concreet nieuw afgesproken filters; de huidige filters hoeven niet opnieuw gebouwd te worden | Filtercontract, URL-parameters en query-/weergavelogica uitbreiden; lege resultaten en toetsenbordgebruik testen | Alleen wanneer het filter nieuwe gegevens vereist; kenmerkenfilters hangen af van de eerste backlogregel | P3 |
| Overige eerdere productfeedback | Bestaande dashboards, agenda, reviews, profielen en poule | In deze opdracht staan geen andere concrete uitbreidingen beschreven | Eerst concrete voorbeelden, gewenst gedrag en acceptatiecriteria vastleggen; daarna afzonderlijk ramen | Nog niet vast te stellen | P3 / intake |

Het huidige datamodel koppelt bevestigingen aan een opdracht of lesonderdeel voor
de hele herhalingsreeks. Losse toewijzingen/annuleringen per herhalingsdatum zijn
geen bestaande mogelijkheid. Als dat gewenst is, vereist dit een afzonderlijk
productbesluit en een model voor lesmomenten; de audit introduceert dat niet.
