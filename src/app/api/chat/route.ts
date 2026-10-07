import { getCurrentUser } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    // Parse commands - you can expand this to handle different commands
    let response = "";

    if (message.toLowerCase().startsWith("help")) {
      response = `Available commands:
- help: Show this message
- time: Get current time
- date: Get current date
- clear: Clear chat (type in client)
- search [query]: Search functionality
- navigate [page]: Navigate to page (dashboard, leads, contacts, etc.)`;
    } else if (message.toLowerCase().startsWith("time")) {
      response = `Current time: ${new Date().toLocaleTimeString()}`;
    } else if (message.toLowerCase().startsWith("date")) {
      response = `Current date: ${new Date().toLocaleDateString()}`;
    } else if (message.toLowerCase().startsWith("search ")) {
      const query = message.substring(7).trim();
      response = `Searching for: "${query}". Tip: Use the search bar in the header for more detailed results.`;
    } else if (message.toLowerCase().startsWith("navigate ")) {
      const page = message.substring(9).trim().toLowerCase();
      const pages: Record<string, string> = {
        "dashboard": "/",
        "leads": "/leads",
        "contacts": "/contacts",
        "inbox": "/inbox",
        "engagement": "/engagement",
        "team": "/team",
        "studio": "/studio",
        "integrations": "/integrations",
        "settings": "/settings",
      };
      const path = pages[page];
      if (path) {
        response = `Navigating to ${page}. (Redirect handled on client side)`;
      } else {
        response = `Unknown page: ${page}. Try: dashboard, leads, contacts, inbox, engagement, team, studio, integrations, settings`;
      }
    } else {
      response = `Command not recognized: "${message}". Type "help" for available commands.`;
    }

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
