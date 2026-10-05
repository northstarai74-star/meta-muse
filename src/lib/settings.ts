import { db } from "./db";

export type AppSettings = {
  demoMode: boolean;
  autoAssign: boolean;
  claudeModel: string;
  assistantModel: string;
  assistantInstructions: string;
  voiceId: string;
  speakReplies: boolean;
};

const DEFAULTS: AppSettings = {
  demoMode: true,
  autoAssign: true,
  claudeModel: "claude-sonnet-5-5",
  // OpenRouter's auto-router picks a capable model per request; set a specific id (e.g. "anthropic/claude-sonnet-4.5") in Settings.
  assistantModel: "openrouter/auto",
  assistantInstructions: "",
  // ElevenLabs premade voice "Rachel" — available on every account
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  speakReplies: true,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    demoMode: map.demoMode !== undefined ? map.demoMode === "true" : DEFAULTS.demoMode,
    autoAssign: map.autoAssign !== undefined ? map.autoAssign === "true" : DEFAULTS.autoAssign,
    claudeModel: map.claudeModel ?? DEFAULTS.claudeModel,
    assistantModel: map.assistantModel || DEFAULTS.assistantModel,
    assistantInstructions: map.assistantInstructions ?? DEFAULTS.assistantInstructions,
    voiceId: map.voiceId || DEFAULTS.voiceId,
    speakReplies: map.speakReplies !== undefined ? map.speakReplies === "true" : DEFAULTS.speakReplies,
  };
}

export async function saveSettings(patch: Partial<AppSettings>) {
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      }),
    ),
  );
}
