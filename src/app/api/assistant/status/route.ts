import { json, route } from "@/lib/api";
import { assistantStatus } from "@/lib/assistant";

export const GET = route(async () => json(await assistantStatus()));
