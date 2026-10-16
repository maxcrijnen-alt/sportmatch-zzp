# Audit van de 34 uitvoerbare SECURITY DEFINER-functies

Datum: 16 oktober 2026. Bron: read-only pg_proc/pg_get_functiondef en grants op
het bestaande productieproject fdlhhkwemjbctsmgwgvt, actuele main e8c3e95.
Geen onbekende functieversie uit een oude migration aangenomen.
Databaseguards uit PR #65 zijn na groene volledige CI eenmaal op productie
toegepast als versie 20261016094828. Bestandsnaam volgt de door de migration-tool
geregistreerde versie; geteste SQL-inhoud niet gewijzigd. De PR/releasecontrole
bevat de definitieve applicatie-deploymentstatus.

## Methode en grenzen

Voor alle 34: eigenaar postgres, SECURITY DEFINER, search_path='',
authenticated EXECUTE, anon geen EXECUTE. Functies gebruiken schema-gekwalificeerde,
geparameteriseerde statische SQL; geen dynamische SQL waarin clientinvoer wordt
geconcateneerd, geen OS/file/shell-executie. Geen SQL-injectie of admin-escalatie
aangetroffen in deze broninspectie. Geen volledige onafhankelijke penetratietest.

Autorisatie vergeleken met centrale is_admin/is_org_member/is_org_owner,
auth.uid(), private scope-/statushelpers, relatie-eigenaarschap en tabelgrants.
Admin is een database-rol in profiles, niet user_metadata; zelfregistratie kan
geen admin maken. Zelf-wijziging naar admin en demo_session_id is al door RLS
geblokkeerd en heeft bestaande negatieve regressies.

Definer is nodig waar het endpoint bewust beperkte Data API-grants/RLS omzeilt
om na autorisatie meerdere tabellen, private statuschecks, meldingen en chat
atomair bij te werken. Voor simpele eigen-rijmutaties is een aparte INVOKER-
variant technisch denkbaar, maar alleen na herontwerp van directe tabelgrants;
de huidige guard is geen reden voor een brede privilegewijziging.
Geen nieuwe definer-API of ruimere grant toegevoegd.
Pool-RPC's blijven SECURITY INVOKER. demo_sessions blijft service-role-only.

De onderstaande kwalificatie betreft de gecontroleerde toegang en bevindingen,
niet een garantie voor alle mogelijke racecondities of invoercombinaties.

## Per functie

