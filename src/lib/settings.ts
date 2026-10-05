import { db } from "./db";

export type AppSettings = {
  demoMode: boolean;
  autoAssign: boolean;
  claudeModel: string;
};

const DEFAULTS: AppSettings = {
  demoMode: true,
  autoAssign: true,
  claudeModel: "claude-sonnet-5-5",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    demoMode: map.demoMode !== undefined ? map.demoMode === "true" : DEFAULTS.demoMode,
    autoAssign: map.autoAssign !== undefined ? map.autoAssign === "true" : DEFAULTS.autoAssign,
    claudeModel: map.claudeModel ?? DEFAULTS.claudeModel,
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
