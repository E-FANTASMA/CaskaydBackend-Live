ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'FREELANCER';

DO $$
BEGIN
    CREATE TYPE "SearchPackStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS "searchesUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "searchCredits" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "TeamMembership" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SearchPackPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" "SearchPackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SearchPackPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_memberId_key" ON "TeamMembership"("memberId");
CREATE INDEX IF NOT EXISTS "TeamMembership_ownerId_idx" ON "TeamMembership"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "SearchPackPurchase_reference_key" ON "SearchPackPurchase"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "SearchPackPurchase_transactionId_key" ON "SearchPackPurchase"("transactionId");
CREATE INDEX IF NOT EXISTS "SearchPackPurchase_userId_status_idx" ON "SearchPackPurchase"("userId", "status");
CREATE INDEX IF NOT EXISTS "SearchPackPurchase_subscriptionId_idx" ON "SearchPackPurchase"("subscriptionId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'TeamMembership_ownerId_fkey'
          AND conrelid = '"TeamMembership"'::regclass
    ) THEN
        ALTER TABLE "TeamMembership"
        ADD CONSTRAINT "TeamMembership_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'TeamMembership_memberId_fkey'
          AND conrelid = '"TeamMembership"'::regclass
    ) THEN
        ALTER TABLE "TeamMembership"
        ADD CONSTRAINT "TeamMembership_memberId_fkey"
        FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SearchPackPurchase_userId_fkey'
          AND conrelid = '"SearchPackPurchase"'::regclass
    ) THEN
        ALTER TABLE "SearchPackPurchase"
        ADD CONSTRAINT "SearchPackPurchase_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SearchPackPurchase_subscriptionId_fkey'
          AND conrelid = '"SearchPackPurchase"'::regclass
    ) THEN
        ALTER TABLE "SearchPackPurchase"
        ADD CONSTRAINT "SearchPackPurchase_subscriptionId_fkey"
        FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;