| Functie | Authenticatie/autorisatie, scope en doel van definer | Classificatie / actie |
| --- | --- | --- |
| admin_list_organizations() | SELECT alleen WHERE is_admin(); volledige contactrijen bewust buiten client-kolomgrants | Geen kwetsbaarheid aangetroffen; behouden |
| admin_list_profiles() | Alleen is_admin(); volledige profielen, geen vrij te kiezen clientfilter buiten admin | Geen kwetsbaarheid aangetroffen; behouden |
| admin_review_force_majeure(uuid,boolean,text) | is_admin vóór update; alleen pending_review; statische notitie | Geen kwetsbaarheid aangetroffen; behouden |
| admin_set_subscription_status(uuid,subscription_status,integer) | is_admin vóór rechtenwijziging/event; supportbevoegdheid bewust organisatie-overstijgend | Geen kwetsbaarheid aangetroffen; behouden |
| apply_to_job(uuid,text,text,uuid[]) | Eigen instructeursprofiel, open job in scope, trial/abonnement, private VOG/review, segmenten en overlap; centrale atomische chat/notificatie | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| cancel_confirmed_job(uuid,text,boolean,text) | Bevestigde eigen instructeur of actief lid van joborganisatie; segmentmutaties alleen toegewezen lessen; 150%-registratie onveranderd | Geen kwetsbaarheid aangetroffen; behouden |
| cancel_subscription(uuid) | Expliciete auth, eigen instructeur/locatie-owner in scope of admin; lock; #61 sluit NULL-bypass | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| complete_job(uuid) | Actief job-organisatielid; bevestigd en alle segmenten toegewezen; centrale review/melding | Geen kwetsbaarheid aangetroffen; behouden |
| confirm_job(uuid) | Eigen geselecteerde instructeur, VOG/review/toegang/overlap; status werd niet opnieuw gecontroleerd | **Middel**: kon gesloten opdracht heropenen; nieuwe statusguard |
| confirm_job_segments(uuid) | Alleen eigen wachtende segmenten, VOG/review/overlap; actuele opdrachtstatus en abonnement ontbraken | **Middel**: gesloten/ontoegankelijke opdracht bevestigen; status- en bestaande accessguard toegevoegd |
| create_counteroffer(uuid,pay_type,integer,text) | Betrokken instructeur of actief job-organisatielid, eigen toegang, open job, positief bedrag | Geen kwetsbaarheid aangetroffen; behouden |
| current_demo_session_id() | Alleen eigen profiles-rij via auth.uid; demo-kolom is niet direct client-leesbaar | Geen kwetsbaarheid aangetroffen; behouden |
| decide_replacement(uuid,boolean) | Actief job-organisatielid, proposed-status; controle bij voorstel alleen was onvoldoende | **Hoog**: verlopen/ingetrokken VOG na voorstel kon worden goedgekeurd; private VOG opnieuw controleren, plus confirmed-job bij goedkeuring |
| demo_scope_matches(uuid) | Alleen booleaanse vergelijking met eigen scope; admin bewust overstijgend; #62 maakt NULL fail-closed | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| get_job_contact_details(uuid) | Alleen betrokkenen ná definitieve hele/segmentbevestiging; tegenpartijcontacten buiten algemene kolomgrants | Geen kwetsbaarheid aangetroffen; behouden |
| get_my_profile() | Alleen p.id=auth.uid; volledige eigen rij buiten publieke contactkolomgrants | Geen kwetsbaarheid aangetroffen; behouden |
| get_organization_private(uuid) | Actief lid van betreffende organisatie of admin; volledige rij buiten algemene kolomgrants | Geen kwetsbaarheid aangetroffen; behouden |
| has_pending_review(uuid) | Expliciete auth, alleen zelf of admin; private centrale query met scope | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| has_valid_vog(uuid) | Expliciete auth; zelf/admin of actieve organisatie voor instructeur in dezelfde scope; alleen ja/nee, geen document | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| instructor_public_stats(uuid) | Alleen target in eigen demo/prod-scope; aggregaten en uitsluitend vrijgegeven beoordelingen; centrale matching | Geen kwetsbaarheid aangetroffen; behouden |
| invite_instructor(uuid,uuid,text) | Actief job-organisatielid, open job, review, scope via private VOG, locatieaccess; centrale uitnodiging/chat/melding | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| mock_activate_subscription(uuid) | Expliciete auth, geldige eigen demosessie, eigen instructeur/locatie-owner in die demo; #61 hardening | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| open_job_matches() | Me-CTE op auth.uid; uitsluitend open opdrachten in eigen scope; matchingformule onveranderd | Geen kwetsbaarheid aangetroffen; behouden |
| propose_replacement(uuid,uuid,text) | Alleen eigen bevestiging, confirmed job, ander bestaand instructeursprofiel; bestaande trigger met private VOG/scope | Geen nieuwe kwetsbaarheid aangetroffen; behouden; definitieve check bij decide toegevoegd |
| record_no_show(uuid,text) | Actief job-organisatielid, bestaande definitieve bevestiging; uniek per job/instructeur | Geen toegangskwetsbaarheid aangetroffen; inhoudelijke juistheid blijft organisatieverantwoordelijkheid |
| refresh_document_statuses() | Alleen is_admin; alleen verlopen approved-documenten; centrale statusonderhoudsactie | Geen kwetsbaarheid aangetroffen; behouden |
| respond_counteroffer(uuid,boolean) | Alleen tegenpartij (eigen instructeur of actief job-organisatielid), pending offer | **Middel**: antwoord mogelijk na sluiten opdracht; open-status opnieuw controleren |
| respond_invitation(uuid,boolean,text) | Alleen eigen uitnodiging, pending, bij accepteren VOG/review/toegang; jobstatus ontbrak | **Middel**: reactie/melding op gesloten opdracht; open-status en scope opnieuw controleren |
| select_candidate(uuid,jsonb) | Actief job-organisatielid, open, VOG/review, locatieaccess en overlap; contactvrijgave pas na tweede akkoord | Geen nieuwe kwetsbaarheid aangetroffen; behouden |
| select_candidate_segments(uuid,uuid[],jsonb) | Actief job-organisatielid, open, VOG/review, eigen aansluitende segmenten en overlap | **Middel**: locatieaccess ontbrak t.o.v. hele opdracht; bestaande centrale accessguard toegevoegd |
| send_chat_message(uuid,text) | Eigen instructeur of actief chat-organisatielid; eigen toegang; geen vrije ontvangerparameter | Geen kwetsbaarheid aangetroffen; behouden |
| stop_job_search(uuid,text,text) | Actief job-organisatielid, open, geen bevestigde segmenten, vaste reden-allowlist | Geen kwetsbaarheid aangetroffen; behouden; downstream stale-acties nu geblokkeerd |
| submit_review(uuid,integer,text,uuid) | Betrokken bevestigde instructeur of actief organisatielid op completed job; reviewee afgeleid uit deelname; rating 1–5 | Geen kwetsbaarheid aangetroffen; behouden |
| withdraw_application(uuid) | Alleen eigen pending-reactie; beperkte statuswijziging | Geen kwetsbaarheid aangetroffen; behouden; INVOKER alleen na afzonderlijke grantanalyse |

