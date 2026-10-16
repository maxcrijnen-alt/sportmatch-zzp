# Gecontroleerde externe pilot — draaiboek

Bijgewerkt 16 oktober 2026. **NOT YET PILOT READY**. De externe pilot vereist
apart expliciet startakkoord; er zijn geen deelnemers benaderd.

## Besluit

**Nog geen externe pilot starten zolang Auth-mail niet voor externe ontvangers
is ingericht en gecontroleerd.** Het Supabase Dashboard bevestigt dat eigen SMTP
ontbreekt; de gebruiker heeft aangegeven nog geen dienst te hebben. De standaard
maildienst levert uitsluitend aan vooraf toegestane teamadressen, niet aan nieuwe
sportscholen/instructeurs. Dit is een concrete blocker voor wachtwoordherstel.
Zie [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Gekozen oplossing: Resend via bestaande Supabase Auth SMTP. Er is geen eigen
afzenderdomein in het gekoppelde Vercel-project en de eigenaar meldt geen provider-
toegang. Zie [exacte inrichting en externe acceptatietests](AUTH_EMAIL_SETUP.md).

## Verplichte technische gates

- Main vereist een PR plus actuele groene volledige CI; geen force-push,
  verwijdering of bypass. Een rode beveiligingstest blokkeerde de mergeknop.
- Reguliere accounts kunnen geen mockbetaling uitvoeren; bestaande trials en
  actieve rechten blijven behouden. Demo's kunnen hun eigen abonnement simuleren.
- VOG-/reviewstatus heeft persoonsautorisatie; demo→productie geeft strikt false.
  De private poule blijft onzichtbaar voor instructeurs en gebruikt centrale
  uitnodigingscontroles. Zie de hardeningverslagen in `docs/security/`.
- [PR #63](https://github.com/maxcrijnen-alt/sportmatch-zzp/pull/63) bevat dezelfde
  volledige browserreis voor Desktop Chrome en Pixel 7, uitsluitend met tijdelijke
  lokale accounts: registratie, onboarding/vestiging/zzp-profiel, plaatsing,
  reactie, selectie, beide akkoorden, agenda/meldingen, chat in beide richtingen,
  afronding en reviews die pas na beide beoordelingen worden vrijgegeven.
- PR #65 voegt registratie met verplichte bevestiging toe aan de geïsoleerde
  lokale stack: beide rollen ontvangen een echte Mailpit-mail, hebben daarvoor
  geen toegang en kunnen de link ook zonder registratiecookie openen.
  Desktop en mobiel doorlopen vervolgens de hele samenwerking.
- De Auth-suite controleert redirects, echte tokenverificatie, hergebruikte links,
  wachtwoordherstel, login/logout, sessies en te korte wachtwoorden via directe API.
  Een lokale Mailpit-test vraagt via het formulier een herstelmail aan en gebruikt
  de daadwerkelijk verzonden link. Geen mail naar echte gebruikers.
- Alle CI-tests moeten slagen zonder retries, skips of flaky resultaten. SQL draait
  in wegwerp-PostgreSQL; browser-E2E gebruikt een aparte lokale Supabase-stack.

## Auth-mail afronden vóór uitnodigen van echte gebruikers

1. Kies een SMTP-dienst en afzenderdomein; stel de vereiste domeinverificatie,
   SPF en DKIM bij de gekozen dienst in. Er is in deze opdracht geen dienst,
   account, domein of betaald abonnement aangemaakt.
2. Configureer host, poort, gebruiker, wachtwoord en geverifieerde afzender direct
   in [Supabase SMTP Settings](https://supabase.com/dashboard/project/fdlhhkwemjbctsmgwgvt/auth/smtp).
   Geen credentials in chat, Git of browsertest-artifacts opnemen.
3. Gebruik de geteste `supabase/templates/recovery.html` als hersteltemplate.
   Deze gebruikt `TokenHash` met `/auth/confirm`; de applicatie verwacht dit pad.
   Het Dashboard blokkeert aangepaste templates zolang eigen SMTP ontbreekt.
4. Site URL is gecontroleerd: `https://sportmatch-zzp.vercel.app`, met alleen
   dit domein in de redirect-allowlist. De CLI-config in Git is lokaal en past
   Dashboard-instellingen niet automatisch toe.
5. E-mailbevestiging staat momenteel uit. Schakel deze pas in met werkende SMTP
   én geverifieerde registratiefeedback/bevestigingsmail; verifieer daarna met een
   nieuw, expliciet aangewezen testaccount de echte externe ontvangst, bevestiging
   en recovery. Bestaande gebruikers/wachtwoorden zijn niet aangepast.

## Resterende hardening

- Leaked-password protection: Supabase weigerde inschakelen omdat Pro of hoger
  nodig is. De keuze voor een betaald plan ligt bij de eigenaar. Minimumlengte
  voor nieuwe/herstelde wachtwoorden staat op 8. Login laat bestaande wachtwoorden
  door Auth verifiëren, ook als ze onder het vroegere minimum zijn aangemaakt.
- `demo_sessions` zonder clientpolicy is bewust service-role-only.
- Alle 34 SECURITY DEFINER-functies zijn per functie beoordeeld in
  [de audit](security/DEFINER_AUDIT_2026-10-16.md). Zes RPC's krijgen actuele
  status-/VOG-/bestaande toegangsgates; anon-revokes en search_path blijven intact.
  De gerichte fixes/negatieve tests vervangen geen volledige
  onafhankelijke penetratietest. Kleine RLS-performancewaarschuwingen staan los
  van correcte autorisatie en blijven voor een aparte ronde.
- De oude authredirect-heartbeat staat `PAUSED`; andere automations zijn ongemoeid.

## Pilotafbakening

Gebruik na het wegnemen van de mailblocker een kleine, expliciet toegelaten groep
met echte documentcontrole. Er zijn geen echte deelnemers benaderd en geen echte
VOG's of accounts als testfixture gebruikt. Testresultaten zijn technische
regressiedekking, geen reeds uitgevoerde pilot.

Plan de proef binnen de bestaande 30-daagse trials. Er is geen echte betaalprovider:
zelf betaald activeren na de trial is bewust niet beschikbaar. Beslis vóór een
commerciële vervolgperiode over een server-side geverifieerd betaalpad; trek geen
bestaande klantrechten in als alternatief.

## Supabase Free of Pro

**Aanbeveling: Pro vóór een pilot met echte persoonsgegevens en VOG's.**
Capaciteit is niet de reden: de huidige read-only inventaris is 28 niet-demo-
profielen, circa 18,2 MB database en 0 Storage-objecten. Een voorgestelde pilot
met 6 deelnemers blijft ruim onder Free (50.000 MAU, 500 MB DB, 1 GB Storage,
5 GB egress). Chat-/documentgebruik meten; geen prognose als meting presenteren.

Pro begint volgens de [actuele prijspagina](https://supabase.com/pricing) bij
USD 25/maand met één project binnen de inbegrepen computecredits; extra gebruik
en add-ons kunnen kosten geven. Het biedt o.a. 7 dagen dagelijkse DB-back-ups,
langere logs en [leaked-password protection](https://supabase.com/docs/guides/auth/password-security).
Free kan na een week inactiviteit pauzeren. Voor echte pilotdata zijn herstelbaarheid,
beschikbaarheid en wachtwoordcontrole nuttiger dan extra quota.

Free is technisch mogelijk voor een kleine gecontroleerde pilot, maar vereist
bewust accepteren van ontbrekende leaked-password protection en een eigen
versleutelde back-up met hersteltest. Geen upgrade uitgevoerd. Pro lost SMTP,
domeineigendom of applicatie-autorisatie niet op. DB-back-ups bevatten volgens
[Supabase](https://supabase.com/docs/guides/platform/backups) geen opgeslagen
documentbestanden; regel Storage-back-up/retentie afzonderlijk. Geen PITR-add-on
of andere betaalde optie nodig zonder afzonderlijke afweging.

## Deelnemers, planning en uitvoering

Voorstel: **2 sportscholen, elk één contactpersoon, en 4 zzp-instructeurs**;
de eigenaar kiest de concrete personen en vraagt afzonderlijk startakkoord.
Alleen zelfgekozen e-mailadressen, geen bulkimport of ongevraagde uitnodigingen.
Eén beheerder houdt een besloten deelnemers- en incidentenlog bij.

| Moment | Handeling | Bewijs |
| --- | --- | --- |
| Voor dag 1 | PR #65 groen en live, migration gecontroleerd, SMTP/DNS en echte externe mail getest, bevestiging aan, back-up/incidentcontact afgesproken | Release-SHA, mailtestresultaten zonder tokens, eigenaar geeft startakkoord |
| Dag 1–2 | Beide scholen en vier instructeurs registreren en bevestigen; school maakt organisatie/vestiging, instructeur profiel/documenten | Juiste rollen, 30-daagse trials, geen toegang vóór bevestiging; beheerder controleert echte VOG via bestaande adminflow |
| Dag 3–7 | Per school minstens één echte passende opdracht; reageren/uitnodigen, tarief afspreken, beide akkoorden | Agenda, normale notificaties en tweezijdige chat bij beide partijen |
| Dag 8–14 | Opdrachten afronden, beide reviews, opnieuw samenwerken via private poule | Dubbelblinde reviewvrijgave; poule alleen school-zichtbaar; bulkuitnodigen met bevestiging en zonder duplicaten |
| Dag 14 | Terugblik met eigenaar; alle bugs geclassificeerd en besluit stoppen/beperkt vervolgen | Geen stilzwijgende verlenging of omzetting naar echte betalingen |

Trials starten via bestaande database-triggers bij instructeursprofiel/vestiging,
niet door een medewerker rechten te wijzigen. Geen trialverlengingen, mockbetaling
voor echte gebruikers of aanpassing van bestaande actieve rechten.
De bestaande 150%-annuleringsregistratie blijft gelden; geen gefingeerde annulering
in een echte samenwerking om een test uit te voeren. Test randgevallen lokaal.

## Feedback, veiligheid en succes

- Deelnemers melden via de afgesproken contactpersoon: tijd, rol, apparaat,
  verwacht/werkelijk gedrag en geanonimiseerde stappen. Geen wachtwoorden,
  volledige e-maillinks, VOG's of privéchats in een publiek GitHub-issue.
- Beheerder houdt het primaire log besloten; alleen geanonimiseerde technische
  bugs gaan naar GitHub. Triagering per werkdag; eigenaar benoemt vervanger.
- Kritiek/hoog: ongeautoriseerde toegang, datalek, verloren rechten of gebroken
  accounttoegang → pilot direct pauzeren, nieuwe uitnodigingen stoppen en
  geverifieerde fix/retest vóór hervatten. Geen productiegegevens resetten.
- Middel: belangrijke flow stuk zonder datalek → geen nieuwe samenwerking tot
  workaround/fix is beoordeeld. Laag: kleine visuele/tekstuele afwijking → backlog.
- Succes: alle 6 deelnemers bevestigen en onboarden; minimaal 2 opdrachten met
  beide akkoorden afgerond; agenda/chat/reviews en hergebruik poule werken;
  herstelmail bereikt de gecontroleerde externe mailboxen; geen open kritiek/hoog
  probleem en geen aangetaste rollen/trials/abonnementen.
- E-mailaflevering betreft echte ontvangst, niet alleen Accepted/Delivered bij de
  provider. Leg ook spam en SPF/DKIM/DMARC vast, op desktop en mobiele browser.

## Vrijgavechecklist

- [ ] Definitieve PR-CI groen: lint/types/build/DB en alle desktop/mobile/demo-tests.
- [ ] Nieuwe migration veilig eenmaal verwerkt; oude versies en productierijen behouden.
- [ ] Werkelijke Vercel-productie-SHA en publieke alias gecontroleerd na uitrol.
- [ ] Eigen SMTP en SPF/DKIM/DMARC geverifieerd; beide templates live.
- [ ] Externe herstel- en signupmails werkelijk ontvangen; mobiele links getest.
- [ ] Confirm email pas daarna ingeschakeld; bestaande accounts behouden toegang.
- [ ] Pro-keuze of expliciet Free-risico/back-upplan vastgelegd; Storage apart.
- [ ] Eigenaar selecteert deelnemers, incidentcontact en geeft expliciet startakkoord.
