/** Mirrors `apps/api/src/modules/ai/ai.constants.ts` exactly — the
 * injection token for the active `@crm/ai` `AiProvider`. Not exported
 * outside this module yet: no `ai-processing` consumer exists yet (a
 * separate future story). */
export const AI_PROVIDER = Symbol("AI_PROVIDER");
