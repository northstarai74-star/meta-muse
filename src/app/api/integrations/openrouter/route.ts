import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { testOpenRouterConnection, OPENROUTER_MODELS } from "@/lib/integrations/openrouter";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return available models
    return NextResponse.json({
      models: OPENROUTER_MODELS,
      docs: "https://openrouter.ai/docs",
    });
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, apiKey, model } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "test") {
      if (!apiKey || !model) {
        return NextResponse.json({ error: "Missing apiKey or model" }, { status: 400 });
      }

      const isValid = await testOpenRouterConnection({ apiKey, model });
      return NextResponse.json({ valid: isValid });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("OpenRouter API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
