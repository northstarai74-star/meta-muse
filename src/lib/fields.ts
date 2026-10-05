import {
  BUSINESS_LINES, CAMPAIGN_STATUS, CHANNELS, CHANNEL_LABEL, CLIENT_STATUS, CONTENT_STATUS, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  LINE_LABEL, ORDER_STATUS, PRODUCT_STATUS, SERVICE_META,
} from "./constants";

export type Opt = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea";
  options?: readonly Opt[];
  required?: boolean;
  placeholder?: string;
  half?: boolean;
};

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
export const opts = (xs: readonly string[], label: (s: string) => string = title): Opt[] => xs.map((x) => ({ value: x, label: label(x) }));
const SERVICE_OPTS = opts(["AI_VOICE", "WEB_DEV", "DROPSHIPPING"], (s) => SERVICE_META[s].label);

export const today = () => new Date().toISOString().slice(0, 10);

export const FIELDS = {
  products: [
    { key: "name", label: "Product name", type: "text", required: true },
    { key: "sku", label: "SKU", type: "text", half: true },
    { key: "supplier", label: "Supplier", type: "text", half: true },
    { key: "cost", label: "Your cost ($)", type: "number", required: true, half: true },
    { key: "price", label: "Selling price ($)", type: "number", required: true, half: true },
    { key: "stock", label: "Stock on hand", type: "number", required: true, half: true },
    { key: "status", label: "Status", type: "select", options: opts(PRODUCT_STATUS), required: true, half: true },
  ],
  orders: (products: Opt[]): Field[] => [
    { key: "number", label: "Order #", type: "text", required: true, half: true },
    { key: "placedAt", label: "Date", type: "date", required: true, half: true },
    { key: "customer", label: "Customer", type: "text", required: true },
    { key: "productId", label: "Product", type: "select", options: [{ value: "", label: "— other / not listed —" }, ...products] },
    { key: "productName", label: "Product name", type: "text", required: true },
    { key: "quantity", label: "Quantity", type: "number", required: true, half: true },
    { key: "status", label: "Status", type: "select", options: opts(ORDER_STATUS), required: true, half: true },
    { key: "revenue", label: "Sale total ($)", type: "number", required: true, half: true },
    { key: "cost", label: "Your cost total ($)", type: "number", required: true, half: true },
  ],
  campaigns: [
    { key: "name", label: "Campaign name", type: "text", required: true },
    { key: "channel", label: "Channel", type: "select", options: opts(CHANNELS, (c) => CHANNEL_LABEL[c]), required: true, half: true },
    { key: "service", label: "Promotes", type: "select", options: [...SERVICE_OPTS, { value: "ALL", label: "All services" }], required: true, half: true },
    { key: "status", label: "Status", type: "select", options: opts(CAMPAIGN_STATUS), required: true },
    { key: "budget", label: "Budget ($)", type: "number", required: true, half: true },
    { key: "spend", label: "Spent so far ($)", type: "number", required: true, half: true },
    { key: "leadsGenerated", label: "Leads generated", type: "number", required: true },
    { key: "startsAt", label: "Starts", type: "date", half: true },
    { key: "endsAt", label: "Ends", type: "date", half: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  content: [
    { key: "title", label: "Post / idea", type: "text", required: true },
    { key: "channel", label: "Channel", type: "select", options: opts(CHANNELS, (c) => CHANNEL_LABEL[c]), required: true, half: true },
    { key: "status", label: "Status", type: "select", options: opts(CONTENT_STATUS), required: true, half: true },
    { key: "scheduledFor", label: "Scheduled for", type: "date" },
    { key: "caption", label: "Caption / notes", type: "textarea" },
  ],
  clients: (contacts: Opt[]): Field[] => [
    { key: "contactId", label: "Client (from Contacts)", type: "select", options: [{ value: "", label: "Choose a contact…" }, ...contacts], required: true },
    { key: "service", label: "Service", type: "select", options: SERVICE_OPTS, required: true, half: true },
    { key: "monthlyFee", label: "Monthly fee ($)", type: "number", required: true, half: true },
    { key: "status", label: "Status", type: "select", options: opts(CLIENT_STATUS), required: true, half: true },
    { key: "startedAt", label: "Started", type: "date", required: true, half: true },
    { key: "renewsAt", label: "Next renewal", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  finance: (type: "INCOME" | "EXPENSE"): Field[] => [
    { key: "amount", label: "Amount ($)", type: "number", required: true, half: true },
    { key: "occurredAt", label: "Date", type: "date", required: true, half: true },
    { key: "category", label: "Category", type: "select", options: opts(type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES, (s) => s), required: true, half: true },
    { key: "businessLine", label: "Business line", type: "select", options: opts(BUSINESS_LINES, (l) => LINE_LABEL[l]), required: true, half: true },
    { key: "note", label: "Note", type: "text" },
  ],
  reserves: [
    { key: "name", label: "Reserve name", type: "text", required: true, placeholder: "e.g. Tax, Emergency, Ad budget" },
    { key: "target", label: "Target ($)", type: "number", required: true },
  ],
} as const;
