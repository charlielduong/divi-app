grant insert, update, delete on public.divi_allocations to authenticated;

create policy "divi creators can manage allocations"
on public.divi_allocations for all to authenticated
using (public.can_manage_divi(divi_id))
with check (public.can_manage_divi(divi_id));
