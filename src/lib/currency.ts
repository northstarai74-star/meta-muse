export const CURRENCIES = ["INR", "GBP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Deals and lead values are recorded in this currency (UK clients). Expenses carry their own currency. */
export const REVENUE_CURRENCY: Currency = "GBP";

export type Fx = { fxInrPerGbp: number; fxInrPerUsd: number };

export function toInr(amount: number, currency: string, fx: Fx) {
  if (currency === "GBP") return amount * fx.fxInrPerGbp;
  if (currency === "USD") return amount * fx.fxInrPerUsd;
  return amount;
}

export function convert(amount: number, from: string, to: Currency, fx: Fx) {
  const inr = toInr(amount, from, fx);
  if (to === "GBP") return inr / fx.fxInrPerGbp;
  if (to === "USD") return inr / fx.fxInrPerUsd;
  return inr;
}

const LOCALE: Record<Currency, string> = { INR: "en-IN", GBP: "en-GB", USD: "en-US" };

export function formatMoney(n: number, currency: Currency = REVENUE_CURRENCY, compact = false) {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: compact && Math.abs(n) >= 10000 ? "compact" : "standard",
  }).format(n);
}
