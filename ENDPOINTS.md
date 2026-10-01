# Caskayd Backend Endpoints

Base URL: `/api`

Authentication:
- `Public`: no token required.
- `JWT`: send `Authorization: Bearer <accessToken>`.
- `JWT + Active subscription`: authenticated user must have an active subscription.
- `Admin`: JWT user role must be `admin` or `ADMIN` where noted.

Common enums:
- `PlatformType`: `INSTAGRAM`, `TIKTOK`, `YOUTUBE`, `X`, `LINKEDIN`
- `SubscriptionPlan`: `FREELANCER`, `INDIVIDUAL`, `TEAM` (`TEAM` is displayed as Group)
- `CampaignCreatorStatus`: `NOT_CONTACTED`, `CONTACTED`, `RESPONDED`, `ACCEPTED`, `DECLINED`, `AWAITING_CONTENT`, `CONTENT_DELIVERED`
- `SuggestionStatus`: `PENDING`, `APPROVED`, `REJECTED`

## App

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Health check. |

## Auth

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | `{ email, password, fullName }` | Register a new user. `password` min length is 8; `fullName` min length is 2. |
| `POST` | `/auth/login` | Public | `{ email, password }` | Login and receive tokens. `password` min length is 8. |
| `POST` | `/auth/refresh` | Refresh JWT | `{ refreshToken }` | Refresh access and refresh tokens. |
| `POST` | `/auth/logout` | JWT | none | Revoke the current user's refresh token. |

## Users

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/users/me` | JWT | none | Get current user profile. |
| `PATCH` | `/users/profile` | JWT | `{ fullName? }` | Update current user profile. |
| `PATCH` | `/users/password` | JWT | `{ currentPassword, newPassword }` | Update current user password. Both passwords require min length 8. |

## Payments

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/payments/initialize` | JWT | `{ amount?, title? }` | Initialize a Flutterwave card payment. `amount` defaults to `2000` NGN. |
| `GET` | `/payments/verify` | JWT | query: `transaction_id` or `tx_ref` | Verify Flutterwave payment by query string. |
| `POST` | `/payments/verify` | JWT | `{ transaction_id }` | Verify Flutterwave payment by request body. |
| `GET` | `/payments/methods` | JWT | none | List saved card payment methods for the current user. |
| `POST` | `/payments/webhook` | Public webhook | Flutterwave payload, header `flutterwave-signature` | Handle Flutterwave payment webhooks. |

## Subscriptions

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/subscriptions` | JWT | none | List plans and prices. Returns an empty list when `PAYMENT_ENABLED=false`. |
| `POST` | `/subscriptions/initialize` | JWT | `{ "plan": "INDIVIDUAL" }` | Initialize a subscription checkout. Accepted plans: `FREELANCER`, `INDIVIDUAL`, `TEAM`. Returns `{ subscriptionId, paymentLink, reference }`. |
| `POST` | `/subscriptions/verify` | JWT | `{ "transactionId": "..." }` | Verify a subscription payment or complete a search-pack purchase. A subscription payment activates the plan; a pack payment returns updated search usage. |
| `GET` | `/subscriptions/callback` | Flutterwave redirect | query: `transaction_id`, optional `tx_ref` | Verify checkout and redirect to `FRONTEND_DASHBOARD_URL` with `payment=success` or `payment=failed`. |
| `POST` | `/subscriptions/cancel` | JWT | none | Cancel recurring auto-renewal; current access remains until expiry. |
| `GET` | `/subscriptions/me` | JWT | none | Get the current user's latest subscription record. |
| `GET` | `/subscriptions/search-usage` | JWT | none | Get plan, usage, extra search credits, remaining searches, and period end. |
| `POST` | `/subscriptions/search-packs/initialize` | JWT | none | Start checkout for 50 extra searches on Freelancer. Returns `{ paymentLink, reference }`; after payment, call `/subscriptions/verify`. |
| `GET` | `/subscriptions/team/members` | JWT, Group owner | none | List registered accounts attached to the current owner's Group plan. |
| `POST` | `/subscriptions/team/members` | JWT, Group owner | `{ "email": "member@example.com" }` | Add an already registered account to the owner's Group plan. Owner plus at most 9 members. |
| `DELETE` | `/subscriptions/team/members/:memberId` | JWT, Group owner | none | Remove a member by their user ID. |
| `POST` | `/subscriptions/webhook` | Public webhook | Flutterwave payload, header `flutterwave-signature` | Handle Flutterwave subscription webhooks. |

Plan terms (all prices are NGN for 30 days):

| `plan` | Price | Searches | Accounts |
| --- | ---: | --- | ---: |
| `FREELANCER` | 2,000 | 50 per subscription period | 1 |
| `INDIVIDUAL` | 7,500 | Unlimited | 1 |
| `TEAM` | 50,000 | Unlimited | 10 total, including the owner |

`GET /subscriptions` returns each plan with `plan`, `amount`, `durationDays`, `includedSearches`, `accountLimit`, and `searchLimit`. An unlimited search limit is `null`.

Example `GET /subscriptions/search-usage` response:

```json
{
		"plan": "FREELANCER",
		"searchesUsed": 50,
	"additionalSearches": 0,
	"searchLimit": 50,
	"searchesRemaining": 0,
	"periodEndsAt": "2026-10-31T12:00:00.000Z"
}
```

Buying another search pack adds 50 searches to the current Freelancer period for 2,000 NGN. Search usage and pack credits reset when the subscription renews. Switching plans requires initializing and verifying a new subscription checkout.

Group members must already have an account; the API currently adds them by email and does not send email invitations. They use their own JWT and receive access through the Group owner's active subscription.

## Search

| Method | Endpoint | Auth | Query | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/search` | JWT + Active subscription | `query` | Search creators with deterministic parsing and ranking. `query` min length is 2. Freelancer searches consume quota; Individual and Group searches are unlimited. |

