# Gecontroleerde pilot — technische checklist

## Besluit

**Nog geen externe pilot starten zolang Auth-mail niet voor externe ontvangers
is ingericht en gecontroleerd.** Het Supabase Dashboard bevestigt dat eigen SMTP
ontbreekt; de gebruiker heeft aangegeven nog geen dienst te hebben. De standaard
maildienst levert uitsluitend aan vooraf toegestane teamadressen, niet aan nieuwe
sportscholen/instructeurs. Dit is een concrete blocker voor wachtwoordherstel.
Zie [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

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
  staat geverifieerd op 8, gelijk aan de bestaande formulieren en lokale CI.
- `demo_sessions` zonder clientpolicy is bewust service-role-only.
- De 34 SECURITY DEFINER-meldingen zijn een auditlijst, geen 34 bewezen
  kwetsbaarheden. De gerichte fixes/negatieve tests vervangen geen volledige
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
