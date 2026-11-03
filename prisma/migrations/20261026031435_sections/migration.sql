-- CreateEnum
CREATE TYPE "JackpotStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "JackpotRound" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JackpotStatus" NOT NULL DEFAULT 'OPEN',
    "entryFee" DECIMAL(14,2) NOT NULL,
    "seed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "carryOver" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "carryClaimed" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JackpotRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JackpotMatch" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "JackpotMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JackpotEntry" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "picks" JSONB NOT NULL,
    "correct" INTEGER,
    "payout" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JackpotEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JackpotRound_status_closesAt_idx" ON "JackpotRound"("status", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "JackpotMatch_roundId_fixtureId_key" ON "JackpotMatch"("roundId", "fixtureId");

-- CreateIndex
CREATE INDEX "JackpotEntry_roundId_idx" ON "JackpotEntry"("roundId");

-- CreateIndex
CREATE INDEX "JackpotEntry_userId_createdAt_idx" ON "JackpotEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JackpotEntry_userId_idempotencyKey_key" ON "JackpotEntry"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FeedPost_hidden_createdAt_idx" ON "FeedPost"("hidden", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedReport_postId_userId_key" ON "FeedReport"("postId", "userId");

-- AddForeignKey
ALTER TABLE "JackpotMatch" ADD CONSTRAINT "JackpotMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "JackpotRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JackpotMatch" ADD CONSTRAINT "JackpotMatch_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JackpotEntry" ADD CONSTRAINT "JackpotEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "JackpotRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JackpotEntry" ADD CONSTRAINT "JackpotEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReport" ADD CONSTRAINT "FeedReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReport" ADD CONSTRAINT "FeedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
