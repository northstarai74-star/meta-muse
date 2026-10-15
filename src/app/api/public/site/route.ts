import { json } from "@/lib/api";
import { getSite } from "@/lib/website";

// Public read-only endpoint for the website. Returns nothing until the site is marked published.
export async function GET() {
  const site = await getSite();
  const { published, ...content } = site;
  if (published !== "true") return json({ published: false }, { headers: { "Cache-Control": "no-store" } });
  return json({ published: true, ...content }, { headers: { "Cache-Control": "public, max-age=60" } });
}