Geen kritiek probleem gevonden. Eén hoge bevinding en meerdere middelzware
gevallen binnen twee groepen: verouderde workflowstatus en ontbrekende bestaande
toegangscontrole. Geen generieke conclusie dat de overige 28 functies
onkwetsbaar zijn.

## Gerichte oplossing en regressie

Migration: 20261016094828_revalidate_pending_workflow_actions.sql.
Alleen zes CREATE OR REPLACE-functies; geen rijmutaties, schema-/prijs-/trialwijzigingen.
Bestaande returntypes, grants, search_path en definer-eigenschappen behouden.
Opnieuw uitvoeren is idempotent; oude toegepaste migrations niet gewijzigd.

workflow_security_test.sql gebruikt nieuwe tijdelijke fixtures binnen BEGIN/ROLLBACK:
- Gesloten hele opdracht en lessenblok weigeren definitieve bevestiging.
- Gesloten opdracht weigert acceptatie van uitnodiging en tegenvoorstel.
- Opgezegd instructeursabonnement weigert segmentbevestiging.
- Opgezegd locatieabonnement weigert segmentselectie.
- VOG geldig bij voorstel maar verlopen bij goedkeuring wordt geweigerd.
- Afgeronde opdracht weigert vervangingsgoedkeuring.
- Andere organisatie kan vervanging niet goedkeuren.
- Geldige vervanging werkt; geweigerde acties veranderen geen status/toewijzing.
- Catalogus bewaakt alle 34 endpoints, anon-revokes, lege search_path,
  service-role-only demo_sessions en beide pool-RPC's als INVOKER.

Lokaal gereproduceerd tegen baseline: alle acht onderzochte status-/toegangs-
bypasses, inclusief confirm_job op whole_closed, zonder dat een review-/overlapgate
de test maskeerde. De gerichte tests slagen na de migration in PGlite, ook na
idempotent herhalen. PGlite vervangt alleen de onbeschikbare pgcrypto-extension
door de ingebouwde UUID-generator; dit is aanvullend bewijs, geen vervanging
voor de volledige PostgreSQL/Supabase-CI.

Bestaande smoke_test.sql en billing_security_test.sql blijven de positieve
kernflows en negatieve eigen/andere organisatie/instructeur/demo, VOG/review,
contactprivacy, self-admin, poolprivacy en commerciële rechten controleren.

## Advisor-uitkomst en vervolg

De 34 meldingen verdwijnen niet doordat geautoriseerde endpoints hun guards
verbeteren. Een massale revoke of INVOKER-conversie zou bestaande workflows breken.
demo_sessions zonder policy blijft intentioneel gesloten.
Leaked-password protection blijft een afzonderlijke Pro-keuze.

Werkelijke gelijktijdige acties/races en abuse-volume zijn niet exhaustief getest.
Nieuwe statuschecks voorkomen de aangetroffen opeenvolgende stale-acties;
geen claim van volledige serialiseerbaarheid. Behandel eventuele concurrentie-
problemen apart met reproduceerbare tests en consistente lockvolgorde.

[Supabase Advisor-uitleg](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
