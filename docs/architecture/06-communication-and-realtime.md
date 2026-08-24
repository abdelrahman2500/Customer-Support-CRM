# Communication Channels, Real-Time, Background Jobs & Notifications

## Communication channel architecture

The Integration Hub normalizes email, WhatsApp, SMS, live chat, and web-form messages into a `ChannelMessage` domain event containing channel type, external thread id, sender, body, attachments, and timestamps before `ChannelsModule` sees them.

- Email uses provider webhooks or IMAP fallback for inbound and a transactional provider for outbound.
- WhatsApp uses Meta WhatsApp Business Cloud API; SMS uses Twilio or an equivalent provider.
- Live chat is a first-class Socket.IO flow between portal/widget and `apps/api`, normalized to `ChannelMessage`.
- Web forms use a public, rate-limited API endpoint.
- Each channel maps to a ticket via `Ticket.externalRef` and its external thread id.

## Real-time communication

- NestJS exposes a Socket.IO gateway with the Redis adapter for horizontal scaling.
- The socket handshake carries the REST JWT and unauthenticated sockets are rejected.
- Rooms include `ticket:{id}`, `branch:{id}:notifications`, and `agent:{id}:presence`.
- Real-time supports live chat, ticket timeline updates, in-app notifications, and agent presence.

## Background jobs & asynchronous processing

BullMQ on Redis is consumed by the separate `apps/worker` process. Initial queues are:

- `sla-timers` for business-hours-aware response/resolution deadlines and escalations.
- `notifications` for rendering and delivery.
- `integration-sync` for retried ERP and provider synchronization.
- `ai-processing` for summaries, categorization, suggested replies, and chatbot work that need not block requests.
- `reports-refresh` for scheduled reporting materialized views.

Anything slow or third-party-dependent is enqueued by the API and executed by the worker.

## Notification architecture

`NotificationService` is the only component that decides recipients, events, and channels. Domain events resolve recipients and preferences, render locale-aware templates, enqueue one job per recipient/channel, deliver in-app or through channel adapters, and log outcomes for retry and inspection. Users configure per-event channel preferences.
