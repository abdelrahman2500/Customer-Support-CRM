# Story 225 — Forms and create flows

> CRM product redesign roadmap item **PR-4.4**. Intake: [`../../stories/create-forms-v2/create-forms-v2/intake.md`](../../stories/create-forms-v2/create-forms-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Stories 186 (FormField with `required`), 204 (Combobox).

## Story Goal

One form recipe for the five create flows, with markers, reasons and errors where they help.

**Non-goals:** edit forms; new validation.

## Design decisions

1. **Recipe** — `@crm/ui` `FormSection` (`fieldset`/`legend`, guidance, `columns` 1/2) and `FormActions` (children = submit + Cancel; `reason` + `reasonId` for the submit's `aria-describedby`; `error` as a `role="alert"` line beside the submit).
2. **Pages** — `max-w-3xl` page, PageHeader with "Fields marked * are required.", one `Card` holding sections: ticket (Customer / Ticket / Routing), customer (Customer), user (Person and sign-in / Branch and role), SLA policy (Applies to + guidance / Targets), article (Article / Content). Fields are `FormField density="comfortable"`; loading and load-error lines move into each field's hint/error.
3. **Reasons** — each view lists its missing required fields; `missingReason` joins them with `Intl.ListFormat` ("Still needed: Email, Password, … and Role."). The submit keeps its existing disabled rule.
4. **Customer picker** — `Combobox` (search, keyboard), same `customerId` and contact reset; the "create a customer" link moves to the field hint.
5. **Field order** kept where specs rely on it.

## Tasks

1. `form-layout.tsx` (+ spec, export); `form-reason.ts`; the five views; messages en/ar.
2. Specs: required-field label queries allow the aria-hidden "*"; the customer-list test opens the picker; loading-hint tests read the field from its hint; one contact-reset step uses `userEvent` (fireEvent alone doesn't reach the option after a Radix Select closes in jsdom) — reasons recorded; new user-form test (markers, reason, group, Cancel).

## Verification Steps

1. web/ui vitest, typecheck, lint, build; Playwright full suite.
2. Harness: the five forms at 390/1280 × en light / ar dark (sections, aria-required, overflow), the customer picker searched and picked twice in a real browser.

## Done Criteria

- [ ] Recipe + five forms + Combobox; payloads unchanged; suites green.
