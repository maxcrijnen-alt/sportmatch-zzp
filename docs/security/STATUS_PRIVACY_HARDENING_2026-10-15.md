# Statusprivacy en demo-scope — 15 oktober 2026

## Concrete bevindingen

De eerdere audit wees op twee rechtstreeks uitvoerbare statusfuncties die voor
iedere UUID binnen dezelfde scope een boolean gaven. Demo-scope alleen is geen
persoonsautorisatie. De nieuwe publieke wrappers controleren daarom:

- Openstaande review: alleen de betrokkene en beheerders.
- VOG-geschiktheid: betrokkene, beheerders en actieve organisatieleden binnen
  dezelfde scope. Dit is de bestaande kandidaatcatalogus, inclusief nog niet
  uitgenodigde kandidaten. Instructeurs kunnen elkaars status niet opvragen.
- De oorspronkelijke centrale queries staan ongewijzigd in `private`, zonder
  execute voor anon/authenticated. De acht bestaande SECURITY DEFINER-workflows
  gebruiken deze interne checks. Zo blijven onder meer vervangingsvoorstellen,
  verplichte reviews en VOG-controles dezelfde businessregels gebruiken.
- De poule-RPC's blijven SECURITY INVOKER; hun autorisatie wordt niet verruimd.

Een extra negatieve test toonde dat `demo_scope_matches(NULL)` bij een demo
NULL gaf. `IF NOT ...` in een workflow wees die waarde niet af: de aanvraag
bereikte de VOG-controle in plaats van de demo-/productiegrens. De helper geeft
nu expliciet false bij die vergelijking. RLS behandelde NULL al als niet
toegestaan; de bedoelde scopebetekenis blijft gelijk. De regressie gebruikt een
goedgekeurde synthetische demo-VOG om niet toevallig door een andere gate te slagen.

## Verificatie en uitrol

[Volledige CI 38763926573](https://github.com/maxcrijnen-alt/sportmatch-zzp/actions/runs/38763926573):
lint, TypeScript, build, alle migrations/SQL-tests en 125 browsertests geslaagd,
zonder failed/skipped/flaky tests. Negatieve cases controleren de precieze
autorisatieafwijzing voor vreemde organisaties, instructeurs en demosessies bij
uitnodigen, reageren, kiezen, bevestigen, vervangen, afronden en chatten.

Geteste SQL eenmaal op het bestaande Supabase-project toegepast. De tool
registreerde versie `20261015155522`; alleen de nieuwe bestandsnaam is daarmee
gelijkgezet, zonder de SQL-inhoud achteraf te wijzigen. Geen bestaande rijen,
oude migrations of history repairs. CI wordt opnieuw uitgevoerd vóór merge.

De SECURITY DEFINER Advisor blijft de bewust geautoriseerde publieke workflows
signaleren; een waarschuwing is geen bewijs van een resterende kwetsbaarheid.
De audit uit PR #59 blijft historische context. Deze PR behandelt de concrete
statusprivacy- en NULL-scopebevindingen, geen algemene herschrijving van RPC's.
