-- AlterTable
ALTER TABLE "VirtualTicketSession" ADD COLUMN     "results" JSONB,
ADD COLUMN     "seed" TEXT,
ADD COLUMN     "seedHash" TEXT;
