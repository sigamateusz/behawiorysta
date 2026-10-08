-- Lokalne dane do dwóch brakujących sprawdzeń widoku behawiorysty.
-- Uruchom w Studio (SQL), zalogowany jako postgres. Nie jest to migracja.
--
-- Najpierw wykonaj tylko sekcję A i otwórz oba adresy. Potem sekcję B.
-- Po pustym stanie wykonaj sekcję C, żeby wrócić do obecnych czterech zgłoszeń.

-- A. Niewidoczne, ale istniejące wiersze ------------------------------------
-- Luna: accepted, slot 5.10.2026 10:00 Warszawa już się skończył.
-- Reks: rejected. Obaj mają zostać 404 bez pól ankiety.

insert into public.consultations (
  id,
  client_id,
  dog_name,
  breed,
  age_years,
  age_months,
  basic_info,
  goals,
  slot_start,
  status,
  created_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '2353acb9-405b-4540-ab81-a79bd226a8b2',
    'Luna',
    'Owczarek niemiecki',
    3,
    2,
    'Luna: to pole nie może pojawić się na stronie szczegółów.',
    'Luna: cele, których behawiorysta nie powinien zobaczyć.',
    timestamptz '2026-10-05 08:00:00+00',
    'accepted',
    timestamptz '2026-10-01 12:00:00+00'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '2353acb9-405b-4540-ab81-a79bd226a8b2',
    'Reks',
    'Bokser',
    1,
    0,
    'Reks: to pole nie może pojawić się na stronie szczegółów.',
    'Reks: cele, których behawiorysta nie powinien zobaczyć.',
    timestamptz '2026-10-09 09:00:00+00',
    'rejected',
    timestamptz '2026-10-01 12:05:00+00'
  )
on conflict (id) do nothing;

-- http://localhost:4321/dashboard/11111111-1111-4111-8111-111111111111
-- http://localhost:4321/dashboard/22222222-2222-4222-8222-222222222222
-- Oczekiwane: status 404 i tekst „Nie ma takiego zgłoszenia.”
-- Na stronie nie ma być imienia, rasy, wieku, opisu, celów ani terminu.

-- B. Pusty zbiór -------------------------------------------------------------
-- Odkomentuj i uruchom samą tę sekcję. Cztery obecne zgłoszenia są pending,
-- więc tylko one są teraz widoczne. Po zmianie na rejected lista i siatka
-- mają pokazać „Nie ma zgłoszeń do pokazania.”
--
update public.consultations
set status = 'rejected'
where id in (
  '993a0fae-d218-4bca-9ef6-4ca414afad41',
  '1c9de363-ee38-4b29-896c-802779aacc84',
  'abcf92b0-387f-4d42-b0dc-1a63acfd147a',
  '39669bf7-d39e-4d3c-b05f-f91e53e2670b'
)
and status = 'pending';

-- C. Przywrócenie czterech zgłoszeń -----------------------------------------
-- Odkomentuj po sprawdzeniu pustego stanu.
--
update public.consultations
set status = 'pending'
where id in (
  '993a0fae-d218-4bca-9ef6-4ca414afad41',
  '1c9de363-ee38-4b29-896c-802779aacc84',
  'abcf92b0-387f-4d42-b0dc-1a63acfd147a',
  '39669bf7-d39e-4d3c-b05f-f91e53e2670b'
)
and status = 'rejected';