When the Freelancer quota is exhausted, `/search` returns HTTP `402` with the global error envelope. The `error.code` is `SEARCH_LIMIT_REACHED`; the user can wait for renewal, purchase a 50-search pack, or switch plans.

## Database Setup for Subscription Endpoints

The PostgreSQL statements are in [the subscription schema SQL](prisma/migrations/20261001000000_subscription_tiers_and_search_quotas/migration.sql). They only add an enum value, columns, tables, indexes, and foreign keys; there are no `DROP TABLE`, `DELETE FROM`, or `TRUNCATE` statements. The foreign keys specify `ON DELETE CASCADE` for future deletion of related parent records; this script does not delete existing rows. The statements use `IF NOT EXISTS` checks so they can be rerun if execution stops partway through. Review and back up the database before applying the full script in your SQL client. It has not been executed in this chat.

If the SQL is applied manually, the matching Prisma migration is still unrecorded in `_prisma_migrations`. The normal Prisma deployment process (`npx prisma migrate deploy`) can later run the same idempotent script and record it.

## Creators

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/creators` | JWT + Active subscription | query: `niche?`, `country?`, `state?`, `platform?`, `page?`, `limit?` | List creators. `state` is case-insensitive; `platform` accepts enum-style values like `INSTAGRAM` and frontend-style values like `Instagram`. |
| `GET` | `/creators/:id` | JWT + Active subscription | none | Get creator by id. |
| `POST` | `/creators` | Public | Creator body | Create a creator. |
| `PATCH` | `/creators/:id` | JWT + Active subscription | partial creator body | Update a creator. |
| `DELETE` | `/creators/:id` | JWT + Active subscription | none | Delete a creator. |

Creator body fields:
- Required: `name`
- Optional: `gender`, `country`, `state`, `primaryCategoryId`, `primaryNiche`, `secondaryCategoryIds`, `secondaryNiches`, `businessEmail`, `profileImage`, `searchTags`, `platforms`
- `secondaryCategoryIds` and `secondaryNiches` accept up to 5 unique strings.
- `platforms[]`: `{ platform, handle, followers, verified, profileUrl? }`

## Creator Suggestions

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/creator-suggestions` | Public | `{ name, username, platform, link? }` | Submit a creator suggestion. Usernames are trimmed, lowercased, and leading `@` is removed. |
| `GET` | `/admin/creator-suggestions` | Admin | query: `status?` | List creator suggestions for admin review. |
| `PATCH` | `/admin/creator-suggestions/:id` | Admin | `{ status }` | Approve or reject a pending suggestion. `status` must be `APPROVED` or `REJECTED` for processing. |

