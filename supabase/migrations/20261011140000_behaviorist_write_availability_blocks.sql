-- Behaviorist sessions can insert and delete availability blocks.
-- Select stays as granted in S-01. There is no update grant or update policy.

grant insert, delete on public.availability_blocks to authenticated;

create policy "availability_blocks_insert_behaviorist" on public.availability_blocks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'behaviorist'
    )
  );

create policy "availability_blocks_delete_behaviorist" on public.availability_blocks
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'behaviorist'
    )
  );
