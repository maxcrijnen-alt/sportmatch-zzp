# Organisatielidmaatschappen: autorisatieherstel

## Bevinding en bewijs

De productaudit van main `32abaf6` vond twee gerelateerde fouten in de directe
RLS-schrijfroute van `organization_members`:

- De insert-policy accepteerde een zelf opgegeven `invited_email` zonder dat
  daarvoor al een uitnodiging van de eigenaar bestond. Dit maakte ongeautoriseerd
  actief lidmaatschap met de rol `owner` mogelijk.
- De update-policy voor ontvangers beschermde de organisatie en lidmaatschapsrol
  niet tijdens het accepteren. De serveractie schreef wel veilige velden, maar
  dat begrensde directe databaseverzoeken niet.

De eerste bypass is daadwerkelijk gereproduceerd als `authenticated` in een
wegwerp-PGlite-database met alle bestaande migrations en seed. De resulterende
eigen rij had `member_role=owner,state=active` in de organisatie van iemand anders.
De productiedatabase is voor deze audit uitsluitend gelezen; de reproductie
heeft geen productielidmaatschap aangemaakt. Ernst: **hoog**, omdat org-rechten
verdere toegang tot privégegevens en mutaties geven.

## Oplossing

Een nieuwe additieve migration beperkt directe inserts en updates tot de bestaande
eigenaar-/adminrechten. De maker kan de eerste eigenaar van een eigen, nog lege
organisatie blijven vastleggen. Een private, afgeschermde helper controleert dit
zonder dat RLS onzichtbare bestaande leden als een lege organisatie behandelt.
Een voormalige maker kan een reeds ingerichte organisatie daardoor niet terugnemen.

`accept_organization_invitation(uuid)` is de enige selfservice-acceptatieroute:

- expliciete authenticatie en een bij Auth bevestigd e-mailadres;
- bestaande uitnodiging, juiste ontvanger en dezelfde demo-/productiescope;
- rijlock, status `invited` en nog geen gekoppelde gebruiker;
- schrijft uitsluitend de eigen gebruikers-ID en `active`, met behoud van de
  uitgenodigde organisatie en rol;
- voltooit onboarding in dezelfde transactie; een weigering laat beide intact;
- herhaalde acceptatie door hetzelfde actieve lid is idempotent;
- geen anon-execute, lege `search_path`, gerichte `SECURITY DEFINER`-RPC.

De frontend gebruikt deze RPC, toont een bruikbare fout en wacht tijdens opslaan.
Tarieven, abonnementen, chats, notificaties en bestaande leden worden niet gemuteerd.
De openbare Definer-allowlist stijgt bewust van 34 naar 35; bestaande anon- en
search-path-gates blijven strikt en de poule-RPC's blijven `SECURITY INVOKER`.

## Verificatie

- `membership_security_test.sql`: vervaardigde uitnodiging, directe rol-/org-
  wijziging, onbevestigd/verkeerd e-mailadres, ingetrokken lid, ontbrekende auth,
  demo-/productiescheiding, oude maker, legitieme bootstrap/eigenaar, acceptatie
  en idempotentie.
- Alle SQL-suites op PGlite slagen, inclusief de bestaande billing-, workflow-
  en smoke-tests. PGlite vervangt de volledige PostgreSQL/Supabase-CI niet.
- `membership.spec.ts`: eigenaar nodigt planner uit; intrekking ná render geeft
  een zichtbare fout zonder onterechte onboarding; nieuwe uitnodiging wordt
  geaccepteerd met behoud van plannerrechten. Desktop en mobiel.
- Verplichte volledige GitHub CI voert lint, types, build, alle SQL-suites en
  alle Playwright-/demo-tests uit vóór merge. De PR registreert de definitieve run.

## Resterende grens

Auth moet voor externe e-mailidentiteit daadwerkelijk bevestigingsmails gebruiken.
Bij uitgeschakelde e-mailbevestiging kan Supabase accounts automatisch bevestigen;
een timestamp bewijst dan geen mailboxbezit. Dit blijft een voorwaarde voor later
extern gebruik, samen met SMTP. In deze ontwikkelronde worden geen provider,
betaald plan of externe uitnodigingen geactiveerd.

De audit van de 34 bestaande Definer-functies blijft een historische momentopname;
deze bevinding zat in directe tabelpolicies en illustreert waarom RPC-audit alleen
geen volledige autorisatie-audit is. Volgende controles moeten ook directe grants,
kolommen, RLS en ongewenste statusovergangen meenemen.
