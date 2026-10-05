// Client-safe definitions shared by the agent runtime, the settings API and the Agent page.

export const TOOLS = ["send_dm", "reply_comment", "update_lead", "schedule_followup", "escalate_to_human"] as const;
export type ToolName = (typeof TOOLS)[number];

/** OFF: the agent may not use the tool. APPROVAL: proposals wait in the queue. AUTO: executes immediately. */
export const LEVELS = ["OFF", "APPROVAL", "AUTO"] as const;
export type Level = (typeof LEVELS)[number];

export const TOOL_META: Record<ToolName, { label: string; desc: string; outbound: boolean; defaultLevel: Level }> = {
  send_dm: { label: "Send Instagram DM", desc: "Reply to a prospect in their conversation", outbound: true, defaultLevel: "APPROVAL" },
  reply_comment: { label: "Reply to comment", desc: "Publicly answer an Instagram comment", outbound: true, defaultLevel: "APPROVAL" },
  update_lead: { label: "Update lead", desc: "Change stage, service or score; add a note", outbound: false, defaultLevel: "AUTO" },
  schedule_followup: { label: "Schedule follow-up", desc: "Wake the agent again on this lead later", outbound: false, defaultLevel: "AUTO" },
  escalate_to_human: { label: "Escalate to human", desc: "Hand the lead to a team member", outbound: false, defaultLevel: "AUTO" },
};

export const DEFAULT_AUTONOMY = Object.fromEntries(TOOLS.map((t) => [t, TOOL_META[t].defaultLevel])) as Record<ToolName, Level>;

export type ActionStatus = "PENDING" | "EXECUTED" | "REJECTED" | "FAILED" | "SKIPPED";
