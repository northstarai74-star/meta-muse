-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "finishedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trigger" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT,
    "commentId" TEXT,
    "status" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'CLAUDE',
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT,
    "commentId" TEXT,
    "tool" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "confidence" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "autonomy" TEXT NOT NULL,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "executedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentAction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_dedupeKey_status_idx" ON "Job"("dedupeKey", "status");

-- CreateIndex
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_leadId_idx" ON "AgentRun"("leadId");

-- CreateIndex
CREATE INDEX "AgentAction_status_createdAt_idx" ON "AgentAction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAction_leadId_idx" ON "AgentAction"("leadId");

-- CreateIndex
CREATE INDEX "AgentAction_createdAt_idx" ON "AgentAction"("createdAt");
