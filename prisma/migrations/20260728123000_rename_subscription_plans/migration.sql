CREATE TYPE "SubscriptionPlan_new" AS ENUM ('INDIVIDUAL', 'TEAM');

ALTER TABLE "Subscription"
ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
USING (
  CASE
    WHEN "plan"::text = 'STARTER' THEN 'INDIVIDUAL'::"SubscriptionPlan_new"
    WHEN "plan"::text IN ('PRO', 'ENTERPRISE') THEN 'TEAM'::"SubscriptionPlan_new"
  END
);

DROP TYPE "SubscriptionPlan";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
