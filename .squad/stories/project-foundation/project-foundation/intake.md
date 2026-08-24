> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation/project-foundation/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Project Foundation & System Architecture
- **Feature slug (folder under `plans/`):** `project-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Project Foundation & System Architecture
```

---

## Description

We are building a full-stack Customer Support CRM platform.

The platform is intended to support customer service operations across multiple
branches and departments, with support for multiple communication channels,
customer management, ticket management, SLA management, automation,
knowledge base, AI capabilities, customer portal, reporting, administration,
integrations, and custom branding.

The platform must support:

Customer Management
Customer profiles
Contact details
Interaction history
Notes and attachments
Ticket Management
Create and track tickets
Categories and priorities
Assign tickets to agents
Status and escalation
Ticket history
Communication Channels
Email
WhatsApp
Live chat
SMS
Web forms
Agent Dashboard
Assigned tickets
Customer information
Tasks and reminders
Quick replies
Team collaboration
SLA & Automation
Response and resolution targets
Automatic assignment
Escalation rules
Alerts and notifications
Knowledge Base
FAQs
Help articles
Solutions and guides
Search
AI Features
Ticket summaries
Suggested replies
Automatic categorization
Suggested solutions
AI chatbot
Customer Portal
Submit tickets
Track requests
View history
Access FAQs
Submit feedback
Reports & Management
Ticket reports
SLA performance
Agent performance
Customer satisfaction
Management dashboards
Security & Administration
Users and roles
Permissions
Audit logs
System configuration
Integrations
APIs
ERP
Email, SMS and WhatsApp
External systems
Platform
Arabic and English
RTL support
Responsive web and mobile-friendly UI
Multi-department
Multi-branch
Custom branding

The application is full-stack. The frontend and backend technology stack has
not been selected yet.

The goal of this story is NOT to implement the CRM features.

The goal is to establish the project's technical foundation and system
architecture before feature implementation begins.

The architecture should define clear boundaries between the frontend,
backend/API, database, authentication/authorization, integrations,
background processing, real-time communication, AI services, notifications,
and other infrastructure required by the platform.

The architecture must be designed to allow the CRM to grow without creating
tight coupling between domains.

The solution should consider scalability, maintainability, security,
testability, observability, extensibility, and developer experience.

```

```

---

---

## Acceptance criteria

```markdown
- [ ] A recommended full-stack technology stack is defined and justified.
- [ ] Frontend architecture is defined.
- [ ] Backend/API architecture is defined.
- [ ] Database strategy is defined.
- [ ] Core domain boundaries are identified.
- [ ] Authentication and authorization architecture is defined.
- [ ] Multi-branch and multi-department architecture is defined.
- [ ] Arabic, English and RTL requirements are addressed.
- [ ] Communication channel architecture is defined.
- [ ] Real-time communication requirements are addressed.
- [ ] Background jobs and asynchronous processing requirements are addressed.
- [ ] Notification architecture is defined.
- [ ] SLA and automation architecture is defined at a high level.
- [ ] Knowledge Base architecture is defined at a high level.
- [ ] AI integration architecture is defined at a high level.
- [ ] Customer Portal architecture is defined at a high level.
- [ ] Reporting and analytics architecture is defined at a high level.
- [ ] Integration architecture is defined for external systems.
- [ ] Security boundaries and audit logging strategy are defined.
- [ ] Testing strategy is defined at a high level.
- [ ] Logging, monitoring and observability strategy is defined.
- [ ] Deployment and environment strategy is defined.
- [ ] The architecture identifies major technical risks and trade-offs.
- [ ] The architecture explicitly identifies what should NOT be implemented
      during this foundation story.
- [ ] The resulting plan provides enough implementation detail for future
      stories to build on the established architecture without repeatedly
      redesigning the system.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| None | No attachments currently |

---

## Dependencies

- **Blocked by / related ids:** None

- **Depends on code areas or other stories:**
  This is the initial foundation story. No application features have been
  implemented yet.

## Extra notes (optional)

- The product requirements provided for this story represent the initial
  product scope and may evolve.
- Do not assume a specific frontend or backend framework before evaluating
  the requirements.
- Prefer pragmatic architecture over unnecessary complexity.
- The system should be designed for future growth, but avoid premature
  infrastructure and abstractions that are not justified by the requirements.

## Technical hints (optional)

- Application type: Full-stack web application
- Primary language: TypeScript
- Frontend technology: Not selected
- Backend technology: Not selected
- Database technology: Not selected
- Authentication solution: Not selected
- Deployment platform: Not selected
- Repository root: .

## Out of scope

- Implementing customer management features
- Implementing ticket management features
- Implementing communication channels
- Implementing the agent dashboard
- Implementing SLA rules
- Implementing automation rules
- Implementing the knowledge base
- Implementing AI features
- Implementing the customer portal
- Implementing reports and dashboards
- Implementing administration screens
- Implementing external integrations
- Production deployment
- Building the complete database schema
- Building complete API endpoints
- Building complete frontend screens
- Implementing business workflows
```
