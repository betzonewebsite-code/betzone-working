-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketType" ADD VALUE 'CORRECT_SCORE';
ALTER TYPE "MarketType" ADD VALUE 'TEAM_TOTALS';
ALTER TYPE "MarketType" ADD VALUE 'HALF_TIME_RESULT';
ALTER TYPE "MarketType" ADD VALUE 'HALF_TIME_FULL_TIME';
ALTER TYPE "MarketType" ADD VALUE 'WIN_MARGIN';
