-- Apply in Supabase SQL Editor for project: gfkqnumndbddqqwtkzrb
-- Purpose: allow hosted registration + hosted dashboard counts/lists.

alter table public.attendees enable row level security;

drop policy if exists attendees_select_public on public.attendees;
create policy attendees_select_public
on public.attendees
for select
to anon, authenticated
using (true);

drop policy if exists attendees_insert_public on public.attendees;
create policy attendees_insert_public
on public.attendees
for insert
to anon, authenticated
with check (true);
