# Subscription and Search Endpoints

Base URL: `/api`

All protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

All prices are in NGN and plans run for 30 days.

## Plans

| Plan | Price | Searches | Accounts |
| --- | ---: | --- | ---: |
| `FREELANCER` | 2,000 | 50 per subscription period | 1 |
| `INDIVIDUAL` | 7,500 | Unlimited | 1 |
| `TEAM` | 50,000 | Unlimited | 10 total, including the owner |

`TEAM` is the backend plan value displayed to users as Group.

## List Plans

```http
GET /api/subscriptions
```

Response:

```json
[
  {
    "plan": "FREELANCER",
    "amount": 2000,
    "durationDays": 30,
    "includedSearches": 50,
    "accountLimit": 1,
    "searchLimit": 50
  }
]
```

Unlimited values are returned as `null` for `includedSearches` and `searchLimit`.

## Start Subscription Checkout

```http
POST /api/subscriptions/initialize
Content-Type: application/json
```

Request:

```json
{
  "plan": "INDIVIDUAL"
}
```

Allowed values: `FREELANCER`, `INDIVIDUAL`, `TEAM`.

Response:

```json
{
  "subscriptionId": "subscription-id",
  "paymentLink": "https://checkout.example.com/...",
  "reference": "caskayd-user-id-..."
}
```

Open `paymentLink` to complete Flutterwave checkout.

## Verify Subscription Payment

```http
POST /api/subscriptions/verify
Content-Type: application/json
```

Request:

```json
{
  "transactionId": "flutterwave-transaction-id"
}
```

A successful response activates the selected subscription and returns the subscription record.

## Subscription Callback

Flutterwave can redirect to:

```http
GET /api/subscriptions/callback?transaction_id=<transactionId>&tx_ref=<reference>
```

The API redirects to the configured dashboard URL with either:

```text
?payment=success
```

or:

```text
?payment=failed
```

## Current Subscription

```http
GET /api/subscriptions/me
```

Returns the current user's latest subscription record, including `plan`, `status`, `expiresAt`, `autoRenew`, `searchesUsed`, and `searchCredits`.

## Search Usage

```http
GET /api/subscriptions/search-usage
```

Example response:

```json
{
  "plan": "INDIVIDUAL",
  "searchesUsed": 50,
  "additionalSearches": 0,
  "searchLimit": 50,
  "searchesRemaining": 0,
  "periodEndsAt": "2026-10-31T12:00:00.000Z"
}
```

For unlimited plans, `searchLimit` and `searchesRemaining` are `null`.

## Buy 50 Additional Searches

Only Freelancer subscribers can buy a search pack.

```http
POST /api/subscriptions/search-packs/initialize
```

No request body is required.

Response:

```json
{
  "paymentLink": "https://checkout.example.com/...",
  "reference": "caskayd-search-pack-user-id-..."
}
```

The pack costs 2,000 NGN and adds 50 searches after payment verification. Complete it with the same verify endpoint:

```http
POST /api/subscriptions/verify
Content-Type: application/json

{
  "transactionId": "flutterwave-transaction-id"
}
```

## Group Members

The owner must have an active `TEAM` subscription. The owner plus up to 9 members equals 10 total accounts. Members must already be registered accounts.

### List Members

```http
GET /api/subscriptions/team/members
```

### Add Member

```http
POST /api/subscriptions/team/members
Content-Type: application/json
```

Request:

```json
{
  "email": "member@example.com"
}
```

The member receives access through the Group owner's active subscription and uses their own JWT.

### Remove Member

```http
DELETE /api/subscriptions/team/members/<memberId>
```

## Cancel Auto-Renewal

```http
POST /api/subscriptions/cancel
```

This stops future recurring charges. Existing access continues until `expiresAt`.

## Creator Search

```http
GET /api/search?query=beauty%20creators%20in%20Lagos
```

Requires an active subscription. Freelancer searches consume one search from the current period. Individual and Group searches are unlimited.

When the Freelancer quota is exhausted, the API returns HTTP `402`:

```json
{
  "statusCode": 402,
  "error": {
    "statusCode": 402,
    "message": "Search limit reached. Wait for your subscription period to renew, buy another 50 searches, or change plans.",
    "code": "SEARCH_LIMIT_REACHED"
  }
}
```

## Frontend Flow

1. Call `GET /api/subscriptions` to display plans.
2. Call `POST /api/subscriptions/initialize` with the selected plan.
3. Open the returned `paymentLink`.
4. Verify the payment using `POST /api/subscriptions/verify`, or allow the callback URL to verify it.
5. Call `GET /api/subscriptions/me` and `GET /api/subscriptions/search-usage` to refresh subscription state.
6. For Freelancer quota exhaustion, call `POST /api/subscriptions/search-packs/initialize` or show plan upgrade options.
7. For Group owners, use the `/api/subscriptions/team/members` endpoints to manage accounts.

## Database Requirement

The backend requires the database schema changes from:

`prisma/migrations/20261001000000_subscription_tiers_and_search_quotas/migration.sql`

That script is additive and contains no `DROP TABLE`, `DELETE FROM`, or `TRUNCATE` statements. It must be applied manually to the correct PostgreSQL database before using these new endpoints. Do not enable RLS for this NestJS/Prisma backend unless you also create and test policies for every backend table.
