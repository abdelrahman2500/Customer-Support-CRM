/** RM-15 — the injection token for the conditionally-constructed `EmailAdapter`
 * (`undefined` when `SMTP_HOST`/`SMTP_FROM` aren't both configured — see
 * `channels.module.ts`'s own factory). Mirrors `apps/worker/src/ai/ai.constants.ts`'s
 * own `AI_PROVIDER` token exactly. */
export const EMAIL_ADAPTER = Symbol("EMAIL_ADAPTER");
