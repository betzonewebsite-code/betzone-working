-- Database-level safety nets Prisma cannot express. Append to the first migration (see docs/ARCHITECTURE.md).
-- Even if application code has a bug, the database refuses to let a wallet go negative.
ALTER TABLE "Wallet"     ADD CONSTRAINT "Wallet_balance_nonneg"      CHECK ("balance" >= 0);
ALTER TABLE "BetTicket"  ADD CONSTRAINT "BetTicket_stake_positive"   CHECK ("stake" > 0);
ALTER TABLE "BetTicket"  ADD CONSTRAINT "BetTicket_remaining_nonneg" CHECK ("remainingStake" >= 0);
ALTER TABLE "BetLeg"     ADD CONSTRAINT "BetLeg_odds_min"            CHECK ("oddsTaken" >= 1.01);
ALTER TABLE "MarketOdds" ADD CONSTRAINT "MarketOdds_odds_min"        CHECK ("odds" >= 1.01);
