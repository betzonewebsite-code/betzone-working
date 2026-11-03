-- Add the required email field and optional verification timestamp.
ALTER TABLE "User"
ADD COLUMN "email" TEXT NOT NULL,
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Enforce unique email addresses.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Add the OTP delivery channel enum.
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'SMS');

-- Replace the obsolete OTP phone field with the current schema fields.
DROP INDEX "OtpCode_phone_purpose_createdAt_idx";

ALTER TABLE "OtpCode"
DROP COLUMN "phone",
ADD COLUMN "channel" "OtpChannel" NOT NULL,
ADD COLUMN "target" TEXT NOT NULL,
ADD COLUMN "userId" TEXT NOT NULL;

-- Add the updated OTP lookup index and user relationship.
CREATE INDEX "OtpCode_userId_purpose_createdAt_idx"
ON "OtpCode"("userId", "purpose", "createdAt");

ALTER TABLE "OtpCode"
ADD CONSTRAINT "OtpCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;