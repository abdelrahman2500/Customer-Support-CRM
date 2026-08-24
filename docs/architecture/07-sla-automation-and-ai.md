# SLA & Automation, and AI Integration (high level)

These are foundation-level designs; concrete rule sets and UX belong to future stories.

## SLA & automation (high level)

- `SlaPolicy` is scoped by branch/department, category, and priority, and defines response/resolution targets and a business-hours calendar.
- SLA targets are computed when a ticket is created or recategorized by `SlaModule` reacting to `ticket.created` and `ticket.recategorized`.
- The `sla-timers` job checks targets and emits `sla.at_risk` or `sla.breached`; notifications and escalation rules react.
- `AutomationRule` is a simple trigger-condition-action row, evaluated against domain events. A full workflow engine is explicitly deferred.

## AI integration (high level)

- `AiModule` exposes an internal `AiProvider` interface with methods such as `summarize(ticket)`, `suggestReply(ticket)`, `categorize(ticket)`, and `chat(session, message)`.
- The initial implementation calls Anthropic Claude. Provider swaps implement the interface without changing call sites.
- Non-interactive AI work uses `ai-processing`; interactive chatbot turns use the asynchronous provider client through the API.
- Every call logs prompt reference, model, token usage, latency, and outcome. Features are flaggable per branch.
- Human review is the default for agent-facing output. Autonomous responses are limited to portal self-service in this foundation phase.
- AI retrieval uses Knowledge Base embeddings stored with `pgvector`.
