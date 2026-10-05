import { db } from "./db";
import { DEFAULT_AUTONOMY, LEVELS, TOOLS, type Level, type ToolName } from "./agent/meta";

export type AppSettings = {
  demoMode: boolean;
  autoAssign: boolean;
  claudeModel: string;
  /** Kill switch: when false the agent never runs and nothing new is queued. */
  agentEnabled: boolean;
  agentAutonomy: Record<ToolName, Level>;
  /** AUTO actions below this confidence are routed to the approval queue instead. */
  agentMinConfidence: number;
  /** Max outbound messages/comments the agent may send automatically per day. */
  agentDailySendCap: number;
  /** Max Claude tokens (in + out) the agent may use per day. */
  agentDailyTokenCap: number;
  /** Hours of silence after which an open AI-owned lead is re-evaluated. */
  agentStaleHours: number;
};

const DEFAULTS: AppSettings = {
  demoMode: true,
  autoAssign: true,
  claudeModel: "claude-sonnet-5-5",
  agentEnabled: false,
  agentAutonomy: DEFAULT_AUTONOMY,
  agentMinConfidence: 70,
  agentDailySendCap: 50,
  agentDailyTokenCap: 300_000,
  agentStaleHours: 24,
};

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? n : fallback;
}

function parseAutonomy(raw: string | undefined): Record<ToolName, Level> {
  const out = { ...DEFAULT_AUTONOMY };
  try {
    const o = JSON.parse(raw ?? "{}") as Record<string, string>;
    for (const t of TOOLS) if ((LEVELS as readonly string[]).includes(o[t])) out[t] = o[t] as Level;
  } catch {}
  return out;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    demoMode: map.demoMode !== undefined ? map.demoMode === "true" : DEFAULTS.demoMode,
    autoAssign: map.autoAssign !== undefined ? map.autoAssign === "true" : DEFAULTS.autoAssign,
    claudeModel: map.claudeModel ?? DEFAULTS.claudeModel,
    agentEnabled: map.agentEnabled === "true",
    agentAutonomy: parseAutonomy(map.agentAutonomy),
    agentMinConfidence: num(map.agentMinConfidence, DEFAULTS.agentMinConfidence),
    agentDailySendCap: num(map.agentDailySendCap, DEFAULTS.agentDailySendCap),
    agentDailyTokenCap: num(map.agentDailyTokenCap, DEFAULTS.agentDailyTokenCap),
    agentStaleHours: num(map.agentStaleHours, DEFAULTS.agentStaleHours),
  };
}

const serialize = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));

export async function saveSettings(patch: Partial<AppSettings>) {
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: serialize(value) },
        update: { value: serialize(value) },
      }),
    ),
  );
}
