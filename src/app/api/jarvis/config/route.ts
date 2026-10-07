import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getJarvisConfig, jarvisAnalyzeSentiment } from "@/lib/jarvis";
import { testOpenRouterConnection, OPENROUTER_MODELS } from "@/lib/integrations/openrouter";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getJarvisConfig();
    return NextResponse.json({
      enabled: config.enabled,
      model: config.model,
      availableModels: OPENROUTER_MODELS,
      status: config.enabled ? "Connected" : "Not configured",
    });
  } catch (error) {
    console.error("Failed to get Jarvis config:", error);
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
      if (isValid) {
        return NextResponse.json({ valid: true, message: "Jarvis brain connected!" });
      } else {
        return NextResponse.json({ valid: false, message: "Connection failed" }, { status: 400 });
      }
    }

    if (action === "save") {
      if (!apiKey || !model) {
        return NextResponse.json({ error: "Missing apiKey or model" }, { status: 400 });
      }

      // Test first
      const isValid = await testOpenRouterConnection({ apiKey, model });
      if (!isValid) {
        return NextResponse.json({ error: "Invalid OpenRouter credentials" }, { status: 400 });
      }

      // Save/update the key
      const encoded = Buffer.from(apiKey).toString("base64");
      await db.apiKey.upsert({
        where: { id: "openrouter-default" },
        create: {
          id: "openrouter-default",
          provider: "OPENROUTER",
          label: "Jarvis Brain",
          encryptedValue: encoded,
          keyHint: apiKey.slice(-4),
          status: "ACTIVE",
          priority: 1,
        },
        update: {
          encryptedValue: encoded,
          keyHint: apiKey.slice(-4),
          status: "ACTIVE",
        },
      });

      // Update model setting
      await db.setting.upsert({
        where: { key: "openRouterModel" },
        create: { key: "openRouterModel", value: model },
        update: { value: model },
      });

      return NextResponse.json({
        success: true,
        message: "Jarvis brain configured successfully!",
        model,
      });
    }

    if (action === "test-brain") {
      // Test Jarvis capabilities
      const testText = "Hi, I need an AI voice receptionist for my business";
      const sentiment = await jarvisAnalyzeSentiment(testText);

      return NextResponse.json({
        test: "brain-function",
        sentiment,
        message: "Jarvis brain is operational",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Jarvis config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
