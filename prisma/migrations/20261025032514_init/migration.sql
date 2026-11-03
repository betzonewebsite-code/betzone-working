-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET_PASSWORD', 'WITHDRAWAL_PIN');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_PAYOUT', 'BET_REFUND', 'CASHOUT', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'MTN_MOMO', 'TELECEL_CASH', 'AIRTELTIGO_MONEY', 'MPESA', 'CARD', 'INTERNAL');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('SOCCER', 'BASKETBALL', 'TENNIS', 'TABLE_TENNIS', 'ICE_HOCKEY', 'BASEBALL', 'ESPORTS');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'HALFTIME', 'FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('ONE_X_TWO', 'OVER_UNDER', 'DOUBLE_CHANCE', 'BTTS', 'NEXT_GOAL', 'ASIAN_HANDICAP', 'MONEYLINE');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'SUSPENDED', 'CLOSED', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "OddsStatus" AS ENUM ('OPEN', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SelectionResult" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SINGLE', 'MULTIPLE', 'FLEXI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID', 'CASHED_OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "withdrawalPinHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" DATE,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
    "phoneVerifiedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "status" "TxStatus" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "provider" "PaymentProvider",
    "providerRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "ticketId" TEXT,
    "counterparty" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "country" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minute" INTEGER,
    "period" TEXT,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "bettingOpen" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "type" "MarketType" NOT NULL,
    "line" DECIMAL(5,2),
    "lineKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "suspendedReason" TEXT,
    "settledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOdds" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "odds" DECIMAL(8,3) NOT NULL,
    "previousOdds" DECIMAL(8,3),
    "status" "OddsStatus" NOT NULL DEFAULT 'OPEN',
    "result" "SelectionResult" NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOdds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetTicket" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "flexiCut" INTEGER NOT NULL DEFAULT 0,
    "stake" DECIMAL(14,2) NOT NULL,
    "remainingStake" DECIMAL(14,2) NOT NULL,
    "totalOdds" DECIMAL(14,3) NOT NULL,
    "bonusPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "potentialPayout" DECIMAL(14,2) NOT NULL,
    "payout" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cashedOutAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "autoCashoutTarget" DECIMAL(14,2),
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "idempotencyKey" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "BetTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetLeg" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "oddsId" TEXT NOT NULL,
    "oddsTaken" DECIMAL(8,3) NOT NULL,
    "matchName" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "pickLabel" TEXT NOT NULL,
    "line" DECIMAL(5,2),
    "placedLive" BOOLEAN NOT NULL DEFAULT false,
    "result" "SelectionResult" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "BetLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCode" (
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "legs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ResponsibleLimits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyDeposit" DECIMAL(14,2),
    "weeklyDeposit" DECIMAL(14,2),
    "monthlyDeposit" DECIMAL(14,2),
    "dailyStake" DECIMAL(14,2),
    "coolOffUntil" TIMESTAMP(3),
    "selfExcludedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponsibleLimits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_providerRef_key" ON "Transaction"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_type_status_idx" ON "Transaction"("type", "status");

-- CreateIndex
CREATE INDEX "Transaction_ticketId_idx" ON "Transaction"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "League_sport_isPopular_idx" ON "League"("sport", "isPopular");

-- CreateIndex
CREATE UNIQUE INDEX "League_source_externalId_key" ON "League"("source", "externalId");

-- CreateIndex
CREATE INDEX "Fixture_status_kickoffAt_idx" ON "Fixture"("status", "kickoffAt");

-- CreateIndex
CREATE INDEX "Fixture_leagueId_kickoffAt_idx" ON "Fixture"("leagueId", "kickoffAt");

-- CreateIndex
CREATE INDEX "Fixture_sport_status_idx" ON "Fixture"("sport", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_source_externalId_key" ON "Fixture"("source", "externalId");

-- CreateIndex
CREATE INDEX "Market_fixtureId_status_idx" ON "Market"("fixtureId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Market_fixtureId_type_lineKey_key" ON "Market"("fixtureId", "type", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOdds_marketId_key_key" ON "MarketOdds"("marketId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BetTicket_publicId_key" ON "BetTicket"("publicId");

-- CreateIndex
CREATE INDEX "BetTicket_userId_status_placedAt_idx" ON "BetTicket"("userId", "status", "placedAt");

-- CreateIndex
CREATE INDEX "BetTicket_status_placedAt_idx" ON "BetTicket"("status", "placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetTicket_userId_idempotencyKey_key" ON "BetTicket"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BetLeg_ticketId_idx" ON "BetLeg"("ticketId");

-- CreateIndex
CREATE INDEX "BetLeg_fixtureId_result_idx" ON "BetLeg"("fixtureId", "result");

-- CreateIndex
CREATE INDEX "BookingCode_expiresAt_idx" ON "BookingCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibleLimits_userId_key" ON "ResponsibleLimits"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BetTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOdds" ADD CONSTRAINT "MarketOdds_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetTicket" ADD CONSTRAINT "BetTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BetTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetLeg" ADD CONSTRAINT "BetLeg_oddsId_fkey" FOREIGN KEY ("oddsId") REFERENCES "MarketOdds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCode" ADD CONSTRAINT "BookingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibleLimits" ADD CONSTRAINT "ResponsibleLimits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Database-level safety nets Prisma cannot express. Append to the first migration (see docs/ARCHITECTURE.md).
-- Even if application code has a bug, the database refuses to let a wallet go negative.
ALTER TABLE "Wallet"     ADD CONSTRAINT "Wallet_balance_nonneg"      CHECK ("balance" >= 0);
ALTER TABLE "BetTicket"  ADD CONSTRAINT "BetTicket_stake_positive"   CHECK ("stake" > 0);
ALTER TABLE "BetTicket"  ADD CONSTRAINT "BetTicket_remaining_nonneg" CHECK ("remainingStake" >= 0);
ALTER TABLE "BetLeg"     ADD CONSTRAINT "BetLeg_odds_min"            CHECK ("oddsTaken" >= 1.01);
ALTER TABLE "MarketOdds" ADD CONSTRAINT "MarketOdds_odds_min"        CHECK ("odds" >= 1.01);
