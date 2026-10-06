# Demo script

A 15–20 minute walkthrough of the Customer Support CRM: the agent workspace, then the customer portal, then the details that make it production-grade (Arabic, dark mode, accessibility). Each step says what to click and what to point out.

## Before the demo

The demo runs on its **own database** (`crm_demo`) and its own Redis database (1), never on the dev database that automated tests write to. Test runs therefore cannot leave "e2e" tickets, roles or webhooks in the demo.

1. **Infrastructure.** Start Postgres and Redis (`docker compose up -d postgres redis`, see the main `README.md`). `apps/api/.env` must exist: the demo derives its connection settings from it.
2. **Reset the demo data — right before the demo.** SLA timers are relative to the moment of seeding, so a fresh reset gives live "at risk" and "breached" examples:

   ```
   DEMO_USER_PASSWORD=<choose one> pnpm demo:reset
   ```

   This drops and rebuilds only `crm_demo` (every migration, the base seed, then the demo seed) and flushes only Redis database 1. It is safe to repeat, and it refuses to run against the dev (`crm`) or test (`crm_test`) databases. It takes about a minute.

3. **Start the API and the worker against the demo data**, each in its own terminal:

   ```
   pnpm demo:api
   pnpm demo:worker
   ```

   The worker runs SLA timers, emails and AI jobs. Without it, the board still works but SLA breaches are not escalated live.

4. **Start the two web apps** (they talk to the API on `:3001`, whichever database it uses): `pnpm --filter @crm/web dev` (workspace, `http://localhost:3000`) and `pnpm --filter @crm/portal dev` (portal, `http://localhost:3002`) — or `build` then `start` for production speed.

5. **Accounts** (all use the password you chose):

   | Role | Email |
   |---|---|
   | Agent | `sara@demo.example` (also `omar`, `lina`, `daniel`, `maya`) |
   | Admin | `nadia@demo.example` |
   | Portal customer | `layla@desert-rose.demo.example` |

   The branch "Riyadh Support (Demo)" holds 39 tickets (12 open, 9 in progress, 10 resolved, 8 closed) for 14 customers, each with its own subject and a conversation that matches it. It also holds a bilingual knowledge base of 8 articles in 3 categories, 6 quick replies (2 in Arabic) and 2 automation rules.

6. **Open two browser windows** side by side: the workspace and the portal.

### What Sara should see right after a reset

