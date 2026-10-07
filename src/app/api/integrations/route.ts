import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await db.integration.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(integrations);
  } catch (error) {
    console.error("Failed to fetch integrations:", error);
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
    const { type, name, config, active } = body;

    if (!type || !config) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const integration = await db.integration.create({
      data: {
        type,
        name: name || type,
        config,
        active: active ?? true,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error("Failed to create integration:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
