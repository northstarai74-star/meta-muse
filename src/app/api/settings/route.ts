import { z } from "zod";
import { json, route } from "@/lib/api";
import { saveSettings } from "@/lib/settings";
import { CURRENCIES } from "@/lib/currency";

const Body = z.object({
  demoMode: z.boolean().optional(),
  autoAssign: z.boolean().optional(),
  claudeModel: z.string().min(1).optional(),
  displayCurrency: z.enum(CURRENCIES).optional(),
  fxInrPerGbp: z.number().positive().optional(),
  fxInrPerUsd: z.number().positive().optional(),
  monthlyBudgetInr: z.number().positive().optional(),
});

export const PUT = route(
  async (req) => {
    await saveSettings(Body.parse(await req.json()));
    return json({ ok: true });
  },
  { admin: true },
);
