# Caskayd Backend Endpoints

Base URL: `/api`

Authentication:
- `Public`: no token required.
- `JWT`: send `Authorization: Bearer <accessToken>`.
- `JWT + Active subscription`: authenticated user must have an active subscription.
- `Admin`: JWT user role must be `admin` or `ADMIN` where noted.

Common enums:
- `PlatformType`: `INSTAGRAM`, `TIKTOK`, `YOUTUBE`, `X`, `LINKEDIN`
- `SubscriptionPlan`: `INDIVIDUAL`, `TEAM`
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
| `GET` | `/subscriptions` | JWT | none | List available subscription plans. |
| `POST` | `/subscriptions/initialize` | JWT | `{ plan }` | Initialize a subscription payment. `plan` is `INDIVIDUAL` or `TEAM`. |
| `POST` | `/subscriptions/verify` | JWT | `{ transactionId }` | Verify Flutterwave payment and activate subscription. |
| `POST` | `/subscriptions/cancel` | JWT | none | Cancel recurring subscription auto-renewal. |
| `GET` | `/subscriptions/me` | JWT | none | Get current user's subscription. |
| `POST` | `/subscriptions/webhook` | Public webhook | Flutterwave payload, header `flutterwave-signature` | Handle Flutterwave subscription webhooks. |

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

## Search

| Method | Endpoint | Auth | Query | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/search` | JWT + Active subscription | `query` | Search creators with deterministic parsing and ranking. `query` min length is 2. |

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

