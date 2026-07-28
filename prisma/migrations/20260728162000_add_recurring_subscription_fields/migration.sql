ALTER TABLE "Subscription"
ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "flutterwaveSubscriptionId" INTEGER,
ADD COLUMN "flutterwavePaymentPlanId" INTEGER,
ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Subscription_flutterwaveSubscriptionId_key"
ON "Subscription"("flutterwaveSubscriptionId");

CREATE INDEX "Subscription_flutterwavePaymentPlanId_idx"
ON "Subscription"("flutterwavePaymentPlanId");
