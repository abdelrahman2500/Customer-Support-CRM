# Story 215 — Demo dataset

> CRM product redesign roadmap item **PR-3.0**. Intake: [`../../stories/demo-dataset/demo-dataset/intake.md`](../../stories/demo-dataset/demo-dataset/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; decision PD-6.

## Prerequisites

The base seed (roles); a migrated database.

## Story Goal

A realistic, self-contained demo branch the redesigned screens can be shown with.

**Non-goals:** schema changes; CI; production.

## Design decisions

1. **Isolation** — its own branch "Riyadh Support (Demo)" (Asia/Riyadh) and department, so the demo board never shows e2e fixtures and other branches are never touched. Demo users get `activeBranchId` = the demo branch.
2. **Idempotency** — every row's id is a deterministic v5-shaped UUID from a stable key (`sha1("crm-demo:<key>")`); all writes are upserts; a seeded PRNG makes the mix reproducible; re-runs refresh timestamps relative to now.
3. **People** — admin `nadia@demo.example` (SuperAdmin) and agents sara/omar/lina/daniel/maya `@demo.example` (Agent); password from `DEMO_USER_PASSWORD` (≥ 8 chars), refused otherwise, like the base seed. Portal access for `layla@desert-rose.demo.example`.
4. **Tickets** — 36 OPEN / 28 IN_PROGRESS / 32 RESOLVED / 24 CLOSED; priorities ~10% urgent, 25% high, 45% medium, 20% low; 5 categories; ~45% of open tickets unassigned. Per-priority SLA policies (response/resolution min: urgent 60/480, high 180/1440, medium 480/4320, low 1440/7200). Active tickets are placed on the **response** window (the UI governs by the earliest target): ~50% on track, 25% at risk, 15% breached, 10% on hold (`onHoldSince`). Resolved/closed tickets: 2–20 days old with `resolvedAt`.
5. **Activity** — `ticket.created` history for every ticket, `ticket.updated` by the assignee once worked; ~80% with a conversation (inbound opener, agent reply, customer follow-up when resolved; web form, email or live chat); ~35% with an internal note; ~65% of resolved/closed with CSAT. Mixed English/Arabic content.
6. **Knowledge base** — one category, four published articles with Arabic translations (search works: `search_vector` is generated).

## Tasks

1. `prisma/seed-demo.ts`; `prisma:seed:demo` script.
2. Run twice; compare counts; check the SLA spread.
3. Harness as a demo agent and the demo portal contact.

## Verification Steps

1. api lint and typecheck (`tsconfig.typecheck.json` includes `prisma/`).
2. Idempotency: identical counts across two runs.
3. Harness sign-in as `sara@demo.example` / Layla.

## Done Criteria

- [ ] Seed + script; idempotent; SLA spread; screens render with it.
