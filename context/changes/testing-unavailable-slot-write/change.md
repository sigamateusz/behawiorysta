---
change_id: testing-unavailable-slot-write
title: Reject blocked, taken, and incomplete consultation writes
status: implementing
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Zapis niedostępnego terminu".
Risks covered: #1 Klient zapisuje konsultację na godzinę, którą behawiorysta właśnie zablokował, i oboje przychodzą na ten sam termin; #5 Dwóch klientów dostaje ten sam wolny termin i oba zapisy się udają; #6 Niepełna ankieta i tak tworzy konsultację. Test types planned: integracja HTTP.
Risk response intent: #1 prove a blocked day or hour does not persist a consultation even when the slot list was already open. #5 prove a second booking of the same free slot fails and does not create a second consultation. #6 prove a missing required survey field does not create a consultation even if the client skips the form.
After creating the folder, follow the downstream continuation rule.
