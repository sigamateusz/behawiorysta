-- A behaviorist may move a pending consultation to accepted or rejected. Survey columns stay closed to authenticated.

grant update (status) on public.consultations to authenticated;

create policy "consultations_update_behaviorist_decision" on public.consultations
  for update to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'behaviorist'
    )
  )
  with check (
    status in ('accepted', 'rejected')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'behaviorist'
    )
  );
