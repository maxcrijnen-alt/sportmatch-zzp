-- SportMatch ZZP — 0004: realtime voor chat en notificaties
-- Voegt de tabellen toe aan de realtime-publicatie zodat de browser direct
-- nieuwe berichten en meldingen ontvangt. RLS blijft gelden voor wie wat ziet.

do $$
begin
  -- Alleen op omgevingen met een realtime-publicatie (Supabase); lokale
  -- testdatabases slaan dit over.
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
