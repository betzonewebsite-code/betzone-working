-- AlterTable
ALTER TABLE "BetTicket" ADD COLUMN     "isVirtual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VirtualTicketSession" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "fixtureIds" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualTicketSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualTicketSession_ticketId_key" ON "VirtualTicketSession"("ticketId");

-- CreateIndex
CREATE INDEX "VirtualTicketSession_userId_status_createdAt_idx" ON "VirtualTicketSession"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "VirtualTicketSession" ADD CONSTRAINT "VirtualTicketSession_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BetTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTicketSession" ADD CONSTRAINT "VirtualTicketSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
