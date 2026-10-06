-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "byAi" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "aspect" TEXT NOT NULL DEFAULT '1:1',
    "requestId" TEXT,
    "apiKeyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "imageUrl" TEXT,
    "error" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_requestId_key" ON "Creative"("requestId");

-- CreateIndex
CREATE INDEX "Creative_createdAt_idx" ON "Creative"("createdAt");

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

