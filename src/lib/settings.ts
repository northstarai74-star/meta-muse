import { db } from "./db";
import { CURRENCIES, type Currency } from "./currency";

export type AppSettings = {
  demoMode: boolean;
  autoAssign: boolean;
  claudeModel: string;
  /** Currency used for dashboard totals (revenue, spend, profit). */
  displayCurrency: Currency;
  /** Manual exchange rates: how many rupees one pound / one dollar is worth. Edit in Settings. */
  fxInrPerGbp: number;
  fxInrPerUsd: number;
  /** Monthly spending cap in rupees, shown as "budget used" on the dashboard. */
  monthlyBudgetInr: number;
};

const DEFAULTS: AppSettings = {
  demoMode: true,
  autoAssign: true,
  claudeModel: "claude-sonnet-5-5",
  displayCurrency: "INR",
  fxInrPerGbp: 105,
  fxInrPerUsd: 85,
  monthlyBudgetInr: 15000,
};

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    demoMode: map.demoMode !== undefined ? map.demoMode === "true" : DEFAULTS.demoMode,
    autoAssign: map.autoAssign !== undefined ? map.autoAssign === "true" : DEFAULTS.autoAssign,
    claudeModel: map.claudeModel ?? DEFAULTS.claudeModel,
    displayCurrency: (CURRENCIES as readonly string[]).includes(map.displayCurrency) ? (map.displayCurrency as Currency) : DEFAULTS.displayCurrency,
    fxInrPerGbp: num(map.fxInrPerGbp, DEFAULTS.fxInrPerGbp),
    fxInrPerUsd: num(map.fxInrPerUsd, DEFAULTS.fxInrPerUsd),
    monthlyBudgetInr: num(map.monthlyBudgetInr, DEFAULTS.monthlyBudgetInr),
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
