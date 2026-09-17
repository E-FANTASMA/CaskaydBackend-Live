-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "CampaignCreatorStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'RESPONDED', 'ACCEPTED', 'DECLINED', 'AWAITING_CONTENT', 'CONTENT_DELIVERED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "flutterwaveTransactionId" TEXT,
    "flutterwaveReference" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "country" TEXT,
    "state" TEXT,
    "pfpError" TEXT,
    "primaryNiche" TEXT,
    "secondaryNiches" TEXT[],
    "businessEmail" TEXT,
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPlatform" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "handle" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "profileUrl" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchTag" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "SearchTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCreator" (
    "campaignId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "CampaignCreatorStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCreator_pkey" PRIMARY KEY ("campaignId","creatorId")
);

-- CreateTable
CREATE TABLE "CampaignCreatorNote" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCreatorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCreator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_flutterwaveTransactionId_key" ON "Subscription"("flutterwaveTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_flutterwaveReference_key" ON "Subscription"("flutterwaveReference");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "CreatorPlatform_creatorId_platform_idx" ON "CreatorPlatform"("creatorId", "platform");

-- CreateIndex
CREATE INDEX "SearchTag_creatorId_idx" ON "SearchTag"("creatorId");

-- CreateIndex
CREATE INDEX "SearchTag_tag_idx" ON "SearchTag"("tag");

-- CreateIndex
CREATE INDEX "CampaignCreator_creatorId_idx" ON "CampaignCreator"("creatorId");

-- CreateIndex
CREATE INDEX "CampaignCreatorNote_campaignId_creatorId_idx" ON "CampaignCreatorNote"("campaignId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCreator_userId_creatorId_key" ON "SavedCreator"("userId", "creatorId");

-- CreateIndex
CREATE INDEX "SavedCreator_userId_idx" ON "SavedCreator"("userId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPlatform" ADD CONSTRAINT "CreatorPlatform_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchTag" ADD CONSTRAINT "SearchTag_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreator" ADD CONSTRAINT "CampaignCreator_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreator" ADD CONSTRAINT "CampaignCreator_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreatorNote" ADD CONSTRAINT "CampaignCreatorNote_campaignId_creatorId_fkey" FOREIGN KEY ("campaignId", "creatorId") REFERENCES "CampaignCreator"("campaignId", "creatorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCreator" ADD CONSTRAINT "SavedCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCreator" ADD CONSTRAINT "SavedCreator_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
