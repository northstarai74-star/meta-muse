// Checks .env before `npm run dev` so missing or placeholder secrets fail with a clear message
// instead of a confusing error on the first sign-in. Never prints secret values.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
const problems = [];
const warnings = [];

if (!existsSync(file)) {
  console.error("✖ No .env file found. Copy the template first:\n    Windows:  copy .env.example .env\n    macOS/Linux:  cp .env.example .env");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m || line.trim().startsWith("#")) continue;
  env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const PLACEHOLDERS = ["change-me", "ChangeMe123!"];
const isPlaceholder = (v) => PLACEHOLDERS.some((p) => v.includes(p));

for (const key of ["DATABASE_URL", "SESSION_SECRET", "ENCRYPTION_KEY", "ADMIN_PASSWORD", "APP_URL", "CRON_SECRET"]) {
  if (!env[key]) problems.push(`${key} is empty`);
}

if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
  problems.push("DATABASE_URL must start with postgresql://");
}
if (env.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY)) {
  problems.push("ENCRYPTION_KEY must be exactly 64 hex characters (see the generate command in README.md)");
}
if (env.ADMIN_PASSWORD && (env.ADMIN_PASSWORD.length < 8 || env.ADMIN_PASSWORD === "ChangeMe123!")) {
  problems.push("ADMIN_PASSWORD must be at least 8 characters and not the example value");
}
for (const key of ["SESSION_SECRET", "CRON_SECRET"]) {
  if (env[key] && isPlaceholder(env[key])) problems.push(`${key} still has the example value; replace it with a long random string`);
  else if (env[key] && env[key].length < 16) warnings.push(`${key} is short; use a longer random string`);
}
if (!env.WHATSAPP_VERIFY_TOKEN) warnings.push("WHATSAPP_VERIFY_TOKEN is not set (only needed for WhatsApp)");

for (const w of warnings) console.warn(`! ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`✖ ${p}`);
  console.error("\nFix .env and run `npm run env:check` again.");
  process.exit(1);
}
console.log("✔ .env looks good");