Suggestion duplicate rules:
- Existing creator username returns `400` with `Creator already exists`.
- Existing pending suggestion returns `400` with `Creator already suggested`.
- Already processed suggestions cannot be approved or rejected again.

## Categories

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/categories` | JWT + Active subscription | none | List categories. |
| `GET` | `/categories/tree` | JWT + Active subscription | none | Get categories as a nested tree. |
| `GET` | `/categories/:id` | JWT + Active subscription | none | Get category by id. |
| `POST` | `/categories` | Admin + Active subscription | `{ name, description?, parentId?, level? }` | Create a category. |
| `PATCH` | `/categories/:id` | Admin + Active subscription | partial category body | Update a category. |
| `DELETE` | `/categories/:id` | Admin + Active subscription | none | Delete a category. |

## Campaign Intents

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/campaign-intents` | JWT + Active subscription | none | List campaign intents. |
| `GET` | `/campaign-intents/:id` | JWT + Active subscription | none | Get campaign intent by id. |
| `POST` | `/campaign-intents` | Admin + Active subscription | `{ name, description?, categoryIds, tags }` | Create a campaign intent. |
| `PATCH` | `/campaign-intents/:id` | Admin + Active subscription | partial campaign intent body | Update a campaign intent. |
| `DELETE` | `/campaign-intents/:id` | Admin + Active subscription | none | Delete a campaign intent. |

## Campaigns

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/campaigns` | JWT + Active subscription | `{ name }` | Create a campaign. `name` min length is 2. |
| `GET` | `/campaigns` | JWT + Active subscription | none | List current user's campaigns. |
| `GET` | `/campaigns/:id` | JWT + Active subscription | none | Get campaign by id. |
| `PATCH` | `/campaigns/:id` | JWT + Active subscription | `{ name? }` | Update a campaign. |
| `DELETE` | `/campaigns/:id` | JWT + Active subscription | none | Delete a campaign. |
| `POST` | `/campaigns/:id/creators` | JWT + Active subscription | `{ creatorId }` | Add a creator to a campaign. |
| `DELETE` | `/campaigns/:id/creators/:creatorId` | JWT + Active subscription | none | Remove a creator from a campaign. |
| `PATCH` | `/campaigns/:id/creators/:creatorId/status` | JWT + Active subscription | `{ status }` | Update creator workflow status in a campaign. |

## Campaign Notes

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/campaigns/:campaignId/creators/:creatorId/notes` | JWT + Active subscription | `{ note }` | Add a note to a creator inside a campaign. |
| `GET` | `/campaigns/:campaignId/creators/:creatorId/notes` | JWT + Active subscription | none | Get notes for a creator inside a campaign. |
| `PATCH` | `/notes/:id` | JWT + Active subscription | `{ note? }` | Update a campaign creator note. |
| `DELETE` | `/notes/:id` | JWT + Active subscription | none | Delete a campaign creator note. |

## Saved Creators

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/saved-creators` | JWT + Active subscription | `{ creatorId }` | Save a creator. |
| `GET` | `/saved-creators` | JWT + Active subscription | none | List saved creators. |
| `DELETE` | `/saved-creators/:creatorId` | JWT + Active subscription | none | Remove a saved creator. |

## Dashboard

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/dashboard` | JWT + Active subscription | Get dashboard overview. |

## Crawler

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/crawler/scheduler` | JWT | none | Inspect crawler scheduler entry points. |
| `POST` | `/crawler/discovery` | JWT | `{ platform, keywords?, limit? }` | Queue a crawler discovery job. `limit` defaults to 10. |
| `POST` | `/crawler/refresh` | JWT | `{ creatorId, platform }` | Queue a crawler refresh job for an existing creator. |
| `POST` | `/crawler/import/csv` | JWT | `{ filePath, dryRun? }` | Import creators from CSV through the crawler pipeline. |
| `POST` | `/crawler/import/json` | JWT | `{ filePath, dryRun? }` | Import creators from JSON through the crawler pipeline. |
| `POST` | `/crawler/scheduler/run` | JWT | `{ trigger }` | Run a scheduler workflow immediately. `trigger`: `discovery`, `large`, `medium`, or `small`. |

