# Demo script

A 15–20 minute walkthrough of the Customer Support CRM: the agent workspace, then the customer portal, then the details that make it production-grade (Arabic, dark mode, accessibility). Each step says what to click and what to point out.

## Before the demo

1. Start the infrastructure and the apps (see the main `README.md`): Postgres, Redis, the API on `:3001`, the agent workspace on `:3000`, the portal on `:3002`.
2. Load the demo dataset **right before** the demo. Its SLA timers are relative to the moment it is seeded, so a fresh seed gives you live "at risk" and "breached" examples:

   ```
   DEMO_USER_PASSWORD=<choose one> pnpm --filter @crm/api prisma:seed:demo
   ```

   It creates the branch "Riyadh Support (Demo)" with about 120 tickets, customers, conversations, a bilingual knowledge base and these accounts (all with the password you chose):

   | Role | Email |
   |---|---|
   | Agent | `sara@demo.example` (also `omar`, `lina`, `daniel`, `maya`) |
   | Admin | `nadia@demo.example` |
   | Portal customer | `layla@desert-rose.demo.example` |

3. Open two browser windows side by side: the workspace (`http://localhost:3000`) and the portal (`http://localhost:3002`).

## 1. The agent's day (workspace, as Sara)

1. **Sign in.** Point out the split layout and that "Forgot password?" tells the agent to ask an administrator — there is no reset email flow.
2. **Dashboard.** The four numbers at the top are Sara's shift: assigned to her, unclaimed, at risk and breached. Each one opens the board already filtered. Below: tickets by status, her open tickets as cards, her tasks, and unclaimed tickets she can claim in one click.
3. **Board** (Tickets). Columns by status with the coloured status spine; cards carry priority, the SLA state and the assignee. Use **At risk** in the quick views and the **SLA urgency** sort.
4. **Move a ticket.** Drag a card from *In progress* to *Resolved*. Moving to Resolved or Closed asks for confirmation. Then show the keyboard way: focus a card's drag handle, Space, arrow keys, Space — every step is announced. The **⋯** menu offers "Move to…" too.
5. **Open a ticket.** The header owns the state: subject, status, priority, SLA countdown, "Assign to me" and the status action. The conversation shows messages, internal notes and history in one timeline (with filters). Reply with Enter; switch to **Internal note**; type `@` to mention a colleague; attach a file.
6. **Inspector.** Customer context (who raised it, their other tickets), properties, KB references (search and attach an article), and AI assist (summary, suggested reply that drops into the composer).
7. **Previous / next** in the header walks the board's order without going back. On a phone, Conversation and Details become a switch.

## 2. Running the team (as Nadia)

1. **Customers.** The list with avatars and filters; open "Desert Rose Hotels": contacts, portal access, and their tickets — "View these tickets on the board" filters the board to them.
2. **Knowledge base.** Articles open in reading mode; "Edit article" switches to the editor with English and Arabic tabs.
3. **Reports.** The headline numbers (tickets, SLA compliance, average CSAT, average resolution time) above the charts. Set a period and a department: the URL carries the filters, so the view can be bookmarked or shared. Save it as a saved view. Export any card to CSV.
4. **Admin.** Users and roles read as lists; editing opens a side sheet (roles show permissions grouped by area). Configuration screens share one vocabulary: an active badge, "New …" dialogs, and the same loading, error and empty states. The **Audit log** names actions in plain language and opens each change set in a sheet.
5. **Branding.** A branch colour tints the brand edges at once. If the colour would fail contrast, the accessible default accent stays — try a pale yellow to show it.

## 3. The customer's side (portal, as Layla)

1. **Home.** Three things a customer comes to do — raise a ticket, search help articles, ask the assistant — then her recent tickets with the same status colours the agent sees, and help highlights.
2. **Raise a ticket.** Fill in the subject, submit, and land straight on the new ticket. In the workspace window it appears on the board (the board refreshes every 30 seconds and on focus).
3. **Talk.** Write a message in the portal ticket's conversation; reply from Sara's window; each side sees the other's message arrive live.
4. **Resolve and rate.** Resolve the ticket from the workspace; in the portal, the feedback request now comes first on the ticket. A closed ticket explains how to get more help.
5. **Help centre.** Search articles; open one in the reading layout; "Still need help?" offers the assistant or a new ticket. The assistant chat (needs an AI provider configured in AI Settings) can hand the conversation to a person, which opens a ticket after a confirmation.

## 4. Built for everyone

- **Arabic.** Switch the language from the user menu: the whole layout mirrors, numbers stay in Latin digits, and an English subject or message inside the Arabic UI still reads correctly.
- **Dark mode.** Switch the theme (system, light, dark) from the same menu; charts, badges and the brand stay legible.
- **Phone.** Narrow the window: the board shows one column at a time with a column switcher, tables become cards, filters move into a sheet, the portal's navigation into a menu.
- **Keyboard and screen readers.** Every page has its own title; Tab reaches every control with a visible focus ring; errors and new messages are announced.

## If something goes wrong

- **No "at risk" or "breached" tickets:** the seed is too old — run it again.
- **"Too many requests":** the API rate-limits list requests (100 per minute); wait a minute.
- **The assistant only says "Thinking…":** no AI provider is configured; skip that step.
