export const SERVICES = ["AI_VOICE", "WEB_DEV", "DROPSHIPPING"] as const;
export type Service = (typeof SERVICES)[number] | "UNASSIGNED";

export const SERVICE_META: Record<
  string,
  { label: string; short: string; color: string; bg: string; text: string; ring: string }
> = {
  AI_VOICE: {
    label: "AI Voice Receptionist",
    short: "AI Voice",
    color: "#8b5cf6",
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-300",
    ring: "ring-violet-500/20",
  },
  WEB_DEV: {
    label: "Web Development",
    short: "Web Dev",
    color: "#3b82f6",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-300",
    ring: "ring-blue-500/20",
  },
  DROPSHIPPING: {
    label: "Dropshipping",
    short: "Dropshipping",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-300",
    ring: "ring-amber-500/20",
  },
  UNASSIGNED: {
    label: "Unassigned",
    short: "Unassigned",
    color: "#94a3b8",
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/20",
  },
};

export const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_BOOKED", "PROPOSAL", "WON", "LOST"] as const;

export const STAGE_META: Record<string, { label: string; dot: string }> = {
  NEW: { label: "New", dot: "bg-sky-500" },
  CONTACTED: { label: "Contacted", dot: "bg-indigo-500" },
  QUALIFIED: { label: "Qualified", dot: "bg-violet-500" },
  DEMO_BOOKED: { label: "Demo booked", dot: "bg-fuchsia-500" },
  PROPOSAL: { label: "Proposal", dot: "bg-amber-500" },
  WON: { label: "Won", dot: "bg-emerald-500" },
  LOST: { label: "Lost", dot: "bg-rose-500" },
};

export const SOURCE_META: Record<string, string> = {
  META_DM: "Instagram DM",
  META_COMMENT: "Instagram comment",
  META_LEAD_AD: "Meta lead ad",
  MANUAL: "Manual",
  COLD_EMAIL: "Cold email",
  IMPORT: "Imported list",
  API: "API / automation",
};

export const PROVIDERS = ["META", "CLAUDE", "HIGGSFIELD"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const LAWFUL_BASIS: Record<string, string> = {
  B2B_CORPORATE: "B2B: limited company / LLP (PECR corporate subscriber)",
  CONSENT: "Consent given",
  OTHER: "Other (note it on the contact)",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  ADS: "Ads",
  TOOLS: "Tools & hosting",
  DOMAINS_EMAIL: "Domains & inboxes",
  AI_API: "AI / Claude API",
  VOICE: "Voice agent & numbers",
  LEAD_DATA: "Lead data",
  OTHER: "Other",
};
