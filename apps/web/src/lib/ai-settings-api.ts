import { apiFetch } from "./api";

/**
 * Story 81 — AI Feature Flags per Branch. A dedicated API client file,
 * mirroring `branding-api.ts`'s own "distinct domain, own file"
 * convention.
 *
 * Mirrors the backend's own `AiSettingsSummary`
 * (`apps/api/src/modules/ai/ai-settings.service.ts`) exactly.
 */
export interface AiSettingsSummary {
  summarizeEnabled: boolean;
  suggestReplyEnabled: boolean;
  categorizeEnabled: boolean;
  chatEnabled: boolean;
}

export interface UpdateAiSettingsInput {
  summarizeEnabled?: boolean;
  suggestReplyEnabled?: boolean;
  categorizeEnabled?: boolean;
  chatEnabled?: boolean;
}

export function getAiSettings(): Promise<AiSettingsSummary> {
  return apiFetch<AiSettingsSummary>("/ai/settings");
}

export function updateAiSettings(input: UpdateAiSettingsInput): Promise<AiSettingsSummary> {
  return apiFetch<AiSettingsSummary>("/ai/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
