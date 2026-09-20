# Veilige migration-baseline

Het bestaande Supabase-project `fdlhhkwemjbctsmgwgvt` bevat het schema uit
`0001` tot en met `0004`, maar had bij de audit geen rijen in de migration
history. De oude bestanden opnieuw uitvoeren is niet veilig: ze bevatten
`create type` en `create table` zonder herstelpad.

## Eenmalige baselineprocedure

1. Maak vóór de wijziging een databaseback-up en gebruik uitsluitend het
   bestaande project.
2. Vergelijk live eerst tabellen, enums, functies, policies, storage-buckets en
   de Realtime-publicatie met `0001_schema.sql` tot en met
   `0004_realtime.sql`. Los afwijkingen bewust op; markeer niets blind.
3. Link de CLI aan projectref `fdlhhkwemjbctsmgwgvt`.
4. Registreer de vier reeds aanwezige versies zonder SQL opnieuw uit te voeren:

   ```bash
   supabase migration repair 0001 --status applied
   supabase migration repair 0002 --status applied
   supabase migration repair 0003 --status applied
   supabase migration repair 0004 --status applied
   ```

5. Controleer met `supabase migration list` dat lokaal en remote gelijk staan.
6. Laat vervolgens uitsluitend migrations met een latere timestamp uitvoeren,
   eerst in een preview/stagingdatabase en daarna in productie.

De migration `20260919171944_harden_function_and_contact_access.sql` zet de
functie-allowlist en contactprivacy recht. De daaropvolgende productmigration
is additief en verwijdert geen productiedata. `0004_realtime.sql` wordt in de
productmigration veilig herbevestigd omdat de live publicatie bij de audit nog
geen `chat_messages` en `notifications` bevatte, terwijl de chatclient Realtime
daadwerkelijk gebruikt.

Voer `migration repair` nooit uit als de live vergelijking aantoont dat een
oude migration niet volledig aanwezig is. Maak dan eerst een expliciete,
additieve herstelmigration.
