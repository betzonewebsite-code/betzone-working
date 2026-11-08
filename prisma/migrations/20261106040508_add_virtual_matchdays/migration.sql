-- AlterTable
ALTER TABLE "VirtualRound" ADD COLUMN     "matchday" INTEGER,
ADD COLUMN     "season" INTEGER;

-- CreateIndex
CREATE INDEX "VirtualRound_season_matchday_idx" ON "VirtualRound"("season", "matchday");
