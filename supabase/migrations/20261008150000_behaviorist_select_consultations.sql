-- A behaviorist session can read client submissions. Status and time stay a view concern.

create policy "consultations_select_behaviorist" on public.consultations
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'behaviorist'
    )
  );
