-- CreateEnum
CREATE TYPE "VirtualStatus" AS ENUM ('BETTING', 'PLAYING', 'DONE');

-- CreateTable
CREATE TABLE "VirtualRound" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "seedHash" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "VirtualStatus" NOT NULL DEFAULT 'BETTING',
    "betsCloseAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "matches" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualRound_number_key" ON "VirtualRound"("number");

-- CreateIndex
CREATE INDEX "VirtualRound_status_number_idx" ON "VirtualRound"("status", "number");
