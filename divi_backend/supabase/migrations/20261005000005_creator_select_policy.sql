-- Allows INSERT ... RETURNING to see a newly created Divi without relying on
-- a membership lookup that may not see the row during the same statement.
drop policy if exists "divi creators can view their own divis" on public.divis;

create policy "divi creators can view their own divis"
on public.divis
for select
to authenticated
using (creator_id = (select auth.uid()));
