export interface OpenRouterConfig {
  apiKey: string;
  model: string; // e.g., "anthropic/claude-3-sonnet", "openai/gpt-4", "meta-llama/llama-2-70b"
  baseUrl?: string;
}

export const OPENROUTER_MODELS = {
  claude: [
    { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
  ],
  openai: [
    { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "openai/gpt-4", name: "GPT-4" },
    { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  open_source: [
    { id: "meta-llama/llama-2-70b-chat", name: "Llama 2 70B Chat" },
    { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B" },
    { id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo", name: "Nous Hermes 2 Mixtral" },
  ],
};

export async function callOpenRouter(
  prompt: string,
  config: OpenRouterConfig,
  systemPrompt?: string
) {
  const baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("OpenRouter API call failed:", error);
    throw error;
  }
}

export async function testOpenRouterConnection(config: OpenRouterConfig): Promise<boolean> {
  try {
    const response = await callOpenRouter(
      "Say 'Connection successful' in one word.",
      config
    );
    return response.toLowerCase().includes("success") || response.length > 0;
  } catch {
    return false;
  }
}

// Use OpenRouter for lead classification
export async function classifyLeadWithOpenRouter(
  leadText: string,
  config: OpenRouterConfig
) {
  const systemPrompt = `You are a sales lead classifier. Analyze the lead and respond with ONLY a JSON object (no markdown, no explanations):
{
  "service": "AI_VOICE|WEB_DEV|DROPSHIPPING|UNASSIGNED",
  "score": 1-10,
  "summary": "brief summary"
}`;

  const response = await callOpenRouter(leadText, config, systemPrompt);

  try {
    return JSON.parse(response);
  } catch {
    return {
      service: "UNASSIGNED",
      score: 5,
      summary: "Classification error",
    };
  }
}

// Use OpenRouter for AI agent replies
export async function generateAIReplyWithOpenRouter(
  conversationHistory: Array<{ role: string; content: string }>,
  config: OpenRouterConfig
) {
  const systemPrompt = `You are a friendly sales agent. Respond naturally to customer inquiries about AI Voice, Web Development, or Dropshipping services. Keep replies under 200 characters. If the customer asks for a human agent, suggest they wait for a team member.`;

  const lastMessage = conversationHistory[conversationHistory.length - 1]?.content || "";

  return callOpenRouter(lastMessage, config, systemPrompt);
}
