# Domain Boundaries

Each bounded context below becomes one NestJS module (in `apps/api`) and, where noted, one Postgres logical schema. Modules communicate through domain events or explicit service interfaces exported from the module, never by reaching into another module's Prisma models directly.

| Domain / Module          | Postgres schema  | Owns                                                                     | Notes                                                                          |
| ------------------------ | ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Identity & Access        | `identity`       | Branches, departments, users, roles, permissions, sessions               | Owns `TenantContext` resolution.                                               |
| Customer Management      | `customers`      | Customer profiles, contacts, interaction history, attachment metadata    | Binary content is in object storage.                                           |
| Ticketing                | `ticketing`      | Tickets, categories, priorities, statuses, assignments, history/timeline | Core entity; emits `ticket.created`, `ticket.updated`, and `ticket.escalated`. |
| Communication / Channels | `channels`       | Channel configuration, inbound/outbound messages, threads, quick replies | Receives normalized Integration Hub events.                                    |
| SLA & Automation         | `sla`            | SLA policies, timers, escalation and automation rules                    | Subscribes to ticketing events.                                                |
| Knowledge Base           | `knowledge_base` | Articles, categories, FAQs, publish state, search index                  | Uses full-text and vector search.                                              |
| AI Services              | `ai`             | AI Gateway config, prompt/response logs, chatbot sessions                | Provider-agnostic.                                                             |
| Notifications            | `notifications`  | Templates, delivery logs, per-user preferences                           | Owns notification routing.                                                     |
| Reporting & Analytics    | `reporting`      | Materialized views/read models and saved dashboards                      | Read-mostly, never source of truth.                                            |
| Customer Portal          | (no own schema)  | Scoped API over Ticketing, KB, and Notifications                         | Presentation/access boundary, not a data owner.                                |
| Administration           | `admin`          | System configuration, branding, append-only audit logs                   | Owns audit storage.                                                            |
| Integrations             | `integrations`   | Connection configs, webhook logs, sync job state                         | Owns external adapters.                                                        |

## Rules

1. A module may read another module's data only through exported service methods or a `reporting` read model, never by importing another module's Prisma model directly.
2. Side effects that other domains care about are published as domain events. Subscribers react independently rather than being called synchronously by the source module.
3. New feature stories add or extend a module and must update this table for new cross-module dependencies.
