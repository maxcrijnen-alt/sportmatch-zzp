# Auth-mail voor de externe pilot

Gecontroleerd op 16 oktober 2026. **Niet geactiveerd in productie.**

## Keuze en huidige toegang

Resend via de bestaande Supabase Auth SMTP-configuratie. Geen SDK, Edge Function,
tweede mailsysteem of nieuwe Supabase/Vercel-projecten nodig.
De gekoppelde Vercel-configuratie heeft uitsluitend vercel.app-domeinen.
Dat is geen eigen afzenderdomein waarop SportMatch SPF/DKIM kan publiceren.
De eigenaar meldt geen toegang tot een mailprovider te hebben.
Eigen SMTP staat in het bestaande Supabase-dashboard uit.

Benodigd van eigenaar: een eigen domein (of expliciete toestemming voor aankoop),
DNS-beheertoegang en een eigen Resend-account. Geen domein gekocht, DNS gewijzigd,
account aangemaakt, voorwaarden geaccepteerd of betaald plan gestart.

## Exacte handmatige inrichting

1. Maak zelf een gratis [Resend-account](https://resend.com/signup), met MFA.
   Kies het Transactional Free-plan; geen betaalde opties/overages activeren.
2. Open [Domains](https://resend.com/domains), voeg een eigen verzendsubdomein toe:
   bijvoorbeeld auth.JOUW-DOMEIN. Kies een Europese regio als die beschikbaar is.
   Maak geen claim op een domein van een andere organisatie.
3. Exporteer de door **jouw** Resend-domein gegenereerde DNS-records.
   De DKIM-sleutel en regiogebonden MX-target zijn pas na deze stap bekend.
   Deze waarden zijn niet te berekenen zonder het account/domein; onderstaande
   labels zijn instructies, geen uitvoerbare/fictieve DNS-records.

| Doel | Type | Exact te gebruiken naam/waarde |
| --- | --- | --- |
| DKIM | TXT | Naam en volledige p=... sleutel letterlijk uit Resend Domains |
| SPF voor bounce/Return-Path | TXT | Resend-hostnaam en SPF-waarde letterlijk uit Domains; publiceer geen tweede SPF-record op dezelfde host |
| Bounce-aflevering | MX | Door Resend getoonde host, regiogebonden target en prioriteit |
| DMARC voor het verzendsubdomein | TXT | _dmarc.auth.JOUW-DOMEIN; begin met v=DMARC1; p=none en controleer alignment; voeg alleen een rua-adres toe dat je beheert |

Pas DNS pas na expliciete toestemming van de eigenaar aan. Laat bestaande
website-/inboxrecords ongemoeid. Sommige DNS-beheerders vullen het hoofddomein
zelf aan: voorkom een dubbele suffix. Zet proxying op DNS-only indien relevant.
Klik Verify in Resend tot SPF en DKIM Verified zijn; controleer DMARC bij de
ontvangen mail. Schakel open-/clicktracking uit voor Auth-mails.

4. Maak in Resend een sleutel met alleen Sending access voor het geverifieerde
   domein. Bewaar deze in een wachtwoordmanager; geen sleutels in chat, Git,
   terminalscreenshots of rapporten.
5. Vul uitsluitend in [Supabase → Authentication → Email → SMTP Settings](https://supabase.com/dashboard/project/fdlhhkwemjbctsmgwgvt/auth/smtp):

| Instelling | Waarde |
| --- | --- |
| Enable custom SMTP | Aan |
| Sender email | Bijvoorbeeld no-reply@auth.JOUW-DOMEIN; moet bij Verified domain horen |
| Sender name | SportMatch |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | Jouw Resend Sending access API key, uitsluitend in dit wachtwoordveld |

Sla op en herlaad ter controle zonder het wachtwoord zichtbaar te maken.
SMTP-poort/gebruikersnaam volgen de officiële Resend Supabase-handleiding.

6. Onder Authentication → Email → Templates:
   - Confirm signup: onderwerp **Bevestig je SportMatch-account**;
     inhoud letterlijk uit supabase/templates/confirmation.html.
   - Reset password: onderwerp **Herstel je SportMatch-wachtwoord**;
     inhoud letterlijk uit supabase/templates/recovery.html.
   - Gebruik TokenHash via /auth/confirm, geen ConfirmationURL die de SSR-sessie
     in een URL-fragment terugstuurt.
   - Laat verplichte e-mailbevestiging voorlopig **uit**.
7. URL Configuration:
   - Site URL: https://sportmatch-zzp.vercel.app
   - Redirect allowlist uitsluitend eigen benodigde URLs. De Auth-flows in deze
     repo gebruiken /auth/confirm?next=/onboarding en
     /auth/confirm?next=/wachtwoord-herstellen.
   - Geen wildcard voor willekeurige *.vercel.app-projecten.
   - Gebruik localhost alleen met de geïsoleerde lokale Supabase-configuratie.
     Preview-apps niet aan productie-Auth hangen om echte accounts te testen.

## Misbruik en afleverlimieten

- Supabase Auth blijft de server-side rate limiter; geen vluchtige
  geheugenlimiter in serverless processen als schijnbeveiliging.
- Productie: begin met 60 seconden tussen mails per adres en de standaard
  30 Auth-mails/uur na custom SMTP. Controleer de actuele dashboardwaarden.
  Verhoog alleen na gemeten pilotgebruik; geen onbeperkte verzending.
- Resend Free heeft volgens de actuele documentatie 100 mails/dag; houd beide
  limieten in de gaten. SMTP-capaciteit en Supabase-plan zijn aparte limieten.
- Wachtwoordherstel toont hetzelfde antwoord voor bekende/onbekende adressen.
  Bevestigde duplicaatregistraties krijgen dezelfde vervolginstructie als nieuwe.
  Geen e-mailadressen, tokens of wachtwoorden loggen.
- CAPTCHA is nog niet geconfigureerd. Voor brede open registratie eerst
  Turnstile/hCaptcha met eigen account/keys toevoegen en de server-side
  captchaToken-verificatie testen. Een kleine pilot is geen botbeveiliging voor
  een publieke registratie-URL.
- Een e-mailscanner kan een eenmalige GET-link verbruiken. Tracking uitschakelen
  voorkomt herschrijven, maar bewijst geen scannerbestendigheid. Test de echte
  mailclients van de pilot. Bij scannerproblemen eerst een expliciete
  bevestigingspagina/OTP implementeren; niet de tokencontrole verzwakken.
- Geannuleerde/ongeldige/gebruikte links openen geen nieuwe sessie.
  Een fout op /login?fout=link-verlopen is zichtbaar. Bestaande sessies blijven
  door de huidige Auth-flow behouden.

## Verplichte externe acceptatie vóór bevestiging inschakelen

Gebruik alleen nieuwe, door de eigenaar beheerde testmailboxen.
Geen bestaande productieaccounts resetten of ongevraagd mailen.
Leg per test vast: tijd, type, afleverresultaat/spam, SPF/DKIM/DMARC pass/fail,
browser/device en resultaat. Bewaar geen token-URL, headers met persoonsgegevens
of mailboxinhoud in publieke GitHub-issues.

1. Uitrol van PR #65 en gecontroleerde migration; huidige productie-SHA vastleggen.
2. Met bevestiging nog uit: herstelmail naar een gecontroleerd bevestigd account;
   werkelijke ontvangst en wijziging/herinloggen testen op desktop en mobiel.
3. Voor signup-bevestiging: gecontroleerd vrijgavemoment met eigenaar. Controleer
   eerst aantallen bestaande bevestigde/onbevestigde accounts; geen bulkmutatie.
   Bevestiging aanzetten kan nieuwe registratie tijdelijk blokkeren bij fouten.
4. Schakel Confirm email pas in als SMTP, beide templates, URL-instellingen en
   de geteste bevestigingsfeedback live staan. Registreer twee aangewezen nieuwe
   accounts (sportschool/instructeur), ontvang echte mails en volg links ook
   zonder registratiecookie op mobiel.
5. Verifieer vóór bevestiging: geen login, onboarding of database-toegang.
   Na bevestiging: juiste rol, onboarding, normale trial en login.
6. Test hergebruik/ongeldige links, bestaande-account-login, demo en entitlement.
   Een echt verlopen link vereist gecontroleerd wachten of een aangewezen
   stagingaccount; verander nooit productie-tokenvelden om een test te forceren.
7. Bij mailfalen: stop nieuwe pilotregistraties en los SMTP/template op.
   Laat bestaande rechten/sessies ongemoeid. Geen algemene bulkconfirm en geen
   automatisch uitschakelen van bevestiging als workaround.

Een externe mailtest is pas geslaagd na daadwerkelijke ontvangst bij de
aangewezen mailbox. Mailpit en admin.generateLink zijn hiervoor geen vervanging.

## Bronnen

- [Resend met Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Resend-domeinen en eigendom](https://resend.com/docs/dashboard/domains/introduction)
- [DNS-records beheren](https://resend.com/docs/dashboard/domains/manage-domains)
- [Supabase SMTP, limieten en misbruik](https://supabase.com/docs/guides/auth/auth-smtp)
- [Auth-rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Emailtemplates, scanners en tracking](https://supabase.com/docs/guides/auth/auth-email-templates)
