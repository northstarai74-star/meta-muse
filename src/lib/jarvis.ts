import { db } from "./db";
import { getSettings } from "./settings";
import { callOpenRouter, classifyLeadWithOpenRouter, generateAIReplyWithOpenRouter } from "./integrations/openrouter";

export interface JarvisConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export async function getJarvisConfig(): Promise<JarvisConfig> {
  const settings = await getSettings();
  const key = await db.apiKey.findFirst({
    where: { provider: "OPENROUTER", status: "ACTIVE" },
    orderBy: { priority: "asc" },
  });

  if (!key) {
    return { apiKey: "", model: settings.openRouterModel, enabled: false };
  }

  // Decrypt the key
  const decrypted = Buffer.from(key.encryptedValue, "base64").toString("utf-8");

  return {
    apiKey: decrypted,
    model: settings.openRouterModel,
    enabled: !settings.demoMode && !!decrypted,
  };
}

/**
 * Jarvis: AI Agent Brain powered by OpenRouter
 * Classifies leads, generates replies, and makes decisions
 */

export async function jarvisClassifyLead(text: string) {
  const config = await getJarvisConfig();
  if (!config.enabled) {
    return null; // Fall back to heuristic
  }

  try {
    const result = await classifyLeadWithOpenRouter(text.slice(0, 4000), {
      apiKey: config.apiKey,
      model: config.model,
    });
    return result;
  } catch (error) {
    console.error("[Jarvis] Classification failed:", error);
    return null;
  }
}

export async function jarvisGenerateReply(
  conversationHistory: Array<{ role: string; content: string }>
) {
  const config = await getJarvisConfig();
  if (!config.enabled) {
    return null; // Fall back to template
  }

  try {
    return await generateAIReplyWithOpenRouter(conversationHistory, {
      apiKey: config.apiKey,
      model: config.model,
    });
  } catch (error) {
    console.error("[Jarvis] Reply generation failed:", error);
    return null;
  }
}

export interface JarvisAgentDecision {
  reply: string;
  handoff: boolean;
  confidence: number;
  reasoning: string;
}

export async function jarvisDecideAction(
  conversationHistory: Array<{ role: "IN" | "OUT"; text: string }>
): Promise<JarvisAgentDecision | null> {
  const config = await getJarvisConfig();
  if (!config.enabled) {
    return null;
  }

  const transcript = conversationHistory
    .slice(-12)
    .map((m) => `${m.role === "IN" ? "Customer" : "Jarvis"}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are Jarvis, an AI sales agent for a business with three services:
1. AI Voice Receptionist - answers calls, books appointments
2. Web Development - builds websites and web apps
3. Dropshipping - product sourcing and store setup

Analyze the conversation and respond with a JSON object:
{
  "reply": "your response to the customer (max 3 sentences)",
  "handoff": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation of your decision"
}

Handoff to human if:
- Customer asks for a human, call, or manager
- They want pricing/quote/contract
- They seem upset or confused
- Request is complex or high-value
- You're not confident in your response`;

  try {
    const response = await callOpenRouter(transcript, config, systemPrompt);
    const match = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? "{}");

    return {
      reply: parsed.reply || "I'd be happy to help! Can you tell me more about what you need?",
      handoff: parsed.handoff || false,
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning || "Processing request",
    };
  } catch (error) {
    console.error("[Jarvis] Decision making failed:", error);
    return null;
  }
}

export async function jarvisAnalyzeSentiment(text: string): Promise<{
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  urgency: "low" | "medium" | "high";
} | null> {
  const config = await getJarvisConfig();
  if (!config.enabled) return null;

  const systemPrompt = `Analyze customer sentiment. Respond with JSON only:
{
  "sentiment": "positive|negative|neutral",
  "score": 0-100,
  "urgency": "low|medium|high"
}`;

  try {
    const response = await callOpenRouter(text, config, systemPrompt);
    const match = response.match(/\{[\s\S]*\}/);
    return JSON.parse(match?.[0] ?? "{}");
  } catch (error) {
    console.error("[Jarvis] Sentiment analysis failed:", error);
    return null;
  }
}
