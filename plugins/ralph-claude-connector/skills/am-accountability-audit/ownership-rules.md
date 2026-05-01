---
name: AM Accountability Audit — Ownership Rules
type: reference
skill: am-accountability-audit
updated: 2026-05-01
---

# Ownership Rules

Defines who is expected to own each type of inbound communication for accountability audit purposes. The skill compares the actual responder against the expected owner defined here and flags mismatches.

## Role Definitions

| Role                           | Person                                                                                        | Email                          | Scope                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Co-Founder, Strategic Accounts | Michael Ross                                                                                  | michael.ross@doxatalent.com    | Strategic relationships, executive escalations, pricing decisions, account commercial decisions, new business at the strategic level, client retention                                       |
| Senior Account Executive       | Naji Kubon                                                                                    | naji.kubon@doxatalent.com      | Hunting role: strategic prospecting, new client acquisition, deal structuring on accounts in his book, partnering with Michael on strategic accounts as a peer (not as a first-line AM)      |
| Operations Manager             | Vanessa Jamison                                                                               | vanessa.jamison@doxatalent.com | VIP HR/disciplinary, performance management, payroll alignment, internal coordination of placement issues                                                                                    |
| Team Leader / OM               | TLs and OMs (see TL/OM list)                                                                  | various @doxatalent.com        | First-line VIP performance, daily client check-ins, candidate readiness                                                                                                                      |
| Recruiters                     | Recruitment team                                                                              | various @doxatalent.com        | Candidate sourcing, screening, endorsement                                                                                                                                                   |
| DOXA Leaders                   | David Nilssen, Lauren Hoover, Stephen Hosemann, Steve Gire, Christina Chambers, Ralph Nilssen | various @doxatalent.com        | Internal leadership; their inbound to Michael is treated as leader request                                                                                                                   |

## Item Type → Expected Owner Matrix

| Item type | Detection signals | Expected owner |
|---|---|---|
| client_rate_confirmation | "Confirmation of Client Rate", "maintain the X% markup", rate sheet attachments | Michael |
| client_issue | Complaint, escalation, "not working", "concerned", "unhappy", "failed", "error", VIP performance complaint from client | Michael |
| client_referral_request | "Can you refer", "introduction to", "looking for someone who", "do you know" | Michael |
| client_question | Substantive question or request from active client that is not an issue | Michael |
| client_commitment_due | Inbound referencing a prior promise or asking for a deliverable | Michael |
| bench_inquiry | "Available bench", "can we redeploy", "fit for X account" | Michael |
| jo_administration | "Why was this JO closed", JO process, scope clarifications | Operations or recruiter |
| vip_performance | Performance concerns, PIP, termination | Vanessa Jamison with Michael loop-in |
| internal_leader_request | Sender is a DOXA leader (see Role Definitions) | Michael |
| cold_outreach_strategic | New logo prospecting on strategic account in Michael's book | Michael |
| cold_outreach_book | New logo prospecting on Naji's book | Naji |
| internal_other | Other internal action-required | Whoever workflow assigns; typically Operations |

## Mismatch Severity Matrix

| Mismatch flag | Trigger condition | Severity |
|---|---|---|
| naji_as_am | actual_responder = naji.kubon AND expected_owner = michael.ross AND item_type in (client_rate_confirmation, client_question, client_referral_request, bench_inquiry, client_issue) | Critical |
| michael_doing_ops_work | actual_responder = michael.ross AND expected_owner in (vanessa.jamison, recruiter, tl_om) | Major |
| wrong_doxa_person | actual_responder is DOXA but neither expected_owner nor a recognized escalation path | Minor |
| correct_owner | actual_responder = expected_owner | (no flag, log as correct) |

## Naji-as-AM Pattern (primary detection target)

Inbound is to "Michael and Naji" addressed (Michael in TO, Naji in TO or CC) where the item type is AM-level work. Naji responds first, often with placeholder language ("I will circle back"). Michael responds substantively later or not at all.

Why it matters. Naji's title (Senior Account Executive) implies hunting and peer-level partnering on strategic accounts, not first-line AM execution. When Naji functions as Michael's executive assistant on operational AM work, two costs emerge: Senior AE comp paying for AM-level execution, and Michael's role drift away from strategic engagement on accounts he should own.

## Designated Co-Owner Exceptions

Certain accounts may have explicit co-owner arrangements where another DOXA staff member is on the original `to` line as a designated co-owner. In those cases, response from the co-owner is not flagged as silent handoff. Add account-specific exceptions below as they are confirmed:

| Account | Co-owner | Email | Effective date | Notes |
|---|---|---|---|---|
| _none confirmed yet_ | — | — | — | Add entries as exceptions are validated during the 2-week tuning period |

## Out-of-Office Exceptions

If Michael's calendar shows OOO during a handoff period AND coverage was an explicit arrangement (logged in calendar or sent notification), the silent handoff flag is suppressed for that period.

## TL/OM Reference List

Match by first name + last name against sender display names and email localparts:

Aldair Vargas, Alexandria Tomonton, Annie Jimeno, Banjo Morales, Benny Castillo, Catherine Palma, Dyna Gallarda Llorca, Elena Barreneche, Ethel Matutina, Francis Rheberg, Ivan Villamante, Janette Darnayla, John Mark Robles, Jonathan Sanchez, Joshua Duban, Josimar Rincon, Juanito Cruzada, Julie Robles, Justin Linatoc, Kristine Osis, Lucille Ramos, Luis Bernabe, Maria Christina Carter, Mary Subastil, Michael Siega, Nancy Del Pilar, Ricardo Cueto Perneth, Rodrigo Inso, Roland Villegas Esguerra, Romar (Andi) Muñoz, Ronell Nicor, Ruelin Francisco, Ruther Salas, Shiena Morales, Vanessa Jamison, Veron (Nika) Gonzaga, Vincent Manalansan