| Where | Expected |
|---|---|
| After sign-in | The **Tickets board** (sign-in lands on the board, not the dashboard) |
| Mine | 5 active tickets assigned to her |
| Her tickets at risk | 2 (Nakheel's, and Desert Rose's "Charged twice for the annual renewal") |
| Her tickets breached | 1 (Medina Pharma's "Pharmacist accounts locked after password policy change") |
| Unclaimed (dashboard) | 6 |
| Board → At risk | about 8 open or in-progress tickets team-wide; resolved and closed tickets are never "at risk" |
| Navigation | Work, Configure, Admin and Account only — Reports, Audit log, Automation rules, Roles, Webhooks, API keys and Settings are administrator destinations and are not shown to agents |

The SLA clocks keep running, so counts drift over the hour after a reset: tickets move from "on track" to "at risk" to "breached".

### AI: decide before the demo

AI assist (ticket summary and suggested reply) and the portal assistant need two things:

1. an Anthropic key in `apps/worker/.env` (`ANTHROPIC_API_KEY=…`, optionally `ANTHROPIC_MODEL`), with the worker running;
2. AI switched on for the branch: as Nadia, **Settings → AI**.

**The recommended demo path keeps AI out of the main flow.** Show it only if both are in place and you have tried it once before the audience arrives. When AI is off, the product says so on purpose. The ticket's AI card shows "AI assist isn't connected here" and explains that everything else on the ticket works as usual. The portal assistant shows "The assistant isn't available right now" with a **Talk to a person** button that opens a ticket. If a provider call fails, both show an error instead of waiting forever; the portal still offers **Talk to a person**. AI output is never simulated.

## 1. The agent's day (workspace, as Sara)

1. **Sign in.** Point out the split layout and that "Forgot password?" tells the agent to ask an administrator — there is no reset email flow. Sign-in lands on the **Tickets board**.
2. **Board.** Columns by status with the coloured status spine; cards carry priority, the SLA state and the assignee. Use **Mine** and **At risk** in the quick views and the **SLA urgency** sort. An SLA badge reads "Response due/breached" until an agent has replied, then "Resolution due/breached".
3. **Move a ticket.** Drag a card from *In progress* to *Resolved*. Moving to Resolved or Closed asks for confirmation. Then show the keyboard way: focus a card's drag handle, Space, arrow keys, Space — every step is announced. The **⋯** menu offers "Move to…" too.
4. **Open a ticket** — Desert Rose's "Charged twice for the annual renewal" is a good one. The header owns the state: subject, status, priority, SLA countdown, "Assign to me" and the status action. The conversation shows messages, internal notes and history in one timeline (with filters). Reply with Enter; switch to **Internal note**; type `@` to mention a colleague; attach a file; insert a **quick reply**.
5. **Inspector.** Customer context (who raised it, their other tickets), properties and KB references (search and attach an article). AI assist appears here — see "AI" above.
6. **Previous / next** in the header walks the board's order without going back. On a phone, Conversation and Details become a switch.
7. **Dashboard** (Work → Dashboard). Sara's shift in four numbers: assigned to her, unclaimed, at risk and breached. Each opens the board already filtered. Below: tickets by status, her open tickets, her tasks, and unclaimed tickets she can claim in one click.

## 2. Running the team (as Nadia)

1. **Customers.** The list with avatars and filters; open "Desert Rose Hotels": contacts, portal access, and their tickets — "View these tickets on the board" filters the board to them.
2. **Knowledge base.** Articles open in reading mode; "Edit article" switches to the editor with English and Arabic tabs.
3. **Reports.** The headline numbers (tickets, resolution SLA met with the response rate beneath it, average CSAT, average resolution time) sit above the charts. The SLA card shows **response** and **resolution** separately. A response is met by the first agent reply. Only tickets whose target time has passed, or was met, are counted, so the figures match the badges on the board. Set a period and a department: the URL carries the filters, so the view can be bookmarked or shared. Save it as a saved view. Export any card to CSV.
4. **Admin.** Users and roles read as lists; editing opens a side sheet (roles show permissions grouped by area). Configuration screens share one vocabulary: an active badge, "New …" dialogs, and the same loading, error and empty states. **Quick replies** and **Automation rules** ("Billing questions go to Omar", a least-loaded pool) come seeded. The **Audit log** names actions in plain language and opens each change set in a sheet.
5. **Branding** (Settings). A branch colour tints the brand edges at once. If the colour would fail contrast, the accessible default accent stays — try a pale yellow to show it.

## 3. The customer's side (portal, as Layla)

1. **Home.** Three things a customer comes to do — raise a ticket, search help articles, ask the assistant — then her recent tickets with the same status colours the agent sees, and help highlights. Layla has tickets in every status.
2. **Raise a ticket.** Fill in the subject, submit, and land straight on the new ticket.
3. **Find it in the workspace.** The board refreshes every 30 seconds and when the window regains focus. A new ticket has no SLA urgency yet, so it may sit low in its column: type its subject in the board's search, or set **Sort → Newest**.
4. **Talk.** Write a message in the portal ticket's conversation; reply from Sara's window; each side sees the other's message arrive live. Layla gets one "New reply" notification per reply, in the bottom corner.
5. **Resolve and rate.** Resolve the ticket from the workspace; in the portal, the feedback request now comes first on the ticket. A closed ticket explains how to get more help.
6. **Help centre.** Search articles; open one in the reading layout; "Still need help?" offers the assistant or a new ticket.

## 4. Built for everyone

- **Arabic.** Switch the language from the user menu: the whole layout mirrors, the chosen theme stays, numbers stay in Latin digits, and an English subject or message inside the Arabic UI still reads correctly.
- **Dark mode.** Switch the theme (system, light, dark) from the same menu; charts, badges and the brand stay legible.
- **Phone.** Narrow the window: the board shows one column at a time with a column switcher, tables become cards, filters move into a sheet, the portal's navigation into a menu.
- **Keyboard and screen readers.** Every page has its own title; Tab reaches every control with a visible focus ring; errors and new messages are announced.

## Not in this demo

- **Email, WhatsApp and SMS channels**: the providers are not chosen yet; tickets come from the portal and the workspace.
- **Arabic names for ticket categories**: categories have a single name (the seeded ones are English); a translated name needs a schema change.
- **Password reset by email**: administrators reset passwords.

## If something goes wrong

- **No "at risk" or "breached" tickets:** the data is too old — run `pnpm demo:reset` again.
- **Test tickets ("e2e …") or extra roles appear:** the API is running against the dev database. Stop it and start `pnpm demo:api`.
- **"Too many requests":** the API rate-limits list requests (100 per minute); wait a minute.
- **AI says it isn't available:** expected unless AI is configured (see "AI" above); continue with the next step.